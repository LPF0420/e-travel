/**
 * 意见反馈接口（F-19）
 * POST /api/feedbacks（可选会员：登录会员提交时写入 memberId，游客为 null）
 */

import { Router } from 'express';

import { optionalMember } from '../auth.js';
import { FEEDBACK_STATUS } from '../constants.js';
import { db } from '../db.js';
import { asyncHandler, createFieldErrors, isPhoneOk, isEmailOk, nowIso, ok, trimText } from '../utils.js';

const router = Router();

router.post(
  '/',
  optionalMember,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const nickname = trimText(body.nickname);
    const contact = trimText(body.contact);
    const content = trimText(body.content);

    const fields = createFieldErrors();
    if (nickname.length < 2 || nickname.length > 20) {
      fields.add('nickname', '请输入 2–20 字的昵称');
    }
    if (contact.length < 2 || contact.length > 50) {
      fields.add('contact', '请填写 2–50 字的联系方式（手机号或邮箱）');
    }
    if (content.length < 5 || content.length > 300) {
      fields.add('content', '留言内容需 5–300 字');
    }
    fields.throwIfInvalid();

    const now = nowIso();
    const feedback = {
      id: db.nextId('feedbacks'),
      nickname,
      contact,
      content,
      status: FEEDBACK_STATUS.PENDING,
      memberId: req.member ? req.member.id : null,
      createdAt: now,
      handledAt: null,
    };
    db.data.feedbacks.push(feedback);
    await db.save();

    // 联系方式只做形态提示，不做真实性校验（PRD：不做验证）
    const contactLooksLikePhone = isPhoneOk(contact);
    const contactLooksLikeEmail = isEmailOk(contact);

    res.status(201).json(
      ok(
        {
          id: feedback.id,
          createdAt: feedback.createdAt,
          contactLooksLikePhone,
          contactLooksLikeEmail,
        },
        '感谢反馈，我们会尽快处理',
      ),
    );
  }),
);

export default router;
