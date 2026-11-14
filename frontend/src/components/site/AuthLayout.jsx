/**
 * 登录 / 注册分栏布局（DESIGN §6.2：左图右表单，≤768px 隐藏图区）
 *
 * props：title, subtitle, children, footer
 * 左图固定用 AUTH_SIDE_IMAGE（westlake），图上叠一句 slogan。
 *
 * 用法：
 *   <AuthLayout title="欢迎回来" subtitle="登录后可收藏喜欢的景区"
 *               footer={<>还没有账号？<Link to="/register">立即注册</Link></>}>
 *     <form className="auth-split__form">...</form>
 *   </AuthLayout>
 */

import { Link } from 'react-router-dom';

import { AUTH_SIDE_IMAGE, ROUTES } from '../../lib/constants.js';

/**
 * 登录页布局。
 * @param {object} props
 * @returns {JSX.Element}
 */
export function AuthLayout({ title = '', subtitle = '', children, footer = null }) {
  return (
    <div className="auth-split">
      <div className="auth-split__media">
        <img src={AUTH_SIDE_IMAGE} alt="西湖" />
        <div className="auth-split__overlay" />
        <p className="auth-split__slogan">
          湖山千里，行则将至
          <small>记录每一次出发，也收藏下一次想去的地方。</small>
        </p>
      </div>

      <div className="auth-split__panel">
        <div className="auth-split__card">
          <Link className="auth-split__brand" to={ROUTES.HOME}>
            <span className="navbar__mark">e</span>
            起去旅行
          </Link>
          {title ? <h1 className="auth-split__title">{title}</h1> : null}
          {subtitle ? <p className="auth-split__subtitle">{subtitle}</p> : null}
          <div className="auth-split__form">{children}</div>
          {footer ? <div className="auth-split__footer">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
