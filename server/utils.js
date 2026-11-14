/**
 * 后端通用工具：统一响应包、业务异常、异步包装、分页、字段校验器、IP 提取。
 * 本文件不得 import db.js / auth.js，保持零依赖以规避循环引用。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { IMAGE_EXTENSIONS, IMAGE_PATH_PREFIX, PAGE_SIZE } from './constants.js';

/**
 * 业务异常。handler 内 throw，由 server/index.js 的错误中间件统一转成 `{code,message,data}`。
 */
export class AppError extends Error {
  /**
   * @param {number} code 业务错误码（见 DESIGN §3.4）
   * @param {string} message 中文提示，可直接展示
   * @param {number} [status=400] HTTP 状态码
   * @param {any} [data=null] 附加数据（多字段校验失败时为 `{field: message}`）
   */
  constructor(code, message, status = 400, data = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

/**
 * 成功响应包。
 * @param {any} [data=null]
 * @param {string} [message='ok']
 * @returns {{code:number,message:string,data:any}}
 */
export function ok(data = null, message = 'ok') {
  return { code: 0, message, data };
}

/**
 * 失败响应包（同样用于错误中间件）。
 * @param {number} code
 * @param {string} message
 * @param {any} [data=null]
 * @returns {{code:number,message:string,data:any}}
 */
export function fail(code, message, data = null) {
  return { code, message, data };
}

/**
 * 包裹 async handler，把 rejected promise 交给 Express 错误中间件。
 * @param {Function} handler
 * @returns {Function}
 */
export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** @returns {string} 当前时间的 ISO 8601 字符串 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * 取请求来源 IP，IPv6 回环归一为 127.0.0.1。
 * @param {import('express').Request} req
 * @returns {string}
 */
export function clientIp(req) {
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : '';
  let ip = '';
  if (Array.isArray(forwarded)) {
    ip = String(forwarded[0] || '');
  } else if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0];
  }
  ip = ip.trim();
  if (!ip) {
    ip = (req.socket && req.socket.remoteAddress) || req.ip || '';
  }
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length);
  return ip;
}

/**
 * 宽松整数解析（非法值回落默认值），用于 query 参数。
 * @param {any} value
 * @param {number} fallback
 * @param {{min?:number|null, max?:number|null}} [options]
 * @returns {number}
 */
export function toInt(value, fallback, options = {}) {
  const min = options.min === undefined ? null : options.min;
  const max = options.max === undefined ? null : options.max;
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  let int = Math.trunc(parsed);
  if (min !== null && int < min) int = min;
  if (max !== null && int > max) int = max;
  return int;
}

/**
 * 严格正整数解析（用于路径参数 / 外键），非法返回 null。
 * @param {any} value
 * @returns {number|null}
 */
export function parseId(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * 解析分页参数。
 * @param {Record<string, any>} [query]
 * @param {number} [defaultPageSize]
 * @returns {{page:number,pageSize:number,skip:number,take:number}}
 */
export function parsePaging(query = {}, defaultPageSize = PAGE_SIZE.ADMIN_LIST) {
  const page = toInt(query.page, 1, { min: 1 });
  const pageSize = toInt(query.pageSize, defaultPageSize, { min: 1, max: PAGE_SIZE.MAX });
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * 生成标准分页包。
 * @template T
 * @param {T[]} list 已过滤/排序的全量列表
 * @param {number} page 页码（从 1 开始）
 * @param {number} pageSize 每页条数
 * @returns {{list:T[],total:number,page:number,pageSize:number,totalPages:number}}
 */
export function paginate(list, page, pageSize) {
  const all = Array.isArray(list) ? list : [];
  const total = all.length;
  const size = pageSize > 0 ? pageSize : PAGE_SIZE.ADMIN_LIST;
  const safePage = page > 0 ? page : 1;
  const skip = (safePage - 1) * size;
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    list: all.slice(skip, skip + size),
    total,
    page: safePage,
    pageSize: size,
    totalPages,
  };
}

/** @param {any} value @returns {boolean} */
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {any} value @returns {string} 去首尾空格的字符串（非字符串返回 ''） */
export function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 中文按字符计数（与前端 `text.length` 一致，BMP 字符 1:1） */
export function textLength(value) {
  return typeof value === 'string' ? value.trim().length : 0;
}

/** @param {any} value @returns {boolean} 会员名 2–20 字 */
export function isUsernameOk(value) {
  const len = textLength(value);
  return len >= 2 && len <= 20;
}

/** @param {any} value @returns {boolean} 密码 6–20 位 */
export function isPasswordOk(value) {
  return typeof value === 'string' && value.length >= 6 && value.length <= 20;
}

/** @param {any} value @returns {boolean} 手机号 */
export function isPhoneOk(value) {
  return typeof value === 'string' && /^1[3-9]\d{9}$/.test(value.trim());
}

/** @param {any} value @returns {boolean} 邮箱（基础正则） */
export function isEmailOk(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * 图片路径校验（宽松版）：必须以 `/images/` 开头且后面有内容。
 * 仅用于「形态」判断；是否真实存在用 isAvailableImagePath。
 * @param {any} value
 * @returns {boolean}
 */
export function isImagePathOk(value) {
  const text = trimText(value);
  return text.startsWith(IMAGE_PATH_PREFIX) && text.length > IMAGE_PATH_PREFIX.length;
}

/** 项目根目录（server/ 的上一级） */
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 真实图片可能落地的目录：开发期 public/images、构建后 dist/images */
const IMAGE_DIRS = [
  path.join(PROJECT_ROOT, 'frontend', 'public', 'images'),
  path.join(PROJECT_ROOT, 'dist', 'images'),
];

/** 可用图片路径缓存（`/images/xxx.jpg` → Set），进程内只扫描一次 */
let availableImageCache = null;

/** 降级告警只打印一次，避免刷屏 */
let degradedWarned = false;

/**
 * 扫描磁盘上真实存在的图片路径（含缓存）。
 * 目录都不可读时返回空集合，调用方据此退化为形态校验。
 * @returns {Set<string>}
 */
function loadAvailableImages() {
  if (availableImageCache) return availableImageCache;
  const found = new Set();
  for (const dir of IMAGE_DIRS) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) {
          found.add(`${IMAGE_PATH_PREFIX}${name}`);
        }
      }
    } catch (error) {
      /* 目录不存在（例如未构建 dist）时跳过 */
    }
  }
  // 两个目录都读不到 → 后面会退化为「只校验形态」，这里显式告警一次，
  // 否则「文件不存在也能存」会无声生效，排查时非常难定位。
  if (found.size === 0 && !degradedWarned) {
    degradedWarned = true;
    console.warn(
      `[utils] 未扫描到任何图片素材目录（${IMAGE_DIRS.join('、')}），图片路径校验已降级为「前缀+扩展名」，不再校验文件是否存在`,
    );
  }
  availableImageCache = found;
  return availableImageCache;
}

/**
 * 图片路径校验（严格版）：`/images/` + 合法扩展名 + **文件真实存在**。
 *
 * 目的：避免管理员填了不存在的路径（例如素材已改为 .jpg，却仍填 .png）时，
 * 数据能存进库但前台处处破图。PRD F-31② 也要求「仅允许选用 public/images 下已存在的图」。
 * 若两个图片目录都读不到（极端部署），退化为「前缀 + 扩展名」校验，避免误伤。
 *
 * @param {any} value
 * @returns {boolean}
 */
export function isAvailableImagePath(value) {
  if (!isImagePathOk(value)) return false;
  const text = trimText(value);
  if (!IMAGE_EXTENSIONS.some((ext) => text.toLowerCase().endsWith(ext))) return false;
  const known = loadAvailableImages();
  if (known.size === 0) return true;
  return known.has(text);
}

/**
 * 字符串列表归一化：支持数组、逗号/中文逗号/换行分隔的字符串。
 * 空项剔除、去重、逐项 trim，最多 maxItems 项。
 * @param {any} value
 * @param {{maxItems?:number}} [options]
 * @returns {string[]}
 */
export function normalizeStringList(value, options = {}) {
  const maxItems = options.maxItems === undefined ? 6 : options.maxItems;
  let rawList = [];
  if (Array.isArray(value)) {
    rawList = value;
  } else if (typeof value === 'string') {
    rawList = value.split(/[,，\n\r]+/);
  } else if (value === undefined || value === null) {
    rawList = [];
  } else {
    rawList = [String(value)];
  }
  const seen = new Set();
  const result = [];
  for (const item of rawList) {
    const text = trimText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

/**
 * 字段错误收集器：多字段校验失败时一次性返回 `{field: message}`。
 * @param {string} [message='请检查表单填写'] 整体提示
 */
export function createFieldErrors(message = '请检查表单填写') {
  const errors = Object.create(null);
  return {
    errors,
    /**
     * 记录字段错误（同一字段只保留第一条）。
     * @param {string} field
     * @param {string} text
     * @returns {object} 自身，便于链式调用
     */
    add(field, text) {
      if (!(field in errors)) errors[field] = text;
      return this;
    },
    /** @returns {boolean} */
    hasError() {
      return Object.keys(errors).length > 0;
    },
    /**
     * 存在错误则抛出 code 1001。
     * @returns {void}
     */
    throwIfInvalid() {
      if (Object.keys(errors).length > 0) {
        throw new AppError(1001, message, 400, { ...errors });
      }
    },
  };
}

/**
 * 条件断言，失败抛 AppError。
 * @param {any} condition
 * @param {number} code
 * @param {string} message
 * @param {number} [status=400]
 * @returns {void}
 */
export function assertOrThrow(condition, code, message, status = 400) {
  if (!condition) throw new AppError(code, message, status);
}

/**
 * 资源不存在断言（code 1002 / HTTP 404）。
 * @param {any} entity
 * @param {string} message
 * @returns {void}
 */
export function assertFound(entity, message) {
  if (entity === undefined || entity === null) {
    throw new AppError(1002, message, 404);
  }
}

/**
 * 按 id 倒序比较（后台列表默认排序）。
 * @param {{id:number}} a
 * @param {{id:number}} b
 * @returns {number}
 */
export function byIdDesc(a, b) {
  return b.id - a.id;
}

/**
 * 按 ISO 时间倒序比较，时间相同回落 id 倒序。
 * @param {string} field
 * @returns {(a:any,b:any)=>number}
 */
export function byTimeDesc(field) {
  return function compare(a, b) {
    const left = Date.parse(a[field] || '') || 0;
    const right = Date.parse(b[field] || '') || 0;
    if (right !== left) return right - left;
    return b.id - a.id;
  };
}

/**
 * 解析日期区间边界（本地时区）：startDate 取当日 00:00:00.000，endDate 取当日 23:59:59.999。
 * @param {any} startDate `YYYY-MM-DD` 或空
 * @param {any} endDate `YYYY-MM-DD` 或空
 * @returns {{start:number|null,end:number|null}}
 */
export function parseDateRange(startDate, endDate) {
  const buildStart = (text) => {
    const raw = trimText(text);
    if (!raw) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  };
  const buildEnd = (text) => {
    const start = buildStart(text);
    if (start === null) return null;
    return start + 24 * 60 * 60 * 1000 - 1;
  };
  return { start: buildStart(startDate), end: buildEnd(endDate) };
}

/**
 * 判断 ISO 时间是否落在区间内。
 * @param {string} iso
 * @param {{start:number|null,end:number|null}} range
 * @returns {boolean}
 */
export function inDateRange(iso, range) {
  const time = Date.parse(iso || '');
  if (Number.isNaN(time)) return false;
  if (range.start !== null && time < range.start) return false;
  if (range.end !== null && time > range.end) return false;
  return true;
}

/**
 * 布尔参数解析（query 里的 'true'/'1'/'false'）。
 * @param {any} value
 * @param {boolean|null} [fallback=null] 无法识别时返回该值（null 表示不筛选）
 * @returns {boolean|null}
 */
export function toBoolean(value, fallback = null) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === 'true' || text === '1' || text === 'yes') return true;
    if (text === 'false' || text === '0' || text === 'no') return false;
  }
  return fallback;
}

/**
 * 关键词模糊匹配（大小写不敏感，命中任一字段即算匹配）。
 * @param {string} keyword
 * @param {...(string|undefined|null)} fields
 * @returns {boolean}
 */
export function matchKeyword(keyword, ...fields) {
  const needle = trimText(keyword).toLowerCase();
  if (!needle) return true;
  return fields.some((field) => typeof field === 'string' && field.toLowerCase().includes(needle));
}

/**
 * 摘要截断（列表卡片用）。
 * @param {string} text
 * @param {number} [max=40]
 * @returns {string}
 */
export function truncate(text, max = 40) {
  const value = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}
