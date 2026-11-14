/**
 * 景区接口（F-05、F-09、F-10、F-13、F-47）
 * GET /api/scenics            列表：keyword / regionId / sort / isRecommended / page / pageSize / limit
 * GET /api/scenics/:id        详情（含 region、favoriteCount、travelCount、isFavorited）
 * GET /api/scenics/:id/travels 该景区游记（默认 5 条）
 */

import { Router } from 'express';

import { optionalMember } from '../auth.js';
import { PAGE_SIZE, SCENIC_SORTS } from '../constants.js';
import { db } from '../db.js';
import {
  AppError,
  asyncHandler,
  byTimeDesc,
  matchKeyword,
  ok,
  paginate,
  parseId,
  parsePaging,
  toBoolean,
  toInt,
  trimText,
} from '../utils.js';
import { byPublishedAtDesc, regionView, scenicView, travelView } from './shared.js';

const router = Router();

/**
 * 景区列表排序器工厂。
 * @param {'default'|'recommend'|'latest'|'popular'} sort
 * @returns {(a:object,b:object)=>number}
 */
function comparatorFor(sort) {
  if (sort === 'recommend') {
    return (a, b) => {
      const left = a.isRecommended ? 1 : 0;
      const right = b.isRecommended ? 1 : 0;
      if (right !== left) return right - left;
      const byUpdated = byTimeDesc('updatedAt')(a, b);
      return byUpdated !== 0 ? byUpdated : b.id - a.id;
    };
  }
  if (sort === 'latest') {
    return (a, b) => {
      const byCreated = byTimeDesc('createdAt')(a, b);
      return byCreated !== 0 ? byCreated : b.id - a.id;
    };
  }
  if (sort === 'popular') {
    return (a, b) => {
      if (b._favoriteCount !== a._favoriteCount) return b._favoriteCount - a._favoriteCount;
      return b.id - a.id;
    };
  }
  return (a, b) => b.id - a.id;
}

router.get(
  '/',
  optionalMember,
  asyncHandler(async (req, res) => {
    const memberId = req.member ? req.member.id : null;
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.SCENICS);
    const limit = toInt(req.query.limit, null, { min: 1, max: PAGE_SIZE.MAX });

    const keyword = trimText(req.query.keyword);
    const sort = trimText(req.query.sort) || 'default';
    if (req.query.sort !== undefined && req.query.sort !== '' && !SCENIC_SORTS.includes(sort)) {
      throw new AppError(1001, '排序方式不合法', 400, { sort: '排序方式不合法' });
    }

    let regionId = null;
    if (req.query.regionId !== undefined && trimText(req.query.regionId) !== '') {
      regionId = parseId(req.query.regionId);
      if (regionId === null) throw new AppError(1001, '地区参数不合法', 400, { regionId: '地区参数不合法' });
    }

    const recommendedFilter = toBoolean(req.query.isRecommended, null);

    const filtered = db.data.scenics.filter((scenic) => {
      if (regionId !== null && scenic.regionId !== regionId) return false;
      if (recommendedFilter !== null && Boolean(scenic.isRecommended) !== recommendedFilter) return false;
      if (!keyword) return true;
      const highlights = Array.isArray(scenic.highlights) ? scenic.highlights.join(' ') : '';
      return matchKeyword(keyword, scenic.name, scenic.description, highlights);
    });

    const items = filtered.map((scenic) => scenicView(scenic, memberId));
    items.sort(comparatorFor(sort));

    // 首页推荐位等场景用 limit 直接截断（等价于 pageSize=limit、page=1）
    const result = limit === null ? paginate(items, page, pageSize) : paginate(items, 1, limit);
    res.json(ok(result));
  }),
);

router.get(
  '/:id',
  optionalMember,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '景区不存在', 404);

    const scenic = db.data.scenics.find((item) => item.id === id);
    if (!scenic) throw new AppError(1002, '景区不存在', 404);

    const memberId = req.member ? req.member.id : null;
    const region = db.data.regions.find((item) => item.id === scenic.regionId);

    res.json(
      ok({
        scenic: scenicView(scenic, memberId),
        region: region ? regionView(region) : null,
      }),
    );
  }),
);

router.get(
  '/:id/travels',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '景区不存在', 404);

    const scenic = db.data.scenics.find((item) => item.id === id);
    if (!scenic) throw new AppError(1002, '景区不存在', 404);

    const limit = toInt(req.query.limit, 5, { min: 1, max: PAGE_SIZE.MAX });
    const all = db.data.travels
      .filter((item) => item.scenicId === id)
      .slice()
      .sort(byPublishedAtDesc)
      .map((item) => travelView(item));

    res.json(ok({ list: all.slice(0, limit), total: all.length }));
  }),
);

export default router;
