/**
 * 会员侧账号接口（F-01~F-04、F-45）
 * POST /api/auth/register  注册并自动登录
 * POST /api/auth/login     登录（成功/失败均写会员登录日志）
 * GET  /api/auth/me        当前会员（会员必填）
 * POST /api/auth/logout    退出（无状态 token，服务端仅回包）
 */

import { Router } from 'express';

import { hashPassword, publicMember, requireMember, signToken, verifyPassword } from '../auth.js';
import { ROLES } from '../constants.js';
import { db } from '../db.js';
import { writeMemberLoginLog } from '../logs.js';
import {
  AppError,
  asyncHandler,
  clientIp,
  createFieldErrors,
  isEmailOk,
  isPasswordOk,
  isPhoneOk,
  isUsernameOk,
  nowIso,
  ok,
  trimText,
} from '../utils.js';

const router = Router();

/**
 * 按会员名查会员（去首尾空格比对）。
 * @param {string} username
 * @returns {object|undefined}
 */
function findMemberByUsername(username) {
  const target = trimText(username);
  if (!target) return undefined;
  return db.data.members.find((item) => trimText(item.username) === target);
}

/**
 * 统计某会员的收藏数。
 * @param {number} memberId
 * @returns {number}
 */
function favoriteCountOf(memberId) {
  return db.data.favorites.filter((item) => item.memberId === memberId).length;
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username = trimText(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';
    const phone = trimText(body.phone);
    const email = trimText(body.email);

    const fields = createFieldErrors();
    if (!isUsernameOk(username)) fields.add('username', '请输入 2–20 字的会员名');
    if (!isPasswordOk(password)) fields.add('password', '密码长度需为 6–20 位');
    // 确认密码必须单独判空：两个密码字段同时为空时，`confirmPassword !== password` 会因 '' === '' 放过，
    // 导致 5 个必填字段里漏掉 confirmPassword 的字段级提示（PRD F-01①）。
    if (!confirmPassword) {
      fields.add('confirmPassword', '请再次输入密码');
    } else if (confirmPassword !== password) {
      fields.add('confirmPassword', '两次输入的密码不一致');
    }
    if (!isPhoneOk(phone)) fields.add('phone', '请输入 11 位有效手机号');
    if (!isEmailOk(email)) fields.add('email', '请输入有效的邮箱地址');
    fields.throwIfInvalid();

    if (findMemberByUsername(username)) {
      throw new AppError(1003, '该会员名已被注册', 409, { username: '该会员名已被注册' });
    }

    const passwordHash = await hashPassword(password);
    const now = nowIso();
    const member = {
      id: db.nextId('members'),
      username,
      passwordHash,
      phone,
      email,
      createdAt: now,
      updatedAt: now,
    };
    db.data.members.push(member);
    await db.save();

    const token = signToken({ sub: member.id, role: ROLES.MEMBER });
    res.status(201).json(ok({ token, member: publicMember(member, 0) }, '注册成功'));
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username = trimText(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const ip = clientIp(req);

    const fields = createFieldErrors();
    if (!username) fields.add('username', '请输入会员名');
    if (!password) fields.add('password', '请输入密码');
    fields.throwIfInvalid();

    const member = findMemberByUsername(username);
    if (!member) {
      await writeMemberLoginLog({ username, memberId: null, result: 'fail', message: '会员不存在', ip });
      throw new AppError(2003, '会员名或密码错误', 401);
    }

    const matched = await verifyPassword(password, member.passwordHash);
    if (!matched) {
      await writeMemberLoginLog({ username, memberId: null, result: 'fail', message: '密码错误', ip });
      throw new AppError(2003, '会员名或密码错误', 401);
    }

    await writeMemberLoginLog({ username: member.username, memberId: member.id, result: 'success', message: '', ip });

    const token = signToken({ sub: member.id, role: ROLES.MEMBER });
    res.json(ok({ token, member: publicMember(member, favoriteCountOf(member.id)) }, '登录成功'));
  }),
);

router.get(
  '/me',
  requireMember,
  asyncHandler(async (req, res) => {
    const member = db.data.members.find((item) => item.id === req.member.id);
    if (!member) throw new AppError(2002, '登录状态已失效，请重新登录', 401);
    res.json(ok({ member: publicMember(member, favoriteCountOf(member.id)) }));
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // 无状态 token：服务端无会话可销毁，前端清 localStorage 即可
    res.json(ok(null, '已退出登录'));
  }),
);

export default router;
