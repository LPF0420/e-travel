/**
 * 景点筛选侧栏（DESIGN §6.2 `.filter-sidebar`）
 *
 * props：
 *   regions   地区数组（id, name, scenicCount）
 *   regionId  当前选中（与 URL 同步，可能是字符串）
 *   onChange(regionId|null)  选「全部」时传 null
 *   total     结果总数（显示在标题右侧）
 *
 * ≤1024px 由 components.css 自动转为顶部横向 chips，无需页面判断。
 *
 * 用法：<FilterSidebar regions={regions} regionId={regionId} onChange={setRegionId} total={total} />
 */

/**
 * 筛选侧栏。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function FilterSidebar({ regions = [], regionId = '', onChange, total = 0 }) {
  const list = Array.isArray(regions) ? regions : [];
  const current = regionId === null || regionId === undefined ? '' : String(regionId);

  /**
   * 选中地区。
   * @param {string} next
   */
  const select = (next) => {
    if (typeof onChange === 'function') onChange(next === '' ? null : next);
  };

  return (
    <div className="filter-sidebar">
      <div className="filter-sidebar__title">
        <span>按地区筛选</span>
        <span className="filter-sidebar__total">共 {total} 个</span>
      </div>

      <div className="filter-sidebar__list">
        <button
          type="button"
          className={`filter-sidebar__item${current === '' ? ' is-active' : ''}`}
          onClick={() => select('')}
          aria-pressed={current === ''}
        >
          全部地区
        </button>

        {list.map((region) => {
          const active = current === String(region.id);
          return (
            <button
              key={region.id}
              type="button"
              className={`filter-sidebar__item${active ? ' is-active' : ''}`}
              onClick={() => select(String(region.id))}
              aria-pressed={active}
            >
              <span>{region.name}</span>
              <span className="filter-sidebar__count">{region.scenicCount || 0}</span>
            </button>
          );
        })}
      </div>

      {current !== '' ? (
        <button type="button" className="filter-sidebar__clear" onClick={() => select('')}>
          清空筛选
        </button>
      ) : null}
    </div>
  );
}

export default FilterSidebar;
