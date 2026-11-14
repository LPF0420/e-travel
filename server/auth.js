/**
 * 鉴权内核：scrypt 加盐密码哈希 + HMAC-SHA256 无状态 token + 三个鉴权中间件。
 *
 * token 结构：`base64url(JSON payload).base64url(HMAC-SHA256(secret, base64url(payload)))`
 * payload = { sub, role, exp(秒) }，有效期 7 天。
 * 签名密钥优先级：process.env.ETRAVEL_SECRET → db.data.meta.secret（随数据落盘，重启不掉线）。
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';

import { ROLES, TOKEN_TTL_SECONDS } from './constants.js';
import { db } from './db.js';
import { AppError, asyncHandler } from './utils.js';

const scryptAsync = promisify(crypto.scrypt);

/** scrypt 参数（写入哈希串，便于将来升级参数时兼容旧哈希） */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * 生成密码哈希：`scrypt$N$r$p$salt(base64url)$hash(base64url)`。
 * @param {string} password 明文密码
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new AppError(1001, '密码不能为空', 400, { password: '密码不能为空' });
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    Buffer.from(salt).toString('base64url'),
    Buffer.from(derived).toString('base64url'),
  ].join('$');
}

/**
 * 校验密码（timingSafeEqual，长度不等直接判失败）。
 * @param {string} password 明文
 * @param {string} storedHash 存储的哈希串
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch (error) {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let derived;
  try {
    derived = await scryptAsync(password, salt, expected.length, { N: n, r, p });
  } catch (error) {
    return false;
  }
  const actual = Buffer.from(derived);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * 取签名密钥。
 * @returns {string}
 */
function getSecret() {
  const fromEnv = typeof process.env.ETRAVEL_SECRET === 'string' ? process.env.ETRAVEL_SECRET.trim() : '';
  if (fromEnv) return fromEnv;
  const fromData = db.data && db.data.meta ? db.data.meta.secret : '';
  if (typeof fromData === 'string' && fromData.length > 0) return fromData;
  throw new AppError(5000, '服务器密钥未初始化', 500);
}

/**
 * 把 JS 值序列化为 base64url 字符串。
 * @param {any} value
 * @returns {string}
 */
function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/**
 * 生成 HMAC 签名。
 * @param {string} body base64url(payload)
 * @returns {string} base64url(HMAC-SHA256)
 */
function signSegment(body) {
  return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
}

/**
 * 签发 token。
 * @param {{sub:number, role:'member'|'admin'}} input
 * @returns {string}
 */
export function signToken(input) {
  const payload = {
    sub: input.sub,
    role: input.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = encodeSegment(payload);
  return `${body}.${signSegment(body)}`;
}

/**
 * 校验 token：签名 + 结构 + 过期。
 * @param {string} token
 * @returns {{sub:number, role:string, exp:number}} payload
 * @throws {AppError} 2002 token 无效或已过期
 */
export function verifyToken(token) {
  const invalid = new AppError(2002, '登录状态已失效，请重新登录', 401);
  if (typeof token !== 'string' || token.trim() === '') throw invalid;
  const parts = token.trim().split('.');
  if (parts.length !== 2) throw invalid;
  const [body, signature] = parts;
  if (!body || !signature) throw invalid;

  const expected = signSegment(body);
  const actualBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) throw invalid;
  if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) throw invalid;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (error) {
    throw invalid;
  }
  if (!payload || typeof payload !== 'object') throw invalid;
  if (payload.role !== ROLES.MEMBER && payload.role !== ROLES.ADMIN) throw invalid;
  if (!Number.isInteger(payload.sub) || payload.sub <= 0) throw invalid;
  if (!Number.isFinite(payload.exp)) throw invalid;
  if (payload.exp * 1000 <= Date.now()) throw invalid;
  return payload;
}

/**
 * 从请求头读取 Bearer token。
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function readBearerToken(req) {
  const header = req.headers ? req.headers.authorization : '';
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token === '' ? null : token;
}

/**
 * 会员出参投影：剔除 passwordHash，附加派生收藏数。
 * @param {object} member
 * @param {number} [favoriteCount]
 * @returns {object}
 */
export function publicMember(member, favoriteCount) {
  if (!member) return null;
  const { passwordHash, ...rest } = member;
  const view = {
    id: rest.id,
    username: rest.username,
    phone: rest.phone,
    email: rest.email,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
  if (favoriteCount !== undefined) view.favoriteCount = favoriteCount;
  return view;
}

/**
 * 管理员出参投影：剔除 passwordHash。
 * @param {object} admin
 * @returns {object}
 */
export function publicAdmin(admin) {
  if (!admin) return null;
  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    lastLoginAt: admin.lastLoginAt || null,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

/**
 * 按 id 查会员（内部使用，含 passwordHash）。
 * @param {number} id
 * @returns {object|undefined}
 */
function findMemberById(id) {
  return db.data.members.find((item) => item.id === id);
}

/**
 * 按 id 查管理员（内部使用，含 passwordHash）。
 * @param {number} id
 * @returns {object|undefined}
 */
function findAdminById(id) {
  return db.data.admins.find((item) => item.id === id);
}

/**
 * 会员必填中间件：缺失 → 2001，签名错/过期/账号不存在 → 2002，角色不符 → 2004。
 * 成功后挂 `req.member`（已投影，不含 passwordHash）与 `req.auth`。
 */
export const requireMember = asyncHandler(async (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) throw new AppError(2001, '请先登录', 401);
  const payload = verifyToken(token);
  if (payload.role !== ROLES.MEMBER) {
    throw new AppError(2004, '无权访问该资源', 403);
  }
  const member = findMemberById(payload.sub);
  if (!member) throw new AppError(2002, '登录状态已失效，请重新登录', 401);
  req.auth = payload;
  req.member = publicMember(member);
  next();
});

/**
 * 管理员必填中间件：**显式校验 role === 'admin'**，防止会员 token 混入后台。
 * 缺失 → 2001；签名错/过期/账号不存在 → 2002；角色不符（如误用会员 token）→ 2004。
 */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) throw new AppError(2001, '请先登录', 401);
  const payload = verifyToken(token);
  if (payload.role !== ROLES.ADMIN) {
    throw new AppError(2004, '无权访问该资源', 403);
  }
  const admin = findAdminById(payload.sub);
  if (!admin) throw new AppError(2002, '登录状态已失效，请重新登录', 401);
  req.auth = payload;
  req.admin = publicAdmin(admin);
  next();
});

/**
 * 可选会员中间件：有任何问题一律按游客处理，**绝不抛错、绝不 500**。
 * 成功后挂 `req.member`；否则 `req.member = null`。
 */
export function optionalMember(req, res, next) {
  req.member = null;
  let token = null;
  try {
    token = readBearerToken(req);
  } catch (error) {
    token = null;
  }
  if (!token) {
    next();
    return;
  }
  let payload = null;
  try {
    payload = verifyToken(token);
  } catch (error) {
    payload = null;
  }
  if (!payload || payload.role !== ROLES.MEMBER) {
    next();
    return;
  }
  try {
    const member = findMemberById(payload.sub);
    if (member) {
      req.member = publicMember(member);
      req.auth = payload;
    }
  } catch (error) {
    req.member = null;
  }
  next();
}
