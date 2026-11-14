/**
 * 后台表格（DESIGN §6.2 `.table`，紧凑 44px 行高）
 *
 * props：
 *   columns  [{key, title, width, align, render(row,i), sortable, sortKey}]
 *   rows     数据数组
 *   rowKey   行主键字段名或函数，默认 'id'
 *   loading  true → 渲染 5 行骨架
 *   emptyText / emptyAction   空态文案与可选操作节点
 *   onRowClick(row)           整行可点（键盘 Enter 也可）
 *   sortBy / sortOrder / onSort(sortKey, nextOrder)   列头排序
 *   compact  默认 true（后台口径）
 *
 * 用法：
 *   <DataTable
 *     columns={[
 *       { key: 'username', title: '会员名' },
 *       { key: 'createdAt', title: '注册时间', sortable: true, render: (row) => formatDate(row.createdAt) },
 *       { key: 'op', title: '操作', align: 'right', render: (row) => <Button size="sm" variant="text">查看</Button> },
 *     ]}
 *     rows={list} loading={loading} emptyText="没有符合条件的会员"
 *     sortBy={sortBy} sortOrder={order} onSort={handleSort} />
 */

/** 骨架行数 */
const SKELETON_ROWS = 5;

/**
 * 后台表格。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  loading = false,
  emptyText = '暂无数据',
  emptyAction = null,
  onRowClick,
  sortBy = '',
  sortOrder = 'desc',
  onSort,
  compact = true,
  className = '',
}) {
  const cols = Array.isArray(columns) ? columns : [];
  const data = Array.isArray(rows) ? rows : [];
  const isEmpty = !loading && data.length === 0;

  /**
   * 取行 key。
   * @param {object} row
   * @param {number} index
   * @returns {string|number}
   */
  const getRowKey = (row, index) => {
    if (typeof rowKey === 'function') return rowKey(row, index);
    const value = row ? row[rowKey] : undefined;
    return value === undefined || value === null ? index : value;
  };

  /**
   * 列头点击排序。
   * @param {{ key: string, sortKey?: string, sortable?: boolean }} column
   */
  const handleSortClick = (column) => {
    if (!column.sortable || typeof onSort !== 'function') return;
    const key = column.sortKey || column.key;
    const nextOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, nextOrder);
  };

  /**
   * 单元格样式（宽度/对齐属于动态布局，允许内联）。
   * @param {{ width?: string|number, align?: string }} column
   * @returns {object|undefined}
   */
  const cellStyle = (column) => {
    if (!column.width && !column.align) return undefined;
    const style = {};
    if (column.width) style.width = column.width;
    if (column.align) style.textAlign = column.align;
    return style;
  };

  const tableClasses = ['table'];
  if (compact) tableClasses.push('table--compact');
  if (className) tableClasses.push(className);

  return (
    <div className="table-wrap">
      <table className={tableClasses.join(' ')}>
        <thead className="table__head">
          <tr>
            {cols.map((column) => {
              const key = column.sortKey || column.key;
              const sorted = Boolean(sortBy) && sortBy === key;
              const thClasses = ['table__th'];
              if (column.sortable) thClasses.push('table__th--sortable');
              if (sorted) thClasses.push('is-sorted');

              return (
                <th
                  key={column.key}
                  className={thClasses.join(' ')}
                  style={cellStyle(column)}
                  onClick={column.sortable ? () => handleSortClick(column) : undefined}
                  onKeyDown={
                    column.sortable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleSortClick(column);
                          }
                        }
                      : undefined
                  }
                  tabIndex={column.sortable ? 0 : undefined}
                  role={column.sortable ? 'button' : undefined}
                  aria-sort={sorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.title}
                  {column.sortable ? (
                    <span className="table__sort" aria-hidden="true">
                      {sorted ? (sortOrder === 'asc' ? '▲' : '▼') : '▾'}
                    </span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                <tr key={`skeleton-row-${rowIndex}`} className="table__row">
                  {cols.map((column) => (
                    <td key={`skeleton-cell-${column.key}`} className="table__cell">
                      <span className="skeleton skeleton--line" aria-hidden="true" />
                    </td>
                  ))}
                </tr>
              ))
            : null}

          {isEmpty ? (
            <tr className="table__row">
              <td className="table__empty" colSpan={Math.max(1, cols.length)}>
                <span>{emptyText}</span>
                {emptyAction ? <div className="empty__action">{emptyAction}</div> : null}
              </td>
            </tr>
          ) : null}

          {!loading
            ? data.map((row, index) => (
                <tr
                  key={getRowKey(row, index)}
                  className={`table__row${onRowClick ? ' table__row--clickable' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter') onRowClick(row, index);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {cols.map((column) => (
                    <td key={column.key} className="table__cell" style={cellStyle(column)}>
                      {typeof column.render === 'function' ? column.render(row, index) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
