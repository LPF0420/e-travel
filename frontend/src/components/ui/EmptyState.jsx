/**
 * 空态（DESIGN §6.2 `.empty`：单色内联 SVG 插图 + 一句说明 + 一个主操作）
 *
 * props：
 *   title, desc, actionText, onAction, art='mountain'|'suitcase'|'map'|'search'|'inbox', inline
 *
 * inline 用于表格/区块内，只显示一行文案（不渲染插图）。
 * 用法：
 *   <EmptyState art="search" title="没有找到相关景区" desc="试试更换关键词或清空筛选"
 *               actionText="清空筛选" onAction={reset} />
 */

/** 插图：山（景区列表空态） */
function MountainArt() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M8 92h104" />
      <path d="M14 92 44 40l18 28 10-14 22 38" />
      <path d="M44 40l8 14-16 0z" />
      <circle cx="88" cy="30" r="7" />
    </svg>
  );
}

/** 插图：行李箱（收藏空态） */
function SuitcaseArt() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <rect x="26" y="42" width="68" height="50" rx="6" />
      <path d="M46 42V32a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v10" />
      <path d="M26 62h68" />
      <path d="M34 92v6M86 92v6" />
    </svg>
  );
}

/** 插图：地图（地区空态） */
function MapArt() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M18 34l26-10 32 10 26-10v66l-26 10-32-10-26 10z" />
      <path d="M44 24v66M76 34v66" />
      <circle cx="60" cy="54" r="5" />
    </svg>
  );
}

/** 插图：放大镜（搜索无结果） */
function SearchArt() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="54" cy="54" r="26" />
      <path d="M73 73l18 18" />
      <path d="M44 54h20M54 44v20" />
    </svg>
  );
}

/** 插图：收件箱（表格无数据） */
function InboxArt() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M22 66l12-30h52l12 30v24H22z" />
      <path d="M22 66h26l4 10h16l4-10h26" />
    </svg>
  );
}

/** 插图表 */
const ART_MAP = {
  mountain: MountainArt,
  suitcase: SuitcaseArt,
  map: MapArt,
  search: SearchArt,
  inbox: InboxArt,
};

/**
 * 空态。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function EmptyState({
  title = '暂无内容',
  desc = '',
  actionText = '',
  onAction,
  art = 'mountain',
  inline = false,
  className = '',
  ...rest
}) {
  const Art = ART_MAP[art] || ART_MAP.mountain;
  const classes = ['empty'];
  if (inline) classes.push('empty--inline');
  if (className) classes.push(className);

  if (inline) {
    return (
      <div className={classes.join(' ')} {...rest}>
        <span className="empty__art" aria-hidden="true">
          <Art />
        </span>
        <span className="empty__title">{title}</span>
      </div>
    );
  }

  return (
    <div className={classes.join(' ')} {...rest}>
      <span className="empty__art" aria-hidden="true">
        <Art />
      </span>
      <p className="empty__title">{title}</p>
      {desc ? <p className="empty__desc">{desc}</p> : null}
      {actionText && typeof onAction === 'function' ? (
        <div className="empty__action">
          <button type="button" className="btn btn--primary btn--sm" onClick={onAction}>
            <span className="btn__label">{actionText}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
