/**
 * 会员管理接口（F-26、F-27）—— 只读，不提供删除（PRD Q-01）
 * GET /api/admin/members      列表：keyword（会员名/手机号/邮箱）+ sortBy + order + 分页 10
 * GET /api/admin/members/:id  详情：资料 + 收藏景区 + 最近 10 条登录记录
 */

import { Router } from 'express';

import { publicMember, requireAdmin } from '../../auth.js';
import { MEMBER_SORT_FIELDS, PAGE_SIZE } from '../../constants.js';
import { db } from '../../db.js';
import { AppError, asyncHandler, matchKeyword, ok, paginate, parseId, parsePaging, trimText } from '../../utils.js';
import { scenicBrief } from '../shared.js';

const router = Router();

router.use(requireAdmin);

/**
 * @param {number} memberId
 * @returns {number}
 */
function favoriteCountOf(memberId) {
  return db.data.favorites.filter((item) => item.memberId === memberId).length;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.ADMIN_LIST);
    const keyword = trimText(req.query.keyword);
    const sortBy = trimText(req.query.sortBy) || 'id';
    const order = (trimText(req.query.order) || 'desc').toLowerCase();

    if (!MEMBER_SORT_FIELDS.includes(sortBy)) {
      throw new AppError(1001, '排序字段不合法', 400, { sortBy: '仅支持 id 或 createdAt' });
    }
    if (order !== 'asc' && order !== 'desc') {
      throw new AppError(1001, '排序方向不合法', 400, { order: '仅支持 asc 或 desc' });
    }

    const filtered = db.data.members.filter((member) => matchKeyword(keyword, member.username, member.phone, member.email));

    const sorted = filtered.slice().sort((a, b) => {
      let result = 0;
      if (sortBy === 'createdAt') {
        const left = Date.parse(a.createdAt || '') || 0;
        const right = Date.parse(b.createdAt || '') || 0;
        result = left - right;
      } else {
        result = a.id - b.id;
      }
      if (result === 0) result = a.id - b.id;
      return order === 'asc' ? result : -result;
    });

    const items = sorted.map((member) => publicMember(member, favoriteCountOf(member.id)));
    res.json(ok(paginate(items, page, pageSize)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) throw new AppError(1002, '会员不存在', 404);

    const member = db.data.members.find((item) => item.id === id);
    if (!member) throw new AppError(1002, '会员不存在', 404);

    const favorites = db.data.favorites
      .filter((item) => item.memberId === id)
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a.createdAt || '') || 0;
        const right = Date.parse(b.createdAt || '') || 0;
        if (right !== left) return right - left;
        return b.id - a.id;
      })
      .map((record) => {
        const scenic = db.data.scenics.find((item) => item.id === record.scenicId);
        if (!scenic) return null;
        return {
          ...scenicBrief(scenic),
          favoriteId: record.id,
          favoritedAt: record.createdAt,
        };
      })
      .filter((item) => item !== null);

    const loginLogs = db.data.memberLoginLogs
      .filter((log) => log.memberId === id || trimText(log.username) === trimText(member.username))
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a.createdAt || '') || 0;
        const right = Date.parse(b.createdAt || '') || 0;
        if (right !== left) return right - left;
        return b.id - a.id;
      })
      .slice(0, 10);

    res.json(
      ok({
        member: publicMember(member, favoriteCountOf(member.id)),
        favorites,
        loginLogs,
      }),
    );
  }),
);

export default router;
