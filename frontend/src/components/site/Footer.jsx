/**
 * 页脚（DESIGN §6.2：三列 + 底栏版权）
 *
 * 三列：站点介绍 + slogan / 快捷链接 / 联系方式；底栏「© 2026 e起去旅行 · 本站为教学演示项目」。
 */

import { Link } from 'react-router-dom';

import { NAV_ITEMS, ROUTES } from '../../lib/constants.js';

/** 联系方式（教学演示项目，不接真实客服） */
const CONTACTS = [
  { label: '邮箱', value: 'hello@e-travel.demo' },
  { label: '电话', value: '400-000-0000（演示）' },
  { label: '地址', value: '浙江省杭州市西湖区（教学演示）' },
];

/**
 * 页脚。
 * @returns {JSX.Element}
 */
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <p className="footer__brand">
            <span className="navbar__mark">e</span>
            起去旅行
          </p>
          <p className="footer__slogan">把山川湖海写成可读的攻略。用杂志的耐心介绍一处风景，也介绍抵达它的路。</p>
        </div>

        <div>
          <p className="footer__title">快捷链接</p>
          <ul className="footer__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link className="footer__link" to={item.path}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link className="footer__link" to={ROUTES.FAVORITES}>
                我的收藏
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="footer__title">联系我们</p>
          <ul className="footer__list">
            {CONTACTS.map((item) => (
              <li key={item.label} className="footer__item">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer__bottom">
        <div className="footer__copyright">
          <span>© 2026 e起去旅行 · 本站为教学演示项目</span>
          <span>图片仅用于课程演示，版权归原作者所有</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
