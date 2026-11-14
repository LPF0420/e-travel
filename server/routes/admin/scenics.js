/**
 * 景区管理接口（F-34~F-38、F-43）
 * GET    /api/admin/scenics                  列表：keyword/regionId/isRecommended + 分页 10
 * GET    /api/admin/scenics/:id              详情（含 travelCount / favoriteCount，供删除弹窗文案）
 * POST   /api/admin/scenics                  新增（regionId 存在性 → 3002）
 * PUT    /api/admin/scenics/:id              编辑
 * DELETE /api/admin/scenics/:id              删除（级联删除游记与收藏，日志写明级联数量）
 * PATCH  /api/admin/scenics/:id/recommend    推荐开关（返回 recommendedTotal，>6 附 warning）
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
  normalizeStringList,
  nowIso,
  ok,
  paginate,
  parseId,
  parsePaging,
  textLength,
  toBoolean,
  trimText,
} from '../../utils.js';
import { favoriteCountOf, findRegion, scenicView, travelCountOf } from '../shared.js';

const router = Router();

router.use(requireAdmin);

/** 首页推荐位上限 */
const RECOMMEND_LIMIT = 6;

/**
 * 校验并归一化景区表单入参。
 *
 * 封面与图集同样采用「只在被改动时才校验存在性」的口径：历史数据的旧路径不因为
 * 素材换后缀而把整条记录的编辑流程卡死；一旦改动就必须是真实存在的图片。
 *
 * @param {object} body
 * @param {{currentCoverImage?:string,currentGallery?:string[]}} [options] 编辑场景传入当前值
 * @returns {object}
 */
function buildScenicPayload(body, options = {}) {
  const source = body || {};
  const fields = createFieldErrors();

  const name = trimText(source.name);
  const regionId = parseId(source.regionId);
  const coverImage = trimText(source.coverImage);
  const gallery = normalizeStringList(source.gallery, { maxItems: 6 });
  const openTime = trimText(source.openTime);
  const ticketPrice = trimText(source.ticketPrice);
  const traffic = trimText(source.traffic);
  const description = trimText(source.description);
  const level = trimText(source.level);
  const bestSeason = trimText(source.bestSeason);
  const highlights = normalizeStringList(source.highlights, { maxItems: 6 });
  const isRecommended = toBoolean(source.isRecommended, false);

  const currentCoverImage = trimText(options.currentCoverImage);
  const currentGallery = normalizeStringList(options.currentGallery, { maxItems: 6 });
  const coverChanged = coverImage !== currentCoverImage;
  const galleryChanged = gallery.length !== currentGallery.length || gallery.some((item, index) => item !== currentGallery[index]);

  if (name.length < 2 || name.length > 50) {
    fields.add('name', '请输入景区名称（2–50 字）');
  }
  if (regionId === null) {
    fields.add('regionId', '请选择所属地区');
  }
  if (coverChanged && !isAvailableImagePath(coverImage)) {
    fields.add('coverImage', '请填写 /images/ 下已存在的图片路径（如 /images/jiuzhaigou.jpg）');
  }
  if (galleryChanged && gallery.some((item) => !isAvailableImagePath(item))) {
    fields.add('gallery', '图集每一项都需是 /images/ 下已存在的图片');
  }
  if (openTime.length > 50) fields.add('openTime', '开放时间不超过 50 字');
  if (ticketPrice.length > 50) fields.add('ticketPrice', '门票参考不超过 50 字');
  if (traffic.length > 200) fields.add('traffic', '交通指引不超过 200 字');
  if (textLength(description) < 10) fields.add('description', '内容太短，请至少输入 10 个字');
  if (level.length > 10) fields.add('level', '景区等级不超过 10 字');
  if (bestSeason.length > 30) fields.add('bestSeason', '最佳季节不超过 30 字');
  if (highlights.some((item) => item.length > 20)) fields.add('highlights', '单个看点不超过 20 字');

  let rating = null;
  const rawRating = source.rating;
  if (rawRating !== undefined && rawRating !== null && String(rawRating).trim() !== '') {
    const parsed = Number(rawRating);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
      fields.add('rating', '评分需为 0–5 之间的数字');
    } else {
      rating = Math.round(parsed * 10) / 10;
    }
  }

  fields.throwIfInvalid();

  return {
    name,
    regionId,
    coverImage,
    gallery,
    openTime,
    ticketPrice,
    traffic,
    description,
    level,
    bestSeason,
    highlights,
    isRecommended,
    rating,
  };
}

/**
 * 写一条失败操作日志并抛出外键错误（3002）。
 * @param {import('express').Request} req
 * @param {'create'|'update'} action
 * @param {string} targetName
 * @param {string} message
 * @returns {Promise<never>}
 */
async function failWithForeignKey(req, action, targetName, message) {
  await writeOperationLog({
    adminId: req.admin.id,
    adminName: req.admin.username,
    module: 'scenic',
    action,
    targetId: null,
    targetName,
    result: 'fail',
    message,
    ip: clientIp(req),
  });
  throw new AppError(3002, message, 400, { regionId: message });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.ADMIN_LIST);
    const keyword = trimText(req.query.keyword);
    const recommendedFilter = toBoolean(req.query.isRecommended, null);

    let regionId = null;
    if (req.query.regionId !== undefined && trimText(req.query.regionId) !== '') {
      regionId = parseId(req.query.regionId);
      if (regionId === null) {
        throw new AppError(1001, '地区参数不合法', 400, { regionId: '地区参数不合法' });
      }
    }

    const filtered = db.data.scenics.filter((scenic) => {
      if (regionId !== null && scenic.regionId !== regionId) return false;
      if (recommendedFilter !== null && Boolean(scenic.isRecommended) !== recommendedFilter) return false;
      return matchKeyword(keyword, scenic.name, scenic.description);
    });

    const sorted = filtered.slice().sort((a, b) => b.id - a.id);
    const items = sorted.map((scenic) => scenicView(scenic, null));

    res.json(ok(paginate(items, page, pageSize)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '景区不存在', 404);

    const scenic = db.data.scenics.find((item) => item.id === id);
    if (!scenic) throw new AppError(1002, '景区不存在', 404);

    res.json(
      ok({
        scenic: scenicView(scenic, null),
        travelCount: travelCountOf(id),
        favoriteCount: favoriteCountOf(id),
      }),
    );
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = buildScenicPayload(req.body);
    const ip = clientIp(req);

    const region = findRegion(payload.regionId);
    if (!region) {
      await failWithForeignKey(req, 'create', payload.name, '所属地区不存在');
    }

    const now = nowIso();
    const scenic = {
      id: db.nextId('scenics'),
      name: payload.name,
      regionId: payload.regionId,
      coverImage: payload.coverImage,
      gallery: payload.gallery,
      openTime: payload.openTime,
      ticketPrice: payload.ticketPrice,
      traffic: payload.traffic,
      description: payload.description,
      isRecommended: payload.isRecommended,
      viewCount: 0,
      level: payload.level,
      rating: payload.rating,
      bestSeason: payload.bestSeason,
      highlights: payload.highlights,
      createdAt: now,
      updatedAt: now,
    };
    db.data.scenics.push(scenic);
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'scenic',
      action: 'create',
      targetId: scenic.id,
      targetName: scenic.name,
      result: 'success',
      message: '',
      ip,
    });

    res.status(201).json(ok({ scenic: scenicView(scenic, null) }, '景区已添加'));
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '景区不存在', 404);

    const scenic = db.data.scenics.find((item) => item.id === id);
    if (!scenic) throw new AppError(1002, '景区不存在', 404);

    // 未改动的封面/图集豁免存在性校验，避免历史脏数据把编辑流程卡死
    const payload = buildScenicPayload(req.body, {
      currentCoverImage: scenic.coverImage,
      currentGallery: scenic.gallery,
    });
    const ip = clientIp(req);

    const region = findRegion(payload.regionId);
    if (!region) {
      await failWithForeignKey(req, 'update', payload.name, '所属地区不存在');
    }

    scenic.name = payload.name;
    scenic.regionId = payload.regionId;
    scenic.coverImage = payload.coverImage;
    scenic.gallery = payload.gallery;
    scenic.openTime = payload.openTime;
    scenic.ticketPrice = payload.ticketPrice;
    scenic.traffic = payload.traffic;
    scenic.description = payload.description;
    scenic.isRecommended = payload.isRecommended;
    scenic.level = payload.level;
    scenic.rating = payload.rating;
    scenic.bestSeason = payload.bestSeason;
    scenic.highlights = payload.highlights;
    scenic.updatedAt = nowIso();
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'scenic',
      action: 'update',
      targetId: scenic.id,
      targetName: scenic.name,
      result: 'success',
      message: '',
      ip,
    });

    res.json(ok({ scenic: scenicView(scenic, null) }, '景区已保存'));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '景区不存在', 404);

    const index = db.data.scenics.findIndex((item) => item.id === id);
    if (index < 0) throw new AppError(1002, '景区不存在', 404);

    const scenic = db.data.scenics[index];
    const ip = clientIp(req);

    const removedTravels = db.data.travels.filter((item) => item.scenicId === id);
    const removedFavorites = db.data.favorites.filter((item) => item.scenicId === id);

    // 级联删除：先过滤掉关联数据，再删景区，一次 save 落盘
    db.data.travels = db.data.travels.filter((item) => item.scenicId !== id);
    db.data.favorites = db.data.favorites.filter((item) => item.scenicId !== id);
    db.data.scenics.splice(index, 1);
    await db.save();

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'scenic',
      action: 'delete',
      targetId: id,
      targetName: scenic.name,
      result: 'success',
      message: `级联删除 ${removedTravels.length} 篇游记、${removedFavorites.length} 条收藏`,
      ip,
    });

    res.json(
      ok(
        {
          deleted: true,
          id,
          cascade: { travels: removedTravels.length, favorites: removedFavorites.length },
        },
        '景区已删除',
      ),
    );
  }),
);

router.patch(
  '/:id/recommend',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '景区不存在', 404);

    const scenic = db.data.scenics.find((item) => item.id === id);
    if (!scenic) throw new AppError(1002, '景区不存在', 404);

    const isRecommended = toBoolean((req.body || {}).isRecommended, null);
    if (isRecommended === null) {
      throw new AppError(1001, '请提供 isRecommended 布尔值', 400, { isRecommended: '请提供 isRecommended 布尔值' });
    }

    scenic.isRecommended = isRecommended;
    scenic.updatedAt = nowIso();
    await db.save();

    const recommendedTotal = db.data.scenics.filter((item) => item.isRecommended).length;

    await writeOperationLog({
      adminId: req.admin.id,
      adminName: req.admin.username,
      module: 'scenic',
      action: 'update',
      targetId: scenic.id,
      targetName: scenic.name,
      result: 'success',
      message: isRecommended ? '设为推荐' : '取消推荐',
      ip: clientIp(req),
    });

    const payload = { id: scenic.id, isRecommended, recommendedTotal };
    if (recommendedTotal > RECOMMEND_LIMIT) {
      payload.warning = `当前推荐景区共 ${recommendedTotal} 个，超过首页 ${RECOMMEND_LIMIT} 个展示位，首页将按更新时间取前 ${RECOMMEND_LIMIT} 个`;
    }

    res.json(ok(payload, isRecommended ? '已设为推荐' : '已取消推荐'));
  }),
);

export default router;
