/**
 * 游记管理接口（F-39~F-42、F-43）
 * GET    /api/admin/travels       列表：keyword（标题）/ scenicId + 分页 10
 * GET    /api/admin/travels/:id   详情（编辑回填）
 * POST   /api/admin/travels       新增（scenicId 存在性 → 3002）
 * PUT    /api/admin/travels/:id   编辑
 * DELETE /api/admin/travels/:id   删除
 */

import { Router } from 'express';

import { requireAdmin } from '../../auth.js';
import { PAGE_SIZE } from '../../constants.js';
import { db } from '../../db.js';
import { writeOperationLog } from '../../logs.js';
import {
  AppError,
  asyncHandler,
  clientIp,
  createFieldErrors,
  isAvailableImagePath,
  matchKeyword,
  nowIso,
  ok,
  paginate,
  parseId,
  parsePaging,
  textLength,
  trimText,
} from '../../utils.js';
import { findScenic, travelView } from '../shared.js';

const router = Router();

router.use(requireAdmin);

/** 作者缺省值（管理员代发） */
const DEFAULT_AUTHOR = '站点编辑';

/**
 * 解析日期时间入参：支持 ISO、`YYYY-MM-DD`、`YYYY-MM-DDTHH:mm`（本地时区），非法返回 null。
 * @param {any} value
 * @returns {string|null} ISO 字符串
 */
function parseDateTimeInput(value) {
  const text = trimText(value);
  if (!text) return null;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

/**
 * 校验并归一化游记表单入参。
 *
 * 封面同样采用「只在被改动时才校验存在性」的口径（历史脏数据不阻塞编辑）；
 * 留空时由调用方回落所属景区封面。
 *
 * @param {object} body
 * @param {{currentCoverImage?:string}} [options] 编辑场景传入当前值
 * @returns {object}
 */
function buildTravelPayload(body, options = {}) {
  const source = body || {};
  const fields = createFieldErrors();

  const title = trimText(source.title);
  const scenicId = parseId(source.scenicId);
  const coverImage = trimText(source.coverImage);
  const authorName = trimText(source.authorName) || DEFAULT_AUTHOR;
  const content = trimText(source.content);
  const currentCoverImage = trimText(options.currentCoverImage);

  if (title.length < 4 || title.length > 60) {
    fields.add('title', '请输入 4–60 字的游记标题');
  }
  if (scenicId === null) {
    fields.add('scenicId', '请选择所属景区');
  }
  if (coverImage && coverImage !== currentCoverImage && !isAvailableImagePath(coverImage)) {
    fields.add('coverImage', '请填写 /images/ 下已存在的图片路径（如 /images/jiuzhaigou.jpg）');
  }
  if (authorName.length > 20) {
    fields.add('authorName', '作者名不超过 20 字');
  }
  if (textLength(content) < 10) {
    fields.add('content', '内容太短，请至少输入 10 个字');
  }

  let authorMemberId = null;
  const rawMemberId = source.authorMemberId;
  if (rawMemberId !== undefined && rawMemberId !== null && String(rawMemberId).trim() !== '') {
    authorMemberId = parseId(rawMemberId);
    if (authorMemberId === null) {
      fields.add('authorMemberId', '作者会员不存在');
    } else if (!db.data.members.some((member) => member.id === authorMemberId)) {
      fields.add('authorMemberId', '作者会员不存在');
    }
  }

  let publishedAt = null;
  const rawPublishedAt = source.publishedAt;
  if (rawPublishedAt !== undefined && rawPublishedAt !== null && String(rawPublishedAt).trim() !== '') {
    publishedAt = parseDateTimeInput(rawPublishedAt);
    if (publishedAt === null) {
      fields.add('publishedAt', '发布时间格式不正确');
    }
  }

  fields.throwIfInvalid();

  return { title, scenicId, coverImage, authorName, authorMemberId, content, publishedAt };
}

/**
 * 写失败日志（外键校验）+ 抛出 3002。
 * @param {import('express').Request} req
 * @param {'create'|'update'} action
 * @param {string} targetName
 * @returns {Promise<never>}
 */
async function failWithForeignKey(req, action, targetName) {
  const message = '所属景区不存在';
  await writeOperationLog({
    adminId: req.admin.id,
    adminName: req.admin.username,
    module: 'travel',
    action,
    targetId: null,
    targetName,
    result: 'fail',
    message,
    ip: clientIp(req),
  });
  throw new AppError(3002, message, 400, { scenicId: message });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.ADMIN_LIST);
    const keyword = trimText(req.query.keyword);

    let scenicId = null;
    if (req.query.scenicId !== undefined && trimText(req.query.scenicId) !== '') {
      scenicId = parseId(req.query.scenicId);
      if (scenicId === null) {
        throw new AppError(1001, '景区参数不合法', 400, { scenicId: '景区参数不合法' });
      }
    }

    const filtered = db.data.travels.filter((travel) => {
      if (scenicId !== null && travel.scenicId !== scenicId) return false;
      return matchKeyword(keyword, travel.title, travel.authorName);
    });

    const sorted = filtered.slice().sort((a, b) => {
      const left = Date.parse(a.publishedAt || '') || 0;
      const right = Date.parse(b.publishedAt || '') || 0;
      if (right !== left) return right - left;
      return b.id - a.id;
    });

    const items = sorted.map((travel) => travelView(travel));
    res.json(ok(paginate(items, page, pageSize)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '游记不存在', 404);

    const travel = db.data.travels.find((item) => item.id === id);
    if (!travel) throw new AppError(1002, '游记不存在', 404);

    res.json(ok({ travel: travelView(travel) }));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = buildTravelPayload(req.body);
    const ip = clientIp(req);

    const scenic = findScenic(payload.scenicId);
    if (!scenic) {
      await failWithForeignKey(req, 'create', payload.title);
    }

    const now = nowIso();
    const travel = {
      id: db.nextId('travels'),
      title: payload.title,
      scenicId: payload.scenicId,
      coverImage: payload.coverImage || scenic.coverImage,
      authorName: payload.authorName,
      authorMemberId: payload.authorMemberId,
      content: payload.content,
      publishedAt: payload.publishedAt || now,
      createdAt: now,
      updatedAt: now,
    };
    db.data.travels.push(travel);
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'travel',
      action: 'create',
      targetId: travel.id,
      targetName: travel.title,
      result: 'success',
      message: '',
      ip,
    });

    res.status(201).json(ok({ travel: travelView(travel) }, '游记已添加'));
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '游记不存在', 404);

    const travel = db.data.travels.find((item) => item.id === id);
    if (!travel) throw new AppError(1002, '游记不存在', 404);

    // 未改动的封面豁免存在性校验，避免历史脏数据把编辑流程卡死
    const payload = buildTravelPayload(req.body, { currentCoverImage: travel.coverImage });
    const ip = clientIp(req);

    const scenic = findScenic(payload.scenicId);
    if (!scenic) {
      await failWithForeignKey(req, 'update', payload.title);
    }

    travel.title = payload.title;
    travel.scenicId = payload.scenicId;
    travel.coverImage = payload.coverImage || scenic.coverImage;
    travel.authorName = payload.authorName;
    travel.authorMemberId = payload.authorMemberId;
    travel.content = payload.content;
    if (payload.publishedAt) travel.publishedAt = payload.publishedAt;
    travel.updatedAt = nowIso();
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'travel',
      action: 'update',
      targetId: travel.id,
      targetName: travel.title,
      result: 'success',
      message: '',
      ip,
    });

    res.json(ok({ travel: travelView(travel) }, '游记已保存'));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '游记不存在', 404);

    const index = db.data.travels.findIndex((item) => item.id === id);
    if (index < 0) throw new AppError(1002, '游记不存在', 404);

    const travel = db.data.travels[index];
    db.data.travels.splice(index, 1);
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'travel',
      action: 'delete',
      targetId: id,
      targetName: travel.title,
      result: 'success',
      message: '',
      ip: clientIp(req),
    });

    res.json(ok({ deleted: true, id }, '游记已删除'));
  }),
);

export default router;
