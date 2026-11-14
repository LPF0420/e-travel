/**
 * 下拉选项接口（F-35 地区下拉、F-40 景区/作者下拉）
 * GET /api/admin/options?type=regions|scenics|members
 * → { list: [{ value, label, extra? }] }
 */

import { Router } from 'express';

import { requireAdmin } from '../../auth.js';
import { db } from '../../db.js';
import { AppError, asyncHandler, ok, trimText } from '../../utils.js';

const router = Router();

router.use(requireAdmin);

const ALLOWED_TYPES = ['regions', 'scenics', 'members'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const type = trimText(req.query.type);
    if (!ALLOWED_TYPES.includes(type)) {
      throw new AppError(1001, '请提供合法的 type 参数（regions/scenics/members）', 400, {
        type: 'type 需为 regions、scenics 或 members',
      });
    }

    let list = [];
    if (type === 'regions') {
      list = db.data.regions
        .slice()
        .sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || a.id - b.id)
        .map((region) => ({ value: region.id, label: region.name }));
    } else if (type === 'scenics') {
      list = db.data.scenics
        .slice()
        .sort((a, b) => b.id - a.id)
        .map((scenic) => {
          const region = db.data.regions.find((item) => item.id === scenic.regionId);
          return {
            value: scenic.id,
            label: scenic.name,
            extra: region ? region.name : '',
          };
        });
    } else {
      list = db.data.members
        .slice()
        .sort((a, b) => b.id - a.id)
        .map((member) => ({ value: member.id, label: member.username }));
    }

    res.json(ok({ list, total: list.length, type }));
  }),
);

export default router;
