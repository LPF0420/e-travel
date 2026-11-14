/**
 * 管理员登录态（DESIGN §5.2 / §4 P-12、P-24）
 *
 * 与会员体系完全独立：token 键 `etravel_admin_token`、接口前缀 `/api/admin`、
 * 事件 detail.scope === 'admin' 才响应。
 *
 * 改密特别约定（F-44）：`changePassword` 成功后**必须清 token**，
 * 由调用方（PasswordChange 页）跳转 `/admin/login?reason=password-changed`，
 * 因为后端没有 token 版本号，旧 token 在有效期内仍然可用，只能靠前端强制重登。
 *
 * 用法：
 *   const { admin, loading, login, logout, changePassword, isAuthenticated } = useAdminAuth();
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  AUTH_EXPIRED_EVENT,
  UNAUTHORIZED_EVENT,
  clearToken,
  get,
  getToken,
  post,
  put,
  setToken,
} from '../lib/api.js';

const AdminAuthContext = createContext({
  admin: null,
  loading: false,
  isAuthenticated: false,
  login: async () => null,
  logout: async () => {},
  refresh: async () => null,
  changePassword: async () => null,
});

/**
 * 判断事件是否属于后台侧。
 * @param {CustomEvent} event
 * @returns {boolean}
 */
function isAdminEvent(event) {
  const detail = event && event.detail ? event.detail : {};
  const scope = detail.scope || detail.kind;
  return scope === 'admin';
}

/**
 * 管理员登录态 Provider。
 * @param {{ children: React.ReactNode }} props
 */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken('admin')));
  const aliveRef = useRef(true);

  /**
   * 用当前 admin token 校验并回填管理员信息。
   * @returns {Promise<object|null>} admin
   */
  const refresh = useCallback(async () => {
    if (!getToken('admin')) {
      setAdmin(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await get('/admin/auth/me', { scope: 'admin' });
      const nextAdmin = data && data.admin ? data.admin : null;
      if (aliveRef.current) setAdmin(nextAdmin);
      return nextAdmin;
    } catch (error) {
      // token 失效已由 api.js 清除，这里只把内存态置空
      if (aliveRef.current) setAdmin(null);
      return null;
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  // 首屏校验一次 token（AdminRoute 依赖 loading 避免闪烁）
  useEffect(() => {
    aliveRef.current = true;
    if (!getToken('admin')) {
      setLoading(false);
      return () => {
        aliveRef.current = false;
      };
    }
    refresh();
    return () => {
      aliveRef.current = false;
    };
  }, [refresh]);

  // 后台接口 2001/2002 → 清内存态（后台守卫会自动跳登录）
  useEffect(() => {
    const handleUnauthorized = (event) => {
      if (!isAdminEvent(event)) return;
      setAdmin(null);
      setLoading(false);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleUnauthorized);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleUnauthorized);
    };
  }, []);

  /**
   * 管理员登录。
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} admin；失败抛 ApiError（1001/2003）
   */
  const login = useCallback(async (username, password) => {
    const data = await post('/admin/auth/login', { username, password }, { scope: 'none' });
    if (data && data.token) setToken('admin', data.token);
    const nextAdmin = data && data.admin ? data.admin : null;
    setAdmin(nextAdmin);
    setLoading(false);
    return nextAdmin;
  }, []);

  /**
   * 退出后台登录（服务端会写 logout 日志）。
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await post('/admin/auth/logout', {}, { scope: 'admin' });
    } catch (error) {
      /* 服务端不可用时也允许本地退出 */
    }
    clearToken('admin');
    setAdmin(null);
    setLoading(false);
  }, []);

  /**
   * 修改密码。成功后清 token 并清内存态，调用方负责跳转登录页。
   * 后端路由为 `PUT /api/admin/auth/password`（DESIGN 文本写作 PATCH，实现为 PUT）。
   *
   * @param {string} oldPassword
   * @param {string} newPassword
   * @param {string} [confirmPassword] 传入时一并提交，后端会二次校验一致性
   * @returns {Promise<object|null>} 后端 data（含 reloginRequired）
   */
  const changePassword = useCallback(async (oldPassword, newPassword, confirmPassword) => {
    const body = { oldPassword, newPassword };
    if (confirmPassword !== undefined) body.confirmPassword = confirmPassword;
    const data = await put('/admin/auth/password', body, { scope: 'admin' });
    // 关键：密码已变更，立即作废旧登录态
    clearToken('admin');
    setAdmin(null);
    setLoading(false);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      admin,
      loading,
      isAuthenticated: Boolean(admin),
      login,
      logout,
      refresh,
      changePassword,
    }),
    [admin, loading, login, logout, refresh, changePassword],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

/**
 * 读取管理员登录态。
 * @returns {{ admin: object|null, loading: boolean, isAuthenticated: boolean, login: Function, logout: Function, refresh: Function, changePassword: Function }}
 */
export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context && typeof console !== 'undefined') {
    console.warn('[AdminAuthContext] 请在应用根部包裹 <AdminAuthProvider>');
  }
  return context;
}

export default AdminAuthContext;
