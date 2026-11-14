/**
 * 地区管理接口（F-30~F-33、F-43）
 * GET    /api/admin/regions       列表（keyword + 分页 10 + scenicCount）
 * GET    /api/admin/regions/:id   详情（编辑回填）
 * POST   /api/admin/regions       新增（名称唯一 + 封面路径校验 + 操作日志）
 * PUT    /api/admin/regions/:id   编辑（名称唯一排除自身）
 * DELETE /api/admin/regions/:id   删除（存在下属景区 → 3001 并写 result=fail 日志）
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
  toInt,
  trimText,
} from '../../utils.js';
import { regionView, scenicCountOf } from '../shared.js';

const router = Router();

router.use(requireAdmin);

/**
 * 校验并归一化地区表单入参。
 *
 * 封面图采用「只在被改动时才校验存在性」的口径：编辑历史数据时若原值本身就不合规
 * （例如素材已从 .png 换成 .jpg），管理员不改封面直接保存不应被卡死；
 * 一旦改动就必须是 `/images/` 下真实存在的文件。
 *
 * @param {object} body
 * @param {{currentCoverImage?:string}} [options] 编辑场景传入当前值
 * @returns {{name:string,coverImage:string,description:string,sortOrder:number}}
 */
function buildRegionPayload(body, options = {}) {
  const source = body || {};
  const name = trimText(source.name);
  const coverImage = trimText(source.coverImage);
  const description = trimText(source.description);
  const rawSortOrder = source.sortOrder;
  const currentCoverImage = trimText(options.currentCoverImage);
  const fields = createFieldErrors();

  if (name.length < 2 || name.length > 20) {
    fields.add('name', '请输入地区名称（2–20 字）');
  }
  if (coverImage !== currentCoverImage && !isAvailableImagePath(coverImage)) {
    fields.add('coverImage', '请填写 /images/ 下已存在的图片路径（如 /images/jiuzhaigou.jpg）');
  }
  if (description.length > 200) {
    fields.add('description', '简介不超过 200 字');
  }
  if (rawSortOrder !== undefined && rawSortOrder !== null && String(rawSortOrder).trim() !== '') {
    if (!Number.isFinite(Number(rawSortOrder))) {
      fields.add('sortOrder', '排序值需为整数');
    }
  }
  fields.throwIfInvalid();

  return {
    name,
    coverImage,
    description,
    sortOrder: toInt(rawSortOrder, 0),
  };
}

/**
 * 名称唯一性检查（去空格比对，可排除自身）。
 * @param {string} name
 * @param {number|null} [exceptId=null]
 * @returns {boolean}
 */
function isNameTaken(name, exceptId = null) {
  return db.data.regions.some((item) => item.id !== exceptId && trimText(item.name) === name);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.ADMIN_LIST);
    const keyword = trimText(req.query.keyword);

    const filtered = db.data.regions.filter((region) => matchKeyword(keyword, region.name, region.description));
    const sorted = filtered.slice().sort((a, b) => b.id - a.id);
    const items = sorted.map((region) => regionView(region));

    res.json(ok(paginate(items, page, pageSize)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '地区不存在', 404);

    const region = db.data.regions.find((item) => item.id === id);
    if (!region) throw new AppError(1002, '地区不存在', 404);

    res.json(ok({ region: regionView(region) }));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = buildRegionPayload(req.body);
    const ip = clientIp(req);

    if (isNameTaken(payload.name)) {
      await writeOperationLog({
        adminId: req.admin.id,
        adminName: req.admin.username,
        module: 'region',
        action: 'create',
        targetId: null,
        targetName: payload.name,
        result: 'fail',
        message: '该地区名称已存在',
        ip,
      });
      throw new AppError(1003, '该地区名称已存在', 409, { name: '该地区名称已存在' });
    }

    const now = nowIso();
    const region = {
      id: db.nextId('regions'),
      name: payload.name,
      coverImage: payload.coverImage,
      description: payload.description,
      sortOrder: payload.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    db.data.regions.push(region);
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'region',
      action: 'create',
      targetId: region.id,
      targetName: region.name,
      result: 'success',
      message: '',
      ip,
    });

    res.status(201).json(ok({ region: regionView(region) }, '地区已添加'));
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '地区不存在', 404);

    const region = db.data.regions.find((item) => item.id === id);
    if (!region) throw new AppError(1002, '地区不存在', 404);

    // 未改动封面时豁免存在性校验，避免历史脏数据把编辑流程卡死
    const payload = buildRegionPayload(req.body, { currentCoverImage: region.coverImage });
    const ip = clientIp(req);

    if (isNameTaken(payload.name, id)) {
      await writeOperationLog({
        adminId: req.admin.id,
        adminName: req.admin.username,
        module: 'region',
        action: 'update',
        targetId: id,
        targetName: payload.name,
        result: 'fail',
        message: '该地区名称已存在',
        ip,
      });
      throw new AppError(1003, '该地区名称已存在', 409, { name: '该地区名称已存在' });
    }

    region.name = payload.name;
    region.coverImage = payload.coverImage;
    region.description = payload.description;
    region.sortOrder = payload.sortOrder;
    region.updatedAt = nowIso();
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'region',
      action: 'update',
      targetId: region.id,
      targetName: region.name,
      result: 'success',
      message: '',
      ip,
    });

    res.json(ok({ region: regionView(region) }, '地区已保存'));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '地区不存在', 404);

    const index = db.data.regions.findIndex((item) => item.id === id);
    if (index < 0) throw new AppError(1002, '地区不存在', 404);

    const region = db.data.regions[index];
    const ip = clientIp(req);
    const scenicCount = scenicCountOf(id);

    if (scenicCount > 0) {
      const message = `该地区下还有 ${scenicCount} 个景区，请先处理`;
      await writeOperationLog({
        adminId: req.admin.id,
        adminName: req.admin.username,
        module: 'region',
        action: 'delete',
        targetId: id,
        targetName: region.name,
        result: 'fail',
        message,
        ip,
      });
      throw new AppError(3001, message, 409);
    }

    db.data.regions.splice(index, 1);
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'region',
      action: 'delete',
      targetId: id,
      targetName: region.name,
      result: 'success',
      message: '',
      ip,
    });

    res.json(ok({ deleted: true, id }, '地区已删除'));
  }),
);

export default router;
