/**
 * 表单字段容器（DESIGN §6.2 `.field`）
 *
 * props：
 *   label, required, error, hint, htmlFor, children, inline
 *
 * 错误文案区固定 min-height:18px（.field__error），避免出现错误时整页跳动。
 * 用法：
 *   <FormField label="会员名" required error={errors.username} htmlFor="username">
 *     <Input id="username" ... />
 *   </FormField>
 */

/**
 * 字段容器。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function FormField({
  label,
  required = false,
  error = '',
  hint = '',
  htmlFor,
  children,
  inline = false,
  className = '',
  ...rest
}) {
  const hasError = Boolean(error && String(error).trim());
  const classes = ['field'];
  if (inline) classes.push('field--inline');
  if (hasError) classes.push('field--error');
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')} {...rest}>
      {label ? (
        <label className="field__label" htmlFor={htmlFor}>
          {required ? <span className="field__required">*</span> : null}
          {label}
        </label>
      ) : null}
      <div className="field__control">{children}</div>
      <div className="field__error" role={hasError ? 'alert' : undefined}>
        {hasError ? String(error) : ''}
      </div>
      {hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  );
}

export default FormField;
