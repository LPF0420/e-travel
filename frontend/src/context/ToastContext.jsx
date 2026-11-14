/**
 * 全局提示上下文（DESIGN §6.2 `.toast` + §7.5「操作成功 → showToast(...)」）
 *
 * 职责：只维护提示队列（最多 3 条、2.5s 自动消失、同文案去重），
 * **不负责渲染**——右下角 DOM 由 components/ui/Toast.jsx 读取 toasts 后渲染，
 * 这样 SiteLayout 与 AdminLayout 都能各自挂一份而不会重复出队列。
 *
 * 用法：
 *   const { showToast } = useToast();
 *   showToast('景区已添加', 'success');
 *   showToast('网络异常，请稍后重试', 'error');
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { TOAST_DURATION, TOAST_MAX, TOAST_TYPES } from '../lib/constants.js';

/** 合法的 toast 类型集合（非法值统一回落 info，避免出现没有样式的裸条） */
const VALID_TYPES = [TOAST_TYPES.SUCCESS, TOAST_TYPES.ERROR, TOAST_TYPES.INFO];

/** 上下文默认值：未包裹 Provider 时给出安全空实现，避免页面直接白屏 */
const ToastContext = createContext({
  toasts: [],
  showToast: () => null,
  dismissToast: () => {},
});

/**
 * 提示队列 Provider。
 * @param {{ children: React.ReactNode }} props
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seqRef = useRef(0); // 自增 id，保证 key 唯一
  const timersRef = useRef(new Map()); // id → timeout handle

  /**
   * 立即移除一条提示（供关闭按钮 / 计时器调用）。
   * @param {number} id
   */
  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * 弹出一条提示。
   * @param {string} message 中文文案，空文案直接忽略
   * @param {'success'|'error'|'info'} [type='info']
   * @returns {number|null} 新提示的 id（重复文案返回 null）
   */
  const showToast = useCallback((message, type = TOAST_TYPES.INFO) => {
    const text = String(message === null || message === undefined ? '' : message).trim();
    if (!text) return null;
    const safeType = VALID_TYPES.includes(type) ? type : TOAST_TYPES.INFO;
    seqRef.current += 1;
    const id = seqRef.current;

    // 纯函数式更新：同文案不重复入队，超过上限时丢掉最早的一条
    setToasts((prev) => {
      if (prev.some((item) => item.message === text)) return prev;
      return [...prev, { id, message: text, type: safeType }].slice(-TOAST_MAX);
    });
    return id;
  }, []);

  // 为每条新提示挂一个 2.5s 计时器（已挂过的不会重置，避免重复刷新延长停留）
  useEffect(() => {
    toasts.forEach((item) => {
      if (timersRef.current.has(item.id)) return;
      const timer = setTimeout(() => {
        timersRef.current.delete(item.id);
        setToasts((prev) => prev.filter((entry) => entry.id !== item.id));
      }, TOAST_DURATION);
      timersRef.current.set(item.id, timer);
    });
  }, [toasts]);

  // 卸载时清空所有计时器，防止对已卸载组件 setState
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * 读取提示队列与操作方法。
 * @returns {{ toasts: Array<{id:number,message:string,type:string}>, showToast: (message:string, type?:string)=>number|null, dismissToast: (id:number)=>void }}
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // 理论上不会发生（默认值已兜底），保留提示便于排查 Provider 漏挂
    if (typeof console !== 'undefined') console.warn('[ToastContext] 请在应用根部包裹 <ToastProvider>');
  }
  return context;
}

export default ToastContext;
