/**
 * 极简测试内核 + HTTP 客户端（QA 独立复核用）。
 *
 * 设计原则：
 * 1. 不引入外部测试框架（无 vitest/jest/mocha），只用 `node:assert/strict` + 裸 fetch。
 * 2. 顺序执行、单进程：便于「先建后删」的链路用例共享上下文，也便于 finally 里恢复 db.json。
 * 3. 断言失败即抛错，runner 记录到 failures，不中断后续用例（拿到全量缺陷面）。
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 项目根目录与关键文件路径（tests/api/lib → 项目根） */
export const PATHS = {
  root: path.resolve(HERE, '../../..'),
  /** 当前被断言的数据文件（默认联调库；run.mjs 会切到隔离库） */
  dbFile: path.resolve(HERE, '../../../server/data/db.json'),
  backupFile: path.resolve(HERE, '../../../server/data/db.test-backup.json'),
  /** 联调库固定路径，隔离模式下用于「确认它没被改动」 */
  sharedDbFile: path.resolve(HERE, '../../../server/data/db.json'),
};

/**
 * 把断言目标 db 文件切到隔离副本（配合服务端 ETRAVEL_DB_FILE），
 * 使 readDb()/审计函数读的是本次运行真正使用的那个文件。
 * @param {string} filePath 绝对路径
 * @returns {void}
 */
export function setDbFile(filePath) {
  PATHS.dbFile = path.resolve(filePath);
}

/** 种子账号（真实口令见 README.md:40-42 / DESIGN.md:1269-1271 / seed.js:688） */
export const CREDS = {
  admin: { username: 'admin', password: process.env.ETRAVEL_ADMIN_PASSWORD || 'admin123' },
  member: { username: '林小满', password: process.env.ETRAVEL_MEMBER_PASSWORD || '123456' },
};

/** 共享上下文：各 suite 之间传递 token / 新建资源 id */
export const state = {
  base: (process.env.API_BASE || 'http://127.0.0.1:3101').replace(/\/$/, ''),
  secret: '',
  adminToken: null,
  memberToken: null,
  ids: {},
  totals: {},
};

/**
 * 注册一个测试套件。
 * @param {string} name 套件名（报告分组用）
 * @param {(ctx: {test: Function, beforeAll: Function}) => void} register 注册函数
 * @returns {{name: string, beforeAll: Function[], tests: {title: string, fn: Function}[]}}
 */
export function defineSuite(name, register) {
  const tests = [];
  const hooks = [];
  register({
    test(title, fn) {
      tests.push({ title, fn });
    },
    beforeAll(fn) {
      hooks.push(fn);
    },
  });
  return { name, beforeAll: hooks, tests };
}

/**
 * 发 HTTP 请求并尽量解析 JSON（解析失败给 null，绝不抛错）。
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} apiPath
 * @param {{body?: any, raw?: string, token?: string|null, headers?: Record<string,string>}} [options]
 * @returns {Promise<{status:number, json:any, text:string, contentType:string, headers:Headers}>}
 */
export async function api(method, apiPath, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let body;
  if (options.raw !== undefined) body = options.raw;
  else if (options.body !== undefined) body = JSON.stringify(options.body);

  const response = await fetch(`${state.base}${apiPath}`, { method, headers, body });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: response.status,
    json,
    text,
    contentType: response.headers.get('content-type') || '',
    headers: response.headers,
  };
}

/**
 * 断言响应为 JSON 且 code = 0，返回 data。
 * @param {{json:any,text:string,status:number}} res
 * @param {string} label 断言标签（失败信息可读）
 * @returns {any}
 */
export function expectOk(res, label) {
  assert.ok(res.json !== null, `${label}：响应不是 JSON（HTTP ${res.status}，body=${res.text.slice(0, 160)}）`);
  assert.equal(res.json.code, 0, `${label}：期望 code=0，实际 code=${res.json.code}（${res.json.message}）`);
  return res.json.data;
}

/**
 * 断言响应为 JSON 且 code 等于期望值。
 * @param {{json:any,text:string,status:number}} res
 * @param {number} code 业务错误码
 * @param {string} label
 * @returns {any} 响应 data
 */
export function expectFail(res, code, label) {
  assert.ok(res.json !== null, `${label}：期望 JSON 错误包，实际不是 JSON（HTTP ${res.status}，body=${res.text.slice(0, 160)}）`);
  assert.equal(
    res.json.code,
    code,
    `${label}：期望 code=${code}，实际 code=${res.json.code}（${res.json.message}，HTTP ${res.status}）`,
  );
  return res.json.data;
}

/**
 * 断言 HTTP 状态码。
 * @param {{status:number}} res
 * @param {number} status
 * @param {string} label
 */
export function expectStatus(res, status, label) {
  assert.equal(res.status, status, `${label}：期望 HTTP ${status}，实际 HTTP ${res.status}`);
}

/**
 * 断言列表按指定比较器相邻有序。
 * @param {any[]} list
 * @param {(a:any,b:any)=>number} cmp 期望的排序比较函数（返回值 <= 0 表示 a 应在前）
 * @param {string} label
 */
export function expectSorted(list, cmp, label) {
  for (let i = 1; i < list.length; i += 1) {
    const order = cmp(list[i - 1], list[i]);
    assert.ok(
      order <= 0,
      `${label}：第 ${i} 与第 ${i + 1} 项顺序错误（前=${JSON.stringify(pick(list[i - 1]))}，后=${JSON.stringify(pick(list[i]))}）`,
    );
  }
}

/**
 * 排序断言时裁剪日志用的小投影。
 * @param {any} item
 * @returns {object}
 */
function pick(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt,
    rating: item.rating,
    favoriteCount: item.favoriteCount,
    isRecommended: item.isRecommended,
  };
}

/**
 * 用真实密钥伪造 token（仅用于验证「签名有效但过期 / 角色不符」等边界）。
 * @param {string} secret HMAC 密钥
 * @param {object} payload { sub, role, exp }
 * @returns {string}
 */
export function forgeToken(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/**
 * 读取磁盘上的 db.json（用于校验落盘一致性与 JSON 完整性）。
 * @returns {any}
 */
export function readDb() {
  return JSON.parse(fs.readFileSync(PATHS.dbFile, 'utf8'));
}

/**
 * 收集集合 id 唯一性 / 计数器自洽问题。
 * @param {any} data
 * @returns {string[]} 问题列表（空数组表示通过）
 */
export function auditDbShape(data) {
  const problems = [];
  const collections = [
    'members',
    'admins',
    'regions',
    'scenics',
    'travels',
    'favorites',
    'feedbacks',
    'operationLogs',
    'adminLogs',
    'memberLoginLogs',
  ];
  for (const name of collections) {
    const list = data[name];
    if (!Array.isArray(list)) {
      problems.push(`${name} 不是数组`);
      continue;
    }
    const seen = new Set();
    for (const item of list) {
      if (!item || !Number.isInteger(item.id)) {
        problems.push(`${name} 存在非法 id 项`);
        break;
      }
      if (seen.has(item.id)) {
        problems.push(`${name} id 重复：${item.id}`);
        break;
      }
      seen.add(item.id);
    }
    const maxId = list.reduce((acc, item) => (Number.isInteger(item.id) && item.id > acc ? item.id : acc), 0);
    const counter = data.meta && data.meta.counters ? data.meta.counters[name] : undefined;
    if (!Number.isInteger(counter) || counter < maxId) {
      problems.push(`${name} 计数器(${counter}) < 最大 id(${maxId})`);
    }
  }
  return problems;
}
