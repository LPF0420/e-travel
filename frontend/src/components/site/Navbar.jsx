/**
 * 前台导航（DESIGN §6.2 / P-01~P-04）
 *
 * props：variant='solid'|'transparent'（首页首屏由 SiteLayout 传 transparent，滚动 >20px 自动转白底）
 *
 * 功能：
 * - 左侧 wordmark「e起去旅行」（e 为 accent 色、微倾斜手写感）
 * - 中间 NAV_ITEMS 高亮（NavLink）
 * - 右侧：搜索图标（展开行内搜索 → /scenic?keyword=）/ 未登录「登录·注册」/ 已登录头像下拉（我的收藏、退出）
 * - ≤768px 折叠为右侧抽屉（遮罩 + 滑入面板）
 */

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import { useMemberAuth } from '../../context/MemberAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { NAV_ITEMS, ROUTES } from '../../lib/constants.js';
import { initialOf } from '../../lib/format.js';

/** 滚动超过该距离导航转实底 */
const SCROLL_THRESHOLD = 20;

/** 搜索图标 */
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

/** 汉堡菜单 */
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** 关闭 */
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** 下拉箭头 */
function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}

/**
 * 前台导航栏。
 * @param {{ variant?: 'solid'|'transparent' }} props
 * @returns {JSX.Element}
 */
export function Navbar({ variant = 'solid' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { member, logout } = useMemberAuth();
  const { showToast } = useToast();

  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef(null);

  // 滚动监听：透明态 → 实底
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 路由变化时关闭所有浮层
  useEffect(() => {
    setMenuOpen(false);
    setDrawerOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // 点击头像下拉外部时收起
  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const isTransparent = variant === 'transparent' && !scrolled;
  const navbarClasses = ['navbar'];
  navbarClasses.push(isTransparent ? 'navbar--transparent' : 'navbar--solid');

  /**
   * 提交搜索：跳到景区列表并带上 keyword。
   * @param {React.FormEvent<HTMLFormElement>} event
   */
  const handleSearch = (event) => {
    event.preventDefault();
    const text = keyword.trim();
    if (!text) return;
    setSearchOpen(false);
    navigate(`${ROUTES.SCENIC_LIST}?keyword=${encodeURIComponent(text)}`);
  };

  /**
   * 退出登录。
   */
  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    showToast('已退出登录', 'info');
    navigate(ROUTES.HOME);
  };

  /**
   * 渲染单个导航项（桌面 / 抽屉共用高亮逻辑）。
   * @param {{ key: string, label: string, path: string }} item
   * @param {string} baseClass
   * @returns {JSX.Element}
   */
  const renderLink = (item, baseClass) => (
    <NavLink
      key={item.key}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => `${baseClass}${isActive ? ' is-active' : ''}`}
    >
      {item.label}
    </NavLink>
  );

  return (
    <header className={navbarClasses.join(' ')}>
      <div className="navbar__inner">
        <Link className="navbar__brand" to={ROUTES.HOME} aria-label="e起去旅行 首页">
          <span className="navbar__mark">e</span>
          起去旅行
        </Link>

        <nav className="navbar__links" aria-label="主导航">
          {NAV_ITEMS.map((item) => renderLink(item, 'navbar__link'))}
        </nav>

        <div className="navbar__actions">
          {searchOpen ? (
            <form className="navbar__search" onSubmit={handleSearch} role="search">
              <input
                className="input"
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索景区 / 地区"
                aria-label="搜索景区"
                autoFocus
              />
              <button type="submit" className="navbar__icon-btn" aria-label="开始搜索">
                <SearchIcon />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="navbar__icon-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="打开搜索"
            >
              <SearchIcon />
            </button>
          )}

          {member ? (
            <div className="navbar__user" ref={menuRef}>
              <button
                type="button"
                className="avatar-btn"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="avatar">{initialOf(member.username)}</span>
                <span className="sr-only">{member.username} 的账户菜单</span>
                <span className="input__icon" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </button>
              {menuOpen ? (
                <div className="navbar__dropdown" role="menu">
                  <div className="navbar__dropdown-name">{member.username}</div>
                  <Link className="navbar__dropdown-item" to={ROUTES.FAVORITES} role="menuitem">
                    我的收藏
                  </Link>
                  <button
                    type="button"
                    className="navbar__dropdown-item"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    退出登录
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link className="btn btn--ghost btn--sm" to={ROUTES.MEMBER_LOGIN}>
              <span className="btn__label">登录 · 注册</span>
            </Link>
          )}

          <button
            type="button"
            className="navbar__burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开菜单"
            aria-expanded={drawerOpen}
          >
            <MenuIcon />
          </button>
        </div>
      </div>

      {drawerOpen ? (
        <>
          <div
            className="navbar__drawer-overlay"
            onClick={() => setDrawerOpen(false)}
            role="presentation"
          />
          <aside className="navbar__drawer" role="dialog" aria-modal="true" aria-label="站点菜单">
            <div className="navbar__drawer-head">
              <span className="navbar__brand">
                <span className="navbar__mark">e</span>
                起去旅行
              </span>
              <button
                type="button"
                className="navbar__icon-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="关闭菜单"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="navbar__drawer-links" aria-label="移动端主导航">
              {NAV_ITEMS.map((item) => renderLink(item, 'navbar__drawer-link'))}
            </nav>

            <div className="navbar__drawer-foot">
              {member ? (
                <>
                  <Link className="btn btn--ghost btn--block" to={ROUTES.FAVORITES}>
                    <span className="btn__label">我的收藏</span>
                  </Link>
                  <button type="button" className="btn btn--text btn--block" onClick={handleLogout}>
                    <span className="btn__label">退出登录</span>
                  </button>
                </>
              ) : (
                <Link className="btn btn--primary btn--block" to={ROUTES.MEMBER_LOGIN}>
                  <span className="btn__label">登录 · 注册</span>
                </Link>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </header>
  );
}

export default Navbar;
