/**
 * 后端请求封装（DESIGN §7.1 的落地版）
 *
 * 契约（全员依赖，签名不得改动）：
 * - 成功（body.code === 0）→ resolve(body.data)，**只返回 data，不返回整包**
 * - 业务失败 → throw ApiError(message, { code, status, data })
 * - 网络异常/超时 → throw ApiError(..., { code: -1 })
 * - scope 对应的 token 失效（2001/2002）→ 清 token + 派发未授权事件后再 throw
 *
 * 注意：不使用 cookie（无 credentials:'include'），鉴权只走 Authorization: Bearer；
 * 所有 GET 一律 cache:'no-store'，避免拿到浏览器缓存的旧列表。
 *
 * ------------------------------------------------------------
 * 常用接口清单（路径即本文件方法的 path 入参，已含 /api 前缀语义）
 * ------------------------------------------------------------
 * 公开 GET  /stats/public            → { regionCount, scenicCount, travelCount }（注意不是 /stats）
 * 公开 GET  /scenics?keyword&regionId&sort&isRecommended&page&pageSize&limit
 *          sort 仅允许 default|recommend|latest|popular（其它值后端 1001）
 * 公开 GET  /scenics/:id  ·  /scenics/:id/travels?limit=5
 * 公开 GET  /regions?limit=6         → **{ list, total }**，没有 page/pageSize/totalPages
 * 公开 GET  /travels?scenicId&page&pageSize  ·  /travels/:id
 * 会员 POST /auth/login {username,password}   username 是会员名（如「林小满」），不是邮箱
 * 会员 POST /auth/register {username,password,confirmPassword,phone,email} → 自动登录
 * 会员 GET  /auth/me  ·  POST /auth/logout
 * 会员 GET  /favorites?page&pageSize  ·  POST /favorites {scenicId}（幂等）
 *       DELETE /favorites/:scenicId
 * 公开 POST /feedbacks {content, memberId?}
 * 后台 POST /admin/auth/login  ·  GET /admin/auth/me  ·  POST /admin/auth/logout
 * 后台 PUT  /admin/auth/password {oldPassword,newPassword,confirmPassword}
 *          （实现是 PUT，不是 PATCH；改密成功后必须清 token 由页面跳登录）
 * 后台 GET  /admin/dashboard  ·  GET /admin/options?type=regions|scenics|members
 * 后台 GET  /admin/logs/operations  ·  /admin/logs/admins  ·  /admin/logs/member-logins
 * 后台 PATCH /admin/scenics/:id/recommend {isRecommended}
 * 后台 CRUD /admin/regions  ·  /admin/scenics  ·  /admin/travels  ·  /admin/members  ·  /admin/feedbacks
 *
 * 演示账号密码见 README.md「默认账号」表格，**任何代码文件都不得硬编码密码**。
 * ------------------------------------------------------------
 */

/** localStorage 键名（会员与后台完全独立） */
export const TOKEN_KEYS = {
  member: 'etravel_member_token',
  admin: 'etravel_admin_token',
};

/** 未授权事件名：两个都派发，兼容 DESIGN 约定与页面侧习惯 */
export const UNAUTHORIZED_EVENT = 'etravel:unauthorized';
export const AUTH_EXPIRED_EVENT = 'etravel:auth-expired';

/** 默认超时（毫秒） */
const DEFAULT_TIMEOUT = 12000;

/** 后端业务错误码（与 server/utils.js 保持一致） */
export const ERROR_CODES = {
  VALIDATION: 1001,
  NOT_FOUND: 1002,
  CONFLICT: 1003,
  UNAUTHORIZED: 2001,
  TOKEN_EXPIRED: 2002,
  BAD_CREDENTIALS: 2003,
  FORBIDDEN: 2004,
  OLD_PASSWORD_WRONG: 2005,
  REGION_IN_USE: 3001,
  FOREIGN_KEY_MISSING: 3002,
  SERVER: 5000,
  NETWORK: -1,
};

/**
 * 统一请求错误。
 * code 为后端业务码；fieldErrors 仅在 code === 1001（校验失败）时填充，
 * 形如 { username: '该会员名已被注册' }，表单组件可直接 map 成字段红字（先覆盖再渲染，无需二次解析）。
 *
 * 其它错误码的 data 也可能是字段 map（例如 1003 重名、3002 外键不存在），
 * 但那些场景**不保证每个键都是可直接展示的文案**，统一用 e.message 走顶部 .form-alert；
 * 3001（地区被引用）的 message 已是完整中文（「该地区下还有 N 个景区，请先处理」），可直接显示。
 */
export class ApiError extends Error {
  /**
   * @param {string} message 可直接展示给用户的中文文案
   * @param {{ code?: number, status?: number, data?: any }} [options]
   */
  constructor(message, { code = ERROR_CODES.NETWORK, status = 0, data = null } = {}) {
    super(message || '请求失败，请稍后重试');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
    this.fieldErrors = code === ERROR_CODES.VALIDATION && data && typeof data === 'object' ? data : null;
  }
}

/* ============================================================
 * token 读写（localStorage 不可用时静默降级，不抛错）
 * ============================================================ */

/**
 * 取 token。
 * @param {'member'|'admin'} scope
 * @returns {string|null}
 */
export function getToken(scope) {
  const key = TOKEN_KEYS[scope];
  if (!key) return null;
  try {
    const token = window.localStorage.getItem(key);
    return token || null;
  } catch (error) {
    return null;
  }
}

/**
 * 写 token。
 * @param {'member'|'admin'} scope
 * @param {string} token
 * @returns {void}
 */
export function setToken(scope, token) {
  const key = TOKEN_KEYS[scope];
  if (!key || !token) return;
  try {
    window.localStorage.setItem(key, token);
  } catch (error) {
    /* 隐私模式下写入失败：不影响本次会话的内存态 */
  }
}

/**
 * 清 token。
 * @param {'member'|'admin'} scope
 * @returns {void}
 */
export function clearToken(scope) {
  const key = TOKEN_KEYS[scope];
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    /* 忽略 */
  }
}

/* ============================================================
 * 内部工具
 * ============================================================ */

/**
 * 拼接完整请求地址：'/api/xxx' 原样、'xxx' 视为相对 /api、绝对地址直通。
 * @param {string} path
 * @returns {string}
 */
function resolveUrl(path) {
  const raw = String(path || '').trim();
  if (!raw) return '/api';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/api')) return raw;
  return raw.startsWith('/') ? `/api${raw}` : `/api/${raw}`;
}

/**
 * 对象 → querystring，跳过 null / undefined / 空字符串；数组展开为重复键。
 * @param {object|null|undefined} query
 * @returns {string} 形如 '?page=1&keyword=x'，为空时返回 ''
 */
export function buildQuery(query) {
  if (!query || typeof query !== 'object') return '';
  const params = new URLSearchParams();
  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null || item === undefined || item === '') return;
        params.append(key, String(item));
      });
      return;
    }
    params.append(key, typeof value === 'boolean' ? String(value) : String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * HTTP 状态码兜底文案（响应体不是标准包时使用）。
 * @param {number} status
 * @returns {string}
 */
function messageForStatus(status) {
  if (status === 400) return '请求参数有误，请检查后重试';
  if (status === 401) return '登录状态已失效，请重新登录';
  if (status === 403) return '没有操作权限';
  if (status === 404) return '请求的资源不存在';
  if (status === 409) return '数据冲突，请刷新后重试';
  if (status === 413) return '提交内容过大';
  if (status === 429) return '操作太频繁，请稍后再试';
  if (status >= 500) return '服务端开小差了，请稍后重试';
  return `请求失败（HTTP ${status}）`;
}

/**
 * token 失效时统一处理：清 token + 通知上下文清内存态。
 * @param {'none'|'member'|'admin'} scope
 * @returns {void}
 */
function handleUnauthorized(scope) {
  if (scope !== 'member' && scope !== 'admin') return;
  clearToken(scope);
  try {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { scope, kind: scope } }));
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { scope, kind: scope } }));
  } catch (error) {
    /* 非浏览器环境忽略 */
  }
}

/**
 * 判断响应体是否为后端的标准包 `{ code, message, data }`。
 * @param {any} payload
 * @returns {boolean}
 */
function isEnvelope(payload) {
  return Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload) && 'code' in payload;
}

/**
 * 解析响应体：读文本后尝试 JSON.parse，非 JSON 返回 { json: null, text }。
 * @param {Response} response
 * @returns {Promise<{ json: any, text: string }>}
 */
async function readPayload(response) {
  let text = '';
  try {
    text = await response.text();
  } catch (error) {
    return { json: null, text: '' };
  }
  if (!text) return { json: null, text: '' };
  try {
    return { json: JSON.parse(text), text };
  } catch (error) {
    return { json: null, text };
  }
}

/* ============================================================
 * 核心请求
 * ============================================================ */

/**
 * 发起请求并解包。
 *
 * @param {string} path 以 '/api' 开头或相对路径（如 '/scenics'）
 * @param {object} [options]
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [options.method='GET']
 * @param {object} [options.body]   自动 JSON.stringify + Content-Type
 * @param {object} [options.query]  自动拼 querystring，跳过 null/undefined/''
 * @param {'none'|'member'|'admin'} [options.scope='none'] 取哪个 token 放进 Authorization
 * @param {'none'|'member'|'admin'} [options.auth] 兼容 DESIGN §7.1 的旧写法（等价于 scope）
 * @param {AbortSignal} [options.signal] 页面卸载时取消
 * @param {number} [options.timeout=12000]
 * @returns {Promise<any>} 成功时返回 body.data
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    scope = 'none',
    auth,
    signal,
    timeout = DEFAULT_TIMEOUT,
  } = options || {};

  const effectiveScope = auth && auth !== 'none' ? auth : scope;
  const url = `${resolveUrl(path)}${buildQuery(query)}`;
  // null 视为「无请求体」：不设 Content-Type，避免发出字面量 'null'
  const hasBody = body !== undefined && body !== null;
  const headers = { Accept: 'application/json' };
  if (hasBody) headers['Content-Type'] = 'application/json';

  const token = effectiveScope === 'member' || effectiveScope === 'admin' ? getToken(effectiveScope) : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  // 内部 AbortController：同时承载超时与外部 signal
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  let detach = () => {};
  if (signal) {
    if (signal.aborted) controller.abort();
    else {
      const onAbort = () => controller.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      detach = () => signal.removeEventListener('abort', onAbort);
    }
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    clearTimeout(timer);
    detach();
    if (timedOut) {
      throw new ApiError('请求超时，请检查后端服务是否已启动后重试', { code: ERROR_CODES.NETWORK });
    }
    if (error && error.name === 'AbortError') {
      throw new ApiError('请求已取消', { code: ERROR_CODES.NETWORK });
    }
    throw new ApiError('网络连接失败，请检查后端服务是否已启动', { code: ERROR_CODES.NETWORK });
  }

  clearTimeout(timer);
  detach();

  const { json } = await readPayload(response);
  const status = response.status;

  // 标准包：优先用后端 code / message
  if (isEnvelope(json)) {
    const code = typeof json.code === 'number' ? json.code : ERROR_CODES.SERVER;
    if (response.ok && code === 0) return json.data === undefined ? null : json.data;
    if (code === ERROR_CODES.UNAUTHORIZED || code === ERROR_CODES.TOKEN_EXPIRED) handleUnauthorized(effectiveScope);
    throw new ApiError(json.message || messageForStatus(status), { code, status, data: json.data ?? null });
  }

  // 非标准包
  if (!response.ok) {
    if (status === 401) handleUnauthorized(effectiveScope);
    throw new ApiError(messageForStatus(status), { code: status === 401 ? ERROR_CODES.UNAUTHORIZED : ERROR_CODES.SERVER, status });
  }
  throw new ApiError('服务返回异常', { code: ERROR_CODES.NETWORK, status });
}

/* ============================================================
 * 便捷方法
 * ============================================================ */

/**
 * GET。
 * @param {string} path
 * @param {{ query?: object, scope?: 'none'|'member'|'admin', signal?: AbortSignal, timeout?: number }} [opts]
 */
export function get(path, opts = {}) {
  return request(path, { ...opts, method: 'GET', body: undefined });
}

/**
 * POST。
 * @param {string} path
 * @param {object|null} [body]
 * @param {{ query?: object, scope?: 'none'|'member'|'admin', signal?: AbortSignal, timeout?: number }} [opts]
 */
export function post(path, body, opts = {}) {
  return request(path, { ...opts, method: 'POST', body: body === undefined ? {} : body });
}

/**
 * PUT。
 * @param {string} path
 * @param {object|null} [body]
 * @param {{ query?: object, scope?: 'none'|'member'|'admin', signal?: AbortSignal, timeout?: number }} [opts]
 */
export function put(path, body, opts = {}) {
  return request(path, { ...opts, method: 'PUT', body: body === undefined ? {} : body });
}

/**
 * PATCH。
 * @param {string} path
 * @param {object|null} [body]
 * @param {{ query?: object, scope?: 'none'|'member'|'admin', signal?: AbortSignal, timeout?: number }} [opts]
 */
export function patch(path, body, opts = {}) {
  return request(path, { ...opts, method: 'PATCH', body: body === undefined ? {} : body });
}

/**
 * DELETE（后端删除接口不需要 body）。
 * @param {string} path
 * @param {{ query?: object, scope?: 'none'|'member'|'admin', signal?: AbortSignal, timeout?: number }} [opts]
 */
export function del(path, opts = {}) {
  return request(path, { ...opts, method: 'DELETE', body: undefined });
}

/** DESIGN §7.1 语法糖命名空间：api.get / api.post / ... */
export const api = Object.freeze({ get, post, put, patch, del, request });

/** 默认导出：request 本体 + 便捷方法，两种 import 习惯都可用 */
export default api;
