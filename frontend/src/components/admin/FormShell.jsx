/**
 * 后台表单外壳（DESIGN：面包屑 + 标题区 + 白卡表单 + 吸底操作条）
 *
 * props：
 *   title       页面标题（如「新增景区」）
 *   desc        副标题/填写提示
 *   breadcrumb  [{ label, to? }]，末项不带 to
 *   children    表单字段
 *   footer      底部操作条内容（通常是「取消 + 保存」两个 Button）
 *   wide        true → 占满内容区宽（两栏表单用）
 *
 * 用法：
 *   <FormShell title="新增景区" breadcrumb={[{label:'景区管理', to:'/admin/scenics'}, {label:'新增'}]}
 *              footer={<><Button variant="ghost" onClick={back}>取消</Button>
 *                        <Button loading={saving} onClick={save}>保存</Button></>}>
 *     <FormField label="景区名称" required>...</FormField>
 *   </FormShell>
 */

import { Link } from 'react-router-dom';

/**
 * 表单外壳。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function FormShell({
  title = '',
  desc = '',
  breadcrumb = [],
  children,
  footer = null,
  wide = false,
  hint = '',
  className = '',
}) {
  const crumbs = Array.isArray(breadcrumb) ? breadcrumb : [];
  const classes = ['form-shell'];
  if (wide) classes.push('form-shell--wide');
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')}>
      {crumbs.length ? (
        <nav className="breadcrumb" aria-label="面包屑">
          {crumbs.map((crumb, index) => (
            <span className="breadcrumb__item" key={`${crumb.label}-${index}`}>
              {index > 0 ? (
                <span className="breadcrumb__sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              {crumb.to && index < crumbs.length - 1 ? (
                <Link className="breadcrumb__link" to={crumb.to}>
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumb__current">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="form-shell__head">
        <h1 className="form-shell__title">{title}</h1>
        {desc ? <p className="form-shell__desc">{desc}</p> : null}
      </div>

      <div className="form-shell__card">
        <div className="form-shell__body">{children}</div>
      </div>

      {footer ? (
        <div className="form-shell__footer">
          {hint ? <span className="form-shell__footer-hint">{hint}</span> : null}
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default FormShell;
