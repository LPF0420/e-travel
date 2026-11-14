/**
 * 仪表盘接口（F-25）
 * GET /api/admin/dashboard
 * → { stats: { regionCount, scenicCount, travelCount, memberCount, pendingFeedbackCount, todayMemberLoginCount },
 *     recentLogs: 最近 8 条操作日志 }
 */

import { Router } from 'express';

import { requireAdmin } from '../../auth.js';
import { FEEDBACK_STATUS } from '../../constants.js';
import { db } from '../../db.js';
import { asyncHandler, ok } from '../../utils.js';

const router = Router();

router.use(requireAdmin);

/**
 * 取「今日」起点（本地时区 00:00:00.000）。
 * @returns {number} 毫秒时间戳
 */
function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const todayStart = startOfToday();

    const todayMemberLoginCount = db.data.memberLoginLogs.filter((log) => {
      if (log.result !== 'success') return false;
      const time = Date.parse(log.createdAt || '');
      return !Number.isNaN(time) && time >= todayStart;
    }).length;

    const stats = {
      regionCount: db.data.regions.length,
      scenicCount: db.data.scenics.length,
      travelCount: db.data.travels.length,
      memberCount: db.data.members.length,
      pendingFeedbackCount: db.data.feedbacks.filter((item) => item.status === FEEDBACK_STATUS.PENDING).length,
      todayMemberLoginCount,
    };

    const recentLogs = db.data.operationLogs
      .slice()
      .sort((a, b) => {
        const left = Date.parse(a.createdAt || '') || 0;
        const right = Date.parse(b.createdAt || '') || 0;
        if (right !== left) return right - left;
        return b.id - a.id;
      })
      .slice(0, 8);

    res.json(ok({ stats, recentLogs }));
  }),
);

export default router;
