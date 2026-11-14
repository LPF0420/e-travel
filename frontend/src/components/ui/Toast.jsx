/**
 * 提示队列渲染（DESIGN §6.2 `.toast`；数据来自 ToastContext，本组件纯渲染）
 *
 * props：toasts（[{id,message,type}]）, onDismiss(id)
 *
 * 进入：从右滑入（toast-in）；离开：滑出（toast-out）。
 * 为了拿到「离开动画」，内部维护一份镜像列表：上下文里消失的条目先标记 .is-leaving，
 * 180ms 后再从镜像里移除。
 *
 * 用法（Layout 里挂一次即可）：
 *   const { toasts, dismissToast } = useToast();
 *   <Toast toasts={toasts} onDismiss={dismissToast} />
 */

import { useEffect, useRef, useState } from 'react';

import { TOAST_TYPES } from '../../lib/constants.js';

/** 滑出动画时长（与 components.css 的 --tr-base 对齐） */
const LEAVE_DELAY = 200;

/** 成功图标 */
function SuccessIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.2" />
      <path d="M5.6 9.2l2.4 2.4 4.4-4.6" />
    </svg>
  );
}

/** 失败图标 */
function ErrorIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.2" />
      <path d="M9 5.4v4.2M9 12.4v.2" />
    </svg>
  );
}

/** 信息图标 */
function InfoIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7.2" />
      <path d="M9 8v4.4M9 5.6v.2" />
    </svg>
  );
}

/** 关闭图标 */
function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
    </svg>
  );
}

/** 类型 → 图标 */
const ICON_MAP = {
  [TOAST_TYPES.SUCCESS]: SuccessIcon,
  [TOAST_TYPES.ERROR]: ErrorIcon,
  [TOAST_TYPES.INFO]: InfoIcon,
};

/**
 * 右下角提示队列。
 * @param {{ toasts?: Array<{id:number|string,message:string,type:string}>, onDismiss?: Function }} props
 * @returns {JSX.Element|null}
 */
export function Toast({ toasts = [], onDismiss }) {
  const list = Array.isArray(toasts) ? toasts : [];
  // 镜像列表：{ id, message, type, leaving }
  const [items, setItems] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    setItems((prev) => {
      const incomingIds = list.map((item) => item.id);
      const next = [];

      // 1. 已在镜像中的：若上下文里没了 → 标记 leaving（并挂定时器移除）
      prev.forEach((item) => {
        const stillThere = list.find((entry) => entry.id === item.id);
        if (stillThere) {
          next.push({ ...stillThere, leaving: false });
          return;
        }
        if (item.leaving) {
          next.push(item);
          return;
        }
        next.push({ ...item, leaving: true });
        if (!timersRef.current.has(item.id)) {
          const timer = setTimeout(() => {
            timersRef.current.delete(item.id);
            setItems((current) => current.filter((entry) => entry.id !== item.id));
          }, LEAVE_DELAY);
          timersRef.current.set(item.id, timer);
        }
      });

      // 2. 新增的：追加到尾部
      list.forEach((item) => {
        if (prev.some((entry) => entry.id === item.id)) return;
        next.push({ ...item, leaving: false });
      });

      // 保持新条目在最后（视觉上从下往上堆叠）
      return next.slice(-5);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map((item) => item.id).join('|')]);

  // 卸载清定时器
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  if (!items.length) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      {items.map((item) => {
        const type = Object.values(TOAST_TYPES).includes(item.type) ? item.type : TOAST_TYPES.INFO;
        const Icon = ICON_MAP[type] || InfoIcon;
        return (
          <div
            key={item.id}
            className={`toast__item toast--${type}${item.leaving ? ' is-leaving' : ''}`}
          >
            <span className="toast__icon">
              <Icon />
            </span>
            <span className="toast__text">{item.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="关闭提示"
              onClick={() => (typeof onDismiss === 'function' ? onDismiss(item.id) : undefined)}
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Toast;
