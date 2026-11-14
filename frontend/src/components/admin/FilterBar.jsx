/**
 * 后台工具条（白卡：搜索框 / 下拉 / 日期放 children，右侧重置）
 *
 * props：children, onReset, showReset
 *
 * 用法：
 *   <FilterBar onReset={reset} showReset={keyword !== ''}>
 *     <Input value={keyword} onChange={...} placeholder="搜索会员名" />
 *     <Select value={status} onChange={setStatus} options={FEEDBACK_STATUS_OPTIONS} />
 *   </FilterBar>
 */

/**
 * 工具条。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function FilterBar({ children, onReset, showReset = true, actions = null }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__fields">{children}</div>
      <div className="filter-bar__actions">
        {actions}
        {showReset && typeof onReset === 'function' ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
            <span className="btn__label">重置</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default FilterBar;
