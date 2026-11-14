/**
 * 路由总装配：
 * - `/api` 公开 + 会员侧 16 个接口
 * - `/api/admin` 后台 29 个接口（全部走 requireAdmin，登录接口除外）
 * - 末尾 `/api` 通配 404（JSON），确保未命中的 API 请求不会被 SPA 回落吃掉。
 */

import { Router } from 'express';

import { fail, nowIso, ok } from '../utils.js';
import adminAuthRoutes from './admin/auth.js';
import adminDashboardRoutes from './admin/dashboard.js';
import adminFeedbacksRoutes from './admin/feedbacks.js';
import adminLogsRoutes from './admin/logs.js';
import adminMembersRoutes from './admin/members.js';
import adminOptionsRoutes from './admin/options.js';
import adminRegionsRoutes from './admin/regions.js';
import adminScenicsRoutes from './admin/scenics.js';
import adminTravelsRoutes from './admin/travels.js';
import authRoutes from './auth.js';
import favoritesRoutes from './favorites.js';
import feedbacksRoutes from './feedbacks.js';
import regionsRoutes from './regions.js';
import scenicsRoutes from './scenics.js';
import statsRoutes from './stats.js';
import travelsRoutes from './travels.js';

const router = Router();

/** 健康检查：前端/运维探活使用 */
router.get('/health', (req, res) => {
  res.json(ok({ status: 'ok', time: nowIso(), uptime: Math.round(process.uptime()) }, 'ok'));
});

/* ---------------- C 端 ---------------- */
router.use('/auth', authRoutes);
router.use('/favorites', favoritesRoutes);
router.use('/feedbacks', feedbacksRoutes);
router.use('/regions', regionsRoutes);
router.use('/scenics', scenicsRoutes);
router.use('/travels', travelsRoutes);
router.use('/stats', statsRoutes);

/* ---------------- B 端 ---------------- */
const adminRouter = Router();

adminRouter.use('/auth', adminAuthRoutes);
adminRouter.use('/dashboard', adminDashboardRoutes);
adminRouter.use('/options', adminOptionsRoutes);
adminRouter.use('/members', adminMembersRoutes);
adminRouter.use('/feedbacks', adminFeedbacksRoutes);
adminRouter.use('/logs', adminLogsRoutes);
adminRouter.use('/regions', adminRegionsRoutes);
adminRouter.use('/scenics', adminScenicsRoutes);
adminRouter.use('/travels', adminTravelsRoutes);

// 后台未命中的子路径同样返回 JSON 404（而不是落到 C 端通配）
adminRouter.use((req, res) => {
  res.status(404).json(fail(1002, '接口不存在', null));
});

router.use('/admin', adminRouter);

/** /api 通配 404：必须是 JSON 包，避免前端 res.json() 抛 SyntaxError */
router.use((req, res) => {
  res.status(404).json(fail(1002, '接口不存在', null));
});

export default router;
