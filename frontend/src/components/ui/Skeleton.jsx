/**
 * 骨架屏（DESIGN §6.2 `.skeleton`；P1 F-50 列表/详情优先用骨架）
 *
 * props：variant='card'|'line'|'detail', count=1, width, height
 * 另导出 SkeletonGrid（栅格化的卡片骨架，首页/列表首屏用）
 *
 * 用法：
 *   <Skeleton variant="card" count={6} />       // 6 个卡片骨架
 *   <SkeletonGrid count={6} />                  // 自动按 .grid 列数排布
 *   <Skeleton variant="line" count={3} />       // 3 行文字骨架
 */

/** 合法变体 */
const VARIANTS = ['card', 'line', 'detail'];

/**
 * 单个骨架块。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Skeleton({ variant = 'card', count = 1, width, height, className = '' }) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'card';
  const total = Number.isFinite(Number(count)) && Number(count) > 0 ? Math.floor(Number(count)) : 1;
  const classes = ['skeleton', `skeleton--${safeVariant}`];
  if (className) classes.push(className);

  // width / height 属于「动态尺寸」，允许内联
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  const items = [];
  for (let index = 0; index < total; index += 1) {
    items.push(
      <span
        key={`skeleton-${index}`}
        className={classes.join(' ')}
        style={Object.keys(style).length ? style : undefined}
        aria-hidden="true"
      />,
    );
  }

  if (total === 1) return items[0];

  return (
    <div className={safeVariant === 'line' ? 'stack stack--sm' : 'skeleton__grid'} aria-hidden="true">
      {items}
    </div>
  );
}

/**
 * 卡片骨架栅格（列数跟随 .grid 的 --grid-cols，断点由 components.css 控制）。
 * @param {{ count?: number, className?: string }} props
 * @returns {JSX.Element}
 */
export function SkeletonGrid({ count = 6, className = '' }) {
  const total = Number.isFinite(Number(count)) && Number(count) > 0 ? Math.floor(Number(count)) : 6;
  const classes = ['skeleton__grid'];
  if (className) classes.push(className);

  const items = [];
  for (let index = 0; index < total; index += 1) {
    items.push(<span key={`skeleton-card-${index}`} className="skeleton skeleton--card" aria-hidden="true" />);
  }

  return (
    <div className={classes.join(' ')} aria-hidden="true">
      {items}
    </div>
  );
}

export default Skeleton;
