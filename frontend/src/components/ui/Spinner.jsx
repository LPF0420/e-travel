/**
 * 加载指示（DESIGN §7.5：首屏区块内用 Spinner，列表优先 Skeleton）
 *
 * props：size='md'|'sm'|'lg', label, inline, fullPage
 *   inline   行内小转圈（按钮旁、表格单元格）
 *   fullPage 整页居中占位（守卫 loading 时用）
 *
 * 用法：<Spinner fullPage />
 *      <Spinner inline label="加载中" />
 */

/** 合法尺寸 */
const SIZES = ['md', 'sm', 'lg'];

/**
 * 加载指示器。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Spinner({ size = 'md', label = '', inline = false, fullPage = false, className = '' }) {
  const safeSize = SIZES.includes(size) ? size : 'md';
  const classes = ['spinner', `spinner--${safeSize}`];
  if (inline) classes.push('spinner--inline');
  if (fullPage) classes.push('spinner--full');
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')} role="status" aria-live="polite">
      <span className="spinner__ring" aria-hidden="true" />
      {label ? <span className="spinner__label">{label}</span> : null}
      <span className="sr-only">{label || '加载中'}</span>
    </div>
  );
}

export default Spinner;
