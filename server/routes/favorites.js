/**
 * 收藏接口（F-11、F-12、F-16），全部需要会员 token。
 * GET    /api/favorites            收藏列表（分页，含景区完整字段 + favoriteId/favoritedAt）
 * POST   /api/favorites            收藏（`(memberId, scenicId)` 业务唯一，重复不新增 → created:false）
 * DELETE /api/favorites/:scenicId  取消收藏（不存在也返回成功，幂等）
 */

import { Router } from 'express';

import { requireMember } from '../auth.js';
import { PAGE_SIZE } from '../constants.js';
import { db } from '../db.js';
import {
  AppError,
  asyncHandler,
  createFieldErrors,
  nowIso,
  ok,
  paginate,
  parseId,
  parsePaging,
} from '../utils.js';
import { favoriteCountOf, findScenic, scenicView } from './shared.js';

const router = Router();

router.get(
  '/',
  requireMember,
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.FAVORITES);
    const memberId = req.member.id;

    const records = db.data.favorites
      .filter((item) => item.memberId === memberId)
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a.createdAt || '') || 0;
        const right = Date.parse(b.createdAt || '') || 0;
        if (right !== left) return right - left;
        return b.id - a.id;
      });

    const items = records
      .map((record) => {
        const scenic = findScenic(record.scenicId);
        if (!scenic) return null;
        return {
          ...scenicView(scenic, memberId),
          favoriteId: record.id,
          favoritedAt: record.createdAt,
        };
      })
      .filter((item) => item !== null);

    res.json(ok(paginate(items, page, pageSize)));
  }),
);

router.post(
  '/',
  requireMember,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const scenicId = parseId(body.scenicId);
    if (scenicId === null) {
      throw new AppError(1001, '请选择要收藏的景区', 400, { scenicId: '请选择要收藏的景区' });
    }

    const scenic = findScenic(scenicId);
    if (!scenic) throw new AppError(1002, '景区不存在', 404);

    const memberId = req.member.id;
    const existing = db.data.favorites.find((item) => item.memberId === memberId && item.scenicId === scenicId);

    let created = false;
    if (!existing) {
      db.data.favorites.push({
        id: db.nextId('favorites'),
        memberId,
        scenicId,
        createdAt: nowIso(),
      });
      await db.save();
      created = true;
    }

    res.json(
      ok(
        {
          created,
          favorited: true,
          favoriteCount: favoriteCountOf(scenicId),
        },
        created ? '收藏成功' : '已收藏过该景区',
      ),
    );
  }),
);

router.delete(
  '/:scenicId',
  requireMember,
  asyncHandler(async (req, res) => {
    const scenicId = parseId(req.params.scenicId);
    const fields = createFieldErrors();
    if (scenicId === null) fields.add('scenicId', '景区 ID 不合法');
    fields.throwIfInvalid();

    const memberId = req.member.id;
    const index = db.data.favorites.findIndex((item) => item.memberId === memberId && item.scenicId === scenicId);
    if (index >= 0) {
      db.data.favorites.splice(index, 1);
      await db.save();
    }

    res.json(
      ok(
        {
          favorited: false,
          removed: index >= 0,
          favoriteCount: favoriteCountOf(scenicId),
        },
        '已取消收藏',
      ),
    );
  }),
);

export default router;
