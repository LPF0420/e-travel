/**
 * 按钮（DESIGN §6.2 `.btn` 全变体）
 *
 * props（页面按此契约使用，不得改动签名）：
 *   children   按钮文案
 *   variant    'primary' | 'ghost' | 'danger' | 'text' | 'accent'   默认 primary
 *   size       'md' | 'sm' | 'lg'                                  默认 md
 *   block      全宽
 *   loading    提交中：显示转圈 + 禁用点击
 *   disabled   禁用
 *   type       'button' | 'submit' | 'reset'                        默认 button
 *   icon       左侧图标（ReactNode）
 *   iconRight  右侧图标（ReactNode）
 *   className  追加类名（与内部类名合并）
 *
 * 用法：<Button variant="primary" loading={saving} onClick={save}>保存</Button>
 */

/** 合法变体（非法值回落 primary，避免出现没有样式的裸按钮） */
const VARIANTS = ['primary', 'ghost', 'danger', 'text', 'accent'];
/** 合法尺寸 */
const SIZES = ['md', 'sm', 'lg'];

/**
 * 按钮组件。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  type = 'button',
  icon = null,
  iconRight = null,
  className = '',
  ...rest
}) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'primary';
  const safeSize = SIZES.includes(size) ? size : 'md';
  const classes = ['btn', `btn--${safeVariant}`, `btn--${safeSize}`];

  if (block) classes.push('btn--block');
  if (loading) classes.push('is-loading');
  if (className) classes.push(className);

  // loading 期间强制 disabled，阻止重复提交
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={classes.join(' ')}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        icon && (
          <span className="btn__icon" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      {children !== undefined && children !== null ? <span className="btn__label">{children}</span> : null}
      {!loading && iconRight ? (
        <span className="btn__icon" aria-hidden="true">
          {iconRight}
        </span>
      ) : null}
    </button>
  );
}

export default Button;
