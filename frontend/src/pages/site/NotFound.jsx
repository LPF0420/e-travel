/**
 * P-11 404 页（PRD §5.1 P-11）
 *
 * 任何非法路径都不白屏：居中内联 SVG 山水插图 + 「路上有点偏航」+ 两个出口按钮。
 * 路由层同时把它挂在 `/404` 与兜底 `*` 上，本页不关心 query / 来源页。
 */

import { Link } from 'react-router-dom';

import { ROUTES } from '../../lib/constants.js';

/**
 * 山水插图（纯内联 SVG，不引用外部图片）。
 * @returns {JSX.Element}
 */
function LostArt() {
  return (
    <svg className="p-404__art" viewBox="0 0 240 160" role="img" aria-label="远山与一条断续的路">
      <circle cx="192" cy="42" r="16" />
      <path d="M8 132h224" />
      <path d="M22 132 74 52l30 46 16-24 34 58" />
      <path d="M74 52l12 20H62z" />
      <path d="M160 132c-6-14 14-22 8-36s12-20 8-32" className="p-404__path" />
      <circle cx="176" cy="60" r="3.5" className="p-404__marker" />
    </svg>
  );
}

/**
 * 404 页。
 * @returns {JSX.Element}
 */
export function NotFound() {
  return (
    <div className="page">
      <div className="container container--narrow">
        <section className="p-404">
          <LostArt />
          <p className="p-404__code">404</p>
          <h1 className="p-404__title">路上有点偏航</h1>
          <p className="p-404__desc">
            这个地址没有对应的页面，可能是链接抄错了一个字，也可能是内容已经搬走。
            回到有风景的地方继续走就好。
          </p>
          <div className="p-404__actions">
            <Link className="btn btn--primary" to={ROUTES.HOME}>
              <span className="btn__label">回到首页</span>
            </Link>
            <Link className="btn btn--ghost" to={ROUTES.SCENIC_LIST}>
              <span className="btn__label">去景区列表</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default NotFound;
