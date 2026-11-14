/**
 * 公开统计接口（F-17）
 * GET /api/stats/public → { regionCount, scenicCount, travelCount }
 */

import { Router } from 'express';

import { db } from '../db.js';
import { asyncHandler, ok } from '../utils.js';

const router = Router();

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    res.json(
      ok({
        regionCount: db.data.regions.length,
        scenicCount: db.data.scenics.length,
        travelCount: db.data.travels.length,
      }),
    );
  }),
);

export default router;
