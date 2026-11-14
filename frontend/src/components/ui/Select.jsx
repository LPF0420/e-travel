/**
 * 下拉选择（DESIGN §6.2 `.select`）
 *
 * props：
 *   value, onChange（**传值，不是 event**）, options=[{value,label,disabled?}],
 *   placeholder='请选择', disabled, error
 *
 * 用法：<Select value={regionId} onChange={setRegionId} options={regions.map(r => ({value: r.id, label: r.name}))} />
 */

/**
 * 下拉箭头。
 * @returns {JSX.Element}
 */
function ArrowIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

/**
 * 下拉框。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Select({
  value = '',
  onChange,
  options = [],
  placeholder = '请选择',
  disabled = false,
  error = false,
  className = '',
  ...rest
}) {
  const hasError = Boolean(error);
  const list = Array.isArray(options) ? options : [];

  /**
   * 原生 change → 交给外部的是「值」。
   * @param {React.ChangeEvent<HTMLSelectElement>} event
   */
  const handleChange = (event) => {
    if (typeof onChange === 'function') onChange(event.target.value, event);
  };

  const classes = ['select'];
  if (hasError) classes.push('select--error');
  if (className) classes.push(className);

  return (
    <div className="select-wrap">
      <select
        className={classes.join(' ')}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {list.map((option) => (
          <option key={String(option.value)} value={option.value} disabled={Boolean(option.disabled)}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="select-wrap__arrow" aria-hidden="true">
        <ArrowIcon />
      </span>
    </div>
  );
}

export default Select;
