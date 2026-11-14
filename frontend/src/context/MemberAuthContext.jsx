/**
 * 会员登录态（DESIGN §5.1：登录 → 收藏 / 401 拦截 → 登录 → 回跳）
 *
 * 关键点：
 * 1. `loading` 为 true 时守卫只渲染 Spinner，避免「先闪游客态再跳登录」；
 * 2. 首屏若有 token 先用 `/auth/me` 校验一次，失效则由 api.js 清 token 并派发事件；
 * 3. token 的读写只在 api.js 里做，本文件不直接碰 localStorage。
 *
 * 用法：
 *   const { member, loading, login, register, logout, refresh, isAuthenticated } = useMemberAuth();
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  AUTH_EXPIRED_EVENT,
  UNAUTHORIZED_EVENT,
  clearToken,
  get,
  getToken,
  post,
  setToken,
} from '../lib/api.js';

const MemberAuthContext = createContext({
  member: null,
  loading: false,
  isAuthenticated: false,
  login: async () => null,
  register: async () => null,
  logout: async () => {},
  refresh: async () => null,
});

/**
 * 判断事件是否属于会员侧（api.js 同时派发 scope 与 kind 两种 detail 键）。
 * @param {CustomEvent} event
 * @returns {boolean}
 */
function isMemberEvent(event) {
  const detail = event && event.detail ? event.detail : {};
  const scope = detail.scope || detail.kind;
  return scope === 'member';
}

/**
 * 会员登录态 Provider。
 * @param {{ children: React.ReactNode }} props
 */
export function MemberAuthProvider({ children }) {
  // 没有 token 的游客直接 loading=false，避免无谓的全屏 Spinner
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken('member')));
  const aliveRef = useRef(true);

  /**
   * 拉取当前会员（token 有效则回填，无效则清空）。
   * @returns {Promise<object|null>} member
   */
  const refresh = useCallback(async () => {
    if (!getToken('member')) {
      setMember(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await get('/auth/me', { scope: 'member' });
      const nextMember = data && data.member ? data.member : null;
      if (aliveRef.current) setMember(nextMember);
      return nextMember;
    } catch (error) {
      // 401/2002 已由 api.js 清 token，这里只需把内存态置空；其它错误同样回到游客态
      if (aliveRef.current) setMember(null);
      return null;
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  // 首屏校验一次 token
  useEffect(() => {
    aliveRef.current = true;
    if (!getToken('member')) {
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

  // 任意接口返回 2001/2002 时同步清内存态（token 已由 api.js 清除）
  useEffect(() => {
    const handleUnauthorized = (event) => {
      if (!isMemberEvent(event)) return;
      setMember(null);
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
   * 登录（username 是会员名，如「林小满」）。
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} member；失败时抛 ApiError（code 1001/2003），由页面决定提示方式
   */
  const login = useCallback(async (username, password) => {
    const data = await post('/auth/login', { username, password }, { scope: 'none' });
    if (data && data.token) setToken('member', data.token);
    const nextMember = data && data.member ? data.member : null;
    setMember(nextMember);
    setLoading(false);
    return nextMember;
  }, []);

  /**
   * 注册并自动登录。
   * @param {{ username:string, password:string, confirmPassword:string, phone:string, email:string }} payload
   * @returns {Promise<object>} member
   */
  const register = useCallback(async (payload) => {
    const data = await post('/auth/register', payload, { scope: 'none' });
    if (data && data.token) setToken('member', data.token);
    const nextMember = data && data.member ? data.member : null;
    setMember(nextMember);
    setLoading(false);
    return nextMember;
  }, []);

  /**
   * 退出登录：先通知服务端（无状态 token，失败也不影响），再清本地。
   * @returns {Promise<void>}
   */
  const logout = useCallback(async () => {
    try {
      await post('/auth/logout', {}, { scope: 'member' });
    } catch (error) {
      /* 服务端不可用时依旧允许本地退出 */
    }
    clearToken('member');
    setMember(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      member,
      loading,
      isAuthenticated: Boolean(member),
      login,
      register,
      logout,
      refresh,
    }),
    [member, loading, login, register, logout, refresh],
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

/**
 * 读取会员登录态。
 * @returns {{ member: object|null, loading: boolean, isAuthenticated: boolean, login: Function, register: Function, logout: Function, refresh: Function }}
 */
export function useMemberAuth() {
  const context = useContext(MemberAuthContext);
  if (!context && typeof console !== 'undefined') {
    console.warn('[MemberAuthContext] 请在应用根部包裹 <MemberAuthProvider>');
  }
  return context;
}

export default MemberAuthContext;
