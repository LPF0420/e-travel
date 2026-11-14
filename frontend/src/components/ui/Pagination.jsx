/**
 * 分页（DESIGN §6.2 `.pager`）
 *
 * props：page, pageSize, total, onChange(page), size='md'|'sm', showInfo=true
 * 页码最多 5 个 + 省略号；首页/末页边界禁用上一页/下一页。
 *
 * 用法：<Pagination page={page} pageSize={PAGE_SIZE.SCENICS} total={total} onChange={setPage} />
 */

/** 窗口内最多显示的页码数 */
const MAX_NUMS = 5;

/**
 * 生成页码序列（数字表示页码，'left-ellipsis' / 'right-ellipsis' 表示省略号）。
 * @param {number} current 当前页
 * @param {number} totalPages 总页数
 * @returns {Array<number|string>}
 */
function buildPages(current, totalPages) {
  if (totalPages <= 1) return [1];
  // 页数不多时全部展示
  if (totalPages <= MAX_NUMS + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = [1];
  let start = Math.max(2, current - Math.floor(MAX_NUMS / 2));
  let end = start + MAX_NUMS - 1;
  if (end > totalPages - 1) {
    end = totalPages - 1;
    start = Math.max(2, end - MAX_NUMS + 1);
  }

  if (start > 2) pages.push('left-ellipsis');
  for (let index = start; index <= end; index += 1) pages.push(index);
  if (end < totalPages - 1) pages.push('right-ellipsis');
  pages.push(totalPages);

  return pages;
}

/**
 * 分页组件。
 * @param {object} props
 * @returns {JSX.Element|null}
 */
export function Pagination({
  page = 1,
  pageSize = 10,
  total = 0,
  onChange,
  size = 'md',
  showInfo = true,
  className = '',
}) {
  const safeSize = Number(pageSize) > 0 ? Number(pageSize) : 10;
  const safeTotal = Number(total) > 0 ? Number(total) : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  /**
   * 跳页（越界直接忽略）。
   * @param {number} next
   */
  const go = (next) => {
    if (next === currentPage) return;
    if (next < 1 || next > totalPages) return;
    if (typeof onChange === 'function') onChange(next);
  };

  const classes = ['pager'];
  if (size === 'sm') classes.push('pager--sm');
  if (className) classes.push(className);

  const pages = buildPages(currentPage, totalPages);

  return (
    <nav className={classes.join(' ')} aria-label="分页导航">
      <button
        type="button"
        className="pager__btn"
        onClick={() => go(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="上一页"
      >
        上一页
      </button>

      <span className="pager__nums">
        {pages.map((item) => {
          if (typeof item === 'string') {
            return (
              <span key={item} className="pager__ellipsis" aria-hidden="true">
                …
              </span>
            );
          }
          const isActive = item === currentPage;
          return (
            <button
              key={item}
              type="button"
              className={`pager__num${isActive ? ' is-active' : ''}`}
              onClick={() => go(item)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`第 ${item} 页`}
            >
              {item}
            </button>
          );
        })}
      </span>

      <button
        type="button"
        className="pager__btn"
        onClick={() => go(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="下一页"
      >
        下一页
      </button>

      {showInfo ? (
        <span className="pager__info">
          共 {safeTotal} 条 · 第 {currentPage}/{totalPages} 页
        </span>
      ) : null}
    </nav>
  );
}

export default Pagination;
