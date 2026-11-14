/**
 * 单行输入框（DESIGN §6.2 `.input`）
 *
 * props（受控组件，onChange 传原生 event）：
 *   value, onChange, type='text', placeholder, disabled, error,
 *   prefix, suffix（图标位：ReactNode 或字符串）, maxLength, autoComplete,
 *   name, onEnter（回车触发）, autoFocus
 *
 * type='password' 时内置显隐按钮。
 * 用法：<Input value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} placeholder="请输入会员名" />
 */

import { useState } from 'react';

/** 眼睛图标（显示） */
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

/** 眼睛图标（隐藏，带斜杠） */
function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4l16 16" />
      <path d="M9.6 5.9A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3 3.7" />
      <path d="M6.6 7.4A16.8 16.8 0 0 0 2 12s3.6 6.5 10 6.5a9.8 9.8 0 0 0 3.9-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

/**
 * 输入框。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Input({
  value = '',
  onChange,
  type = 'text',
  placeholder = '',
  disabled = false,
  error = false,
  prefix = null,
  suffix = null,
  maxLength,
  autoComplete = 'off',
  name,
  onEnter,
  autoFocus = false,
  className = '',
  ...rest
}) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && revealed ? 'text' : type;
  const hasError = Boolean(error);
  const hasWrap = Boolean(prefix) || Boolean(suffix) || isPassword;

  /**
   * 统一 keydown：回车触发 onEnter（不阻止默认行为，交给表单 submit 或页面逻辑）。
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && typeof onEnter === 'function') onEnter(event);
    if (typeof rest.onKeyDown === 'function') rest.onKeyDown(event);
  };

  const { onKeyDown, ...restProps } = rest;

  const inputProps = {
    type: effectiveType,
    value: value === null || value === undefined ? '' : value,
    onChange,
    placeholder,
    disabled,
    maxLength,
    autoComplete,
    name,
    autoFocus,
    onKeyDown: handleKeyDown,
    ...restProps,
  };

  // 无图标、非密码：裸输入框（减少一层 DOM）
  if (!hasWrap) {
    const classes = ['input'];
    if (hasError) classes.push('input--error');
    if (className) classes.push(className);
    return <input className={classes.join(' ')} aria-invalid={hasError || undefined} {...inputProps} />;
  }

  const wrapClasses = ['input-wrap'];
  if (hasError) wrapClasses.push('input-wrap--error');
  if (disabled) wrapClasses.push('input-wrap--disabled');
  if (className) wrapClasses.push(className);

  return (
    <div className={wrapClasses.join(' ')}>
      {prefix ? (
        <span className="input__icon" aria-hidden="true">
          {prefix}
        </span>
      ) : null}
      <input className="input" aria-invalid={hasError || undefined} {...inputProps} />
      {suffix ? (
        <span className="input__icon" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
      {isPassword ? (
        <button
          type="button"
          className="input__action"
          onClick={() => setRevealed((prev) => !prev)}
          aria-label={revealed ? '隐藏密码' : '显示密码'}
          tabIndex={disabled ? -1 : 0}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      ) : null}
    </div>
  );
}

export default Input;
