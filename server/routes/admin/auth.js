/**
 * 后台账号接口（F-20~F-23、F-44）
 * POST /api/admin/auth/login     登录（成功/失败均写管理员日志）
 * POST /api/admin/auth/logout    退出（写 logout 日志）
 * GET  /api/admin/auth/me        当前管理员
 * PUT  /api/admin/auth/password  改密（原密码校验 → 写 change_password 日志 → 前端强制重登）
 *
 * 设计要点：登录路由免鉴权；其余路由统一 `router.use(requireAdmin)`，
 * 且 requireAdmin 显式校验 role === 'admin'，会员 token 一律 403。
 */

import { Router } from 'express';

import { hashPassword, publicAdmin, requireAdmin, signToken, verifyPassword } from '../../auth.js';
import { ROLES } from '../../constants.js';
import { db } from '../../db.js';
import { writeAdminLog } from '../../logs.js';
import {
  AppError,
  asyncHandler,
  clientIp,
  createFieldErrors,
  isPasswordOk,
  nowIso,
  ok,
  trimText,
} from '../../utils.js';

const router = Router();

/**
 * @param {string} username
 * @returns {object|undefined}
 */
function findAdminByUsername(username) {
  const target = trimText(username);
  if (!target) return undefined;
  return db.data.admins.find((item) => trimText(item.username) === target);
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const username = trimText(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    const ip = clientIp(req);

    const fields = createFieldErrors();
    if (!username) fields.add('username', '请输入管理员账号');
    if (!password) fields.add('password', '请输入密码');
    fields.throwIfInvalid();

    const admin = findAdminByUsername(username);
    if (!admin) {
      await writeAdminLog({ username, adminId: null, event: 'login_fail', result: 'fail', message: '账号或密码错误', ip });
      throw new AppError(2003, '账号或密码错误', 401);
    }

    const matched = await verifyPassword(password, admin.passwordHash);
    if (!matched) {
      await writeAdminLog({ username, adminId: null, event: 'login_fail', result: 'fail', message: '账号或密码错误', ip });
      throw new AppError(2003, '账号或密码错误', 401);
    }

    const now = nowIso();
    admin.lastLoginAt = now;
    admin.updatedAt = now;
    await db.save();
    await writeAdminLog({ username: admin.username, adminId: admin.id, event: 'login', result: 'success', message: '', ip });

    const token = signToken({ sub: admin.id, role: ROLES.ADMIN });
    res.json(ok({ token, admin: publicAdmin(admin) }, '登录成功'));
  }),
);

router.use(requireAdmin);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await writeAdminLog({
      username: req.admin.username,
      adminId: req.admin.id,
      event: 'logout',
      result: 'success',
      message: '',
      ip: clientIp(req),
    });
    res.json(ok(null, '已退出登录'));
  }),
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const admin = db.data.admins.find((item) => item.id === req.admin.id);
    if (!admin) throw new AppError(2002, '登录状态已失效，请重新登录', 401);
    res.json(ok({ admin: publicAdmin(admin) }));
  }),
);

router.put(
  '/password',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

    const fields = createFieldErrors();
    if (!oldPassword) fields.add('oldPassword', '请输入原密码');
    if (!isPasswordOk(newPassword)) fields.add('newPassword', '密码长度需为 6–20 位');
    if (confirmPassword !== newPassword) fields.add('confirmPassword', '两次输入的密码不一致');
    fields.throwIfInvalid();

    const admin = db.data.admins.find((item) => item.id === req.admin.id);
    if (!admin) throw new AppError(2002, '登录状态已失效，请重新登录', 401);

    const matched = await verifyPassword(oldPassword, admin.passwordHash);
    if (!matched) {
      throw new AppError(2005, '原密码不正确', 400, { oldPassword: '原密码不正确' });
    }

    admin.passwordHash = await hashPassword(newPassword);
    admin.updatedAt = nowIso();
    await db.save();
    await writeAdminLog({
      username: admin.username,
      adminId: admin.id,
      event: 'change_password',
      result: 'success',
      message: '',
      ip: clientIp(req),
    });
    // 账号安全事件只入管理员日志（DESIGN §7.6：change_password → writeAdminLog）
    res.json(ok({ reloginRequired: true }, '密码已修改，请重新登录'));
  }),
);

export default router;
