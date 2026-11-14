/**
 * 日志查询接口（F-43~F-46）—— 只读，无编辑/删除入口。
 * GET /api/admin/logs/operations      ?module&action&result&startDate&endDate&page&pageSize
 * GET /api/admin/logs/admins          ?event&startDate&endDate&page&pageSize
 * GET /api/admin/logs/member-logins   ?result&keyword&startDate&endDate&page&pageSize
 * 分页默认 20，时间范围按本地日切分（startDate 含当日 00:00，endDate 含当日 23:59:59.999）。
 */

import { Router } from 'express';

import { requireAdmin } from '../../auth.js';
import { ADMIN_LOG_EVENTS, LOG_ACTIONS, LOG_MODULES, LOG_RESULTS, PAGE_SIZE } from '../../constants.js';
import { db } from '../../db.js';
import {
  AppError,
  asyncHandler,
  inDateRange,
  matchKeyword,
  ok,
  paginate,
  parseDateRange,
  parsePaging,
  trimText,
} from '../../utils.js';

const router = Router();

router.use(requireAdmin);

/**
 * 通用倒序比较（时间倒序 → id 倒序）。
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function byCreatedAtDesc(a, b) {
  const left = Date.parse(a.createdAt || '') || 0;
  const right = Date.parse(b.createdAt || '') || 0;
  if (right !== left) return right - left;
  return b.id - a.id;
}

router.get(
  '/operations',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.LOGS);
    const module = trimText(req.query.module);
    const action = trimText(req.query.action);
    const result = trimText(req.query.result);
    const range = parseDateRange(req.query.startDate, req.query.endDate);

    if (module && !LOG_MODULES.includes(module)) {
      throw new AppError(1001, '模块参数不合法', 400, { module: `仅支持 ${LOG_MODULES.join('/')}` });
    }
    if (action && !LOG_ACTIONS.includes(action)) {
      throw new AppError(1001, '动作参数不合法', 400, { action: `仅支持 ${LOG_ACTIONS.join('/')}` });
    }
    if (result && !LOG_RESULTS.includes(result)) {
      throw new AppError(1001, '结果参数不合法', 400, { result: '仅支持 success 或 fail' });
    }

    const filtered = db.data.operationLogs.filter((log) => {
      if (module && log.module !== module) return false;
      if (action && log.action !== action) return false;
      if (result && log.result !== result) return false;
      return inDateRange(log.createdAt, range);
    });

    res.json(ok(paginate(filtered.slice().sort(byCreatedAtDesc), page, pageSize)));
  }),
);

router.get(
  '/admins',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.LOGS);
    const event = trimText(req.query.event);
    const range = parseDateRange(req.query.startDate, req.query.endDate);

    if (event && !ADMIN_LOG_EVENTS.includes(event)) {
      throw new AppError(1001, '事件参数不合法', 400, { event: `仅支持 ${ADMIN_LOG_EVENTS.join('/')}` });
    }

    const filtered = db.data.adminLogs.filter((log) => {
      if (event && log.event !== event) return false;
      return inDateRange(log.createdAt, range);
    });

    res.json(ok(paginate(filtered.slice().sort(byCreatedAtDesc), page, pageSize)));
  }),
);

router.get(
  '/member-logins',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.LOGS);
    const result = trimText(req.query.result);
    const keyword = trimText(req.query.keyword);
    const range = parseDateRange(req.query.startDate, req.query.endDate);

    if (result && !LOG_RESULTS.includes(result)) {
      throw new AppError(1001, '结果参数不合法', 400, { result: '仅支持 success 或 fail' });
    }

    const filtered = db.data.memberLoginLogs.filter((log) => {
      if (result && log.result !== result) return false;
      if (keyword && !matchKeyword(keyword, log.username)) return false;
      return inDateRange(log.createdAt, range);
    });

    res.json(ok(paginate(filtered.slice().sort(byCreatedAtDesc), page, pageSize)));
  }),
);

export default router;
