/**
 * 多行文本（DESIGN §6.2 `.textarea` + 字数计数）
 *
 * props：
 *   value, onChange（原生 event）, rows=5, maxLength, showCount=true,
 *   placeholder, error
 *
 * 用法：<Textarea value={form.content} onChange={(e) => setContent(e.target.value)} maxLength={2000} />
 */

/**
 * 多行文本域。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function Textarea({
  value = '',
  onChange,
  rows = 5,
  maxLength,
  showCount = true,
  placeholder = '',
  error = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const text = value === null || value === undefined ? '' : String(value);
  const hasError = Boolean(error);
  const limit = Number.isFinite(Number(maxLength)) && Number(maxLength) > 0 ? Number(maxLength) : null;
  const isOver = limit !== null && text.length > limit;

  const classes = ['textarea'];
  if (hasError) classes.push('textarea--error');
  if (className) classes.push(className);

  return (
    <div className="textarea-wrap">
      <textarea
        className={classes.join(' ')}
        value={text}
        onChange={onChange}
        rows={rows}
        maxLength={limit === null ? undefined : limit}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        {...rest}
      />
      {showCount ? (
        <span className={`textarea__count${isOver ? ' is-over' : ''}`}>
          {limit === null ? text.length : `${text.length}/${limit}`}
        </span>
      ) : null}
    </div>
  );
}

export default Textarea;
