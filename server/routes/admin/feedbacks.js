/**
 * 意见建议管理接口（F-28、F-29）
 * GET   /api/admin/feedbacks     列表：status 筛选 + 分页 10 + pendingCount，按提交时间倒序
 * PATCH /api/admin/feedbacks/:id 标记状态（pending/resolved，写 handledAt）
 */

import { Router } from 'express';

import { requireAdmin } from '../../auth.js';
import { FEEDBACK_STATUS, PAGE_SIZE } from '../../constants.js';
import { db } from '../../db.js';
import {
  AppError,
  asyncHandler,
  createFieldErrors,
  nowIso,
  ok,
  paginate,
  parseId,
  parsePaging,
  trimText,
} from '../../utils.js';

const router = Router();

router.use(requireAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePaging(req.query, PAGE_SIZE.ADMIN_LIST);
    const status = trimText(req.query.status);

    if (status && status !== FEEDBACK_STATUS.PENDING && status !== FEEDBACK_STATUS.RESOLVED) {
      throw new AppError(1001, '状态参数不合法', 400, { status: '仅支持 pending 或 resolved' });
    }

    const filtered = db.data.feedbacks.filter((item) => (status ? item.status === status : true));
    const sorted = filtered.slice().sort((a, b) => {
      const left = Date.parse(a.createdAt || '') || 0;
      const right = Date.parse(b.createdAt || '') || 0;
      if (right !== left) return right - left;
      return b.id - a.id;
    });

    const pendingCount = db.data.feedbacks.filter((item) => item.status === FEEDBACK_STATUS.PENDING).length;

    res.json(
      ok({
        ...paginate(sorted, page, pageSize),
        pendingCount,
      }),
    );
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const fields = createFieldErrors();
    const status = trimText((req.body || {}).status);
    if (id === null) fields.add('id', '意见 ID 不合法');
    if (status !== FEEDBACK_STATUS.PENDING && status !== FEEDBACK_STATUS.RESOLVED) {
      fields.add('status', '状态需为 pending 或 resolved');
    }
    fields.throwIfInvalid();

    const feedback = db.data.feedbacks.find((item) => item.id === id);
    if (!feedback) throw new AppError(1002, '意见建议不存在', 404);

    feedback.status = status;
    feedback.handledAt = status === FEEDBACK_STATUS.RESOLVED ? nowIso() : null;
    await db.save();

    res.json(
      ok(
        { id: feedback.id, status: feedback.status, handledAt: feedback.handledAt },
        status === FEEDBACK_STATUS.RESOLVED ? '已标记为已处理' : '已标记为未处理',
      ),
    );
  }),
);

export default router;
