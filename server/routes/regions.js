/**
 * 地区接口（F-06、F-10 侧栏）
 * GET /api/regions      地区列表（按 sortOrder 倒序 → id 升序，含 scenicCount，可 ?limit=6）
 * GET /api/regions/:id  地区详情 + 该地区景区精简列表
 */

import { Router } from 'express';

import { db } from '../db.js';
import { AppError, asyncHandler, ok, parseId, toInt } from '../utils.js';
import { regionView, scenicBrief } from './shared.js';

const router = Router();

/**
 * 地区排序：sortOrder 越大越靠前，相同则 id 升序。
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function bySortOrderDesc(a, b) {
  const left = Number.isFinite(a.sortOrder) ? a.sortOrder : 0;
  const right = Number.isFinite(b.sortOrder) ? b.sortOrder : 0;
  if (right !== left) return right - left;
  return a.id - b.id;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = toInt(req.query.limit, null, { min: 1, max: 100 });
    const list = db.data.regions
      .slice()
      .sort(bySortOrderDesc)
      .map((region) => regionView(region));

    res.json(ok({ list: limit === null ? list : list.slice(0, limit), total: list.length }));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '地区不存在', 404);

    const region = db.data.regions.find((item) => item.id === id);
    if (!region) throw new AppError(1002, '地区不存在', 404);

    const scenics = db.data.scenics
      .filter((item) => item.regionId === id)
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((item) => scenicBrief(item));

    res.json(ok({ region: regionView(region), scenics }));
  }),
);

export default router;
