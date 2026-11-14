/**
 * 前台骨架布局（DESIGN §6.2：Navbar + main + Footer，内容不足一屏时页脚贴底）
 *
 * 结构：min-height:100vh 的 flex 纵向布局（.site-shell / .site-shell__main 见 base.css）。
 * 首页首屏导航为透明态（Navbar variant="transparent"），其余页固定白底。
 * 导航为 fixed 定位：main 默认补 padding-top: var(--h-nav)，
 * 首页另加 .site-shell--home 把该内边距清零，让头图从 y=0 开始、导航叠在头图上。
 * 路由变化时回到页面顶部。
 */

import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Footer from './Footer.jsx';
import Navbar from './Navbar.jsx';

/** 首页路径（首屏导航透明态） */
const HOME_PATH = '/';

/**
 * 前台布局。
 * @returns {JSX.Element}
 */
export function SiteLayout() {
  const location = useLocation();
  const isHome = location.pathname === HOME_PATH;

  // 路由切换后回到顶部（详情页 → 列表页时不会停在半空）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const shellClasses = ['site-shell'];
  if (isHome) shellClasses.push('site-shell--home');

  return (
    <div className={shellClasses.join(' ')}>
      <Navbar variant={isHome ? 'transparent' : 'solid'} />
      <main className="site-shell__main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default SiteLayout;
