/**
 * 游记接口（F-14、F-15）
 * GET /api/travels      列表（publishedAt 倒序，可 ?scenicId，分页默认 6，支持 ?limit=N 取前 N 条）
 * GET /api/travels/:id  详情 + 所属景区 + 相关游记（最多 3 篇）
 */

import { Router } from 'express';

import { PAGE_SIZE } from '../constants.js';
import { db } from '../db.js';
import { AppError, asyncHandler, ok, paginate, parseId, parsePaging, toInt } from '../utils.js';
import { byPublishedAtDesc, findScenic, scenicBrief, travelView } from './shared.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.TRAVELS);
    // limit 型取数（首页「最新游记 3 条」不翻页）：等价于 pageSize=limit、page=1
    const limit = toInt(req.query.limit, null, { min: 1, max: PAGE_SIZE.MAX });

    let scenicId = null;
    if (req.query.scenicId !== undefined && String(req.query.scenicId).trim() !== '') {
      scenicId = parseId(req.query.scenicId);
      if (scenicId === null) {
        throw new AppError(1001, '景区参数不合法', 400, { scenicId: '景区参数不合法' });
      }
    }

    const all = db.data.travels
      .filter((item) => (scenicId === null ? true : item.scenicId === scenicId))
      .slice()
      .sort(byPublishedAtDesc)
      .map((item) => travelView(item));

    res.json(ok(limit === null ? paginate(all, page, pageSize) : paginate(all, 1, limit)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '游记不存在', 404);

    const travel = db.data.travels.find((item) => item.id === id);
    if (!travel) throw new AppError(1002, '游记不存在', 404);

    const scenic = findScenic(travel.scenicId);

    const sameScenic = db.data.travels
      .filter((item) => item.scenicId === travel.scenicId && item.id !== travel.id)
      .slice()
      .sort(byPublishedAtDesc);

    // 同景区不足 3 篇时，用最新游记补足，保证「相关推荐」不空
    const related = sameScenic.slice(0, 3);
    if (related.length < 3) {
      const others = db.data.travels
        .filter((item) => item.id !== travel.id && item.scenicId !== travel.scenicId)
        .slice()
        .sort(byPublishedAtDesc);
      for (const item of others) {
        if (related.length >= 3) break;
        related.push(item);
      }
    }

    res.json(
      ok({
        travel: travelView(travel),
        scenic: scenic ? scenicBrief(scenic) : null,
        related: related.map((item) => travelView(item)),
      }),
    );
  }),
);

export default router;
