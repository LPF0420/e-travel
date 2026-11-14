/**
 * 后台侧边栏（DESIGN §6.2 / P-13：7 项 ADMIN_NAV + 高亮 + 当前管理员 + 退出）
 *
 * ADMIN_NAV 里的 icon 只是「名字字符串」，本文件负责 name → 内联 SVG 映射。
 * ≤1024px 折叠为 64px 图标栏（title 提示）；≤768px 转为顶部横向滚动（样式见 components.css）。
 */

import { NavLink, useNavigate } from 'react-router-dom';

import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_NAV, ROUTES } from '../../lib/constants.js';
import { initialOf } from '../../lib/format.js';

/** 仪表盘（四宫格） */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}

/** 会员 */
function MembersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8" cy="7" r="3" />
      <path d="M2.8 16c0-2.6 2.3-4.4 5.2-4.4s5.2 1.8 5.2 4.4" />
      <path d="M14 5.2a3 3 0 0 1 0 5.6M15.2 16c0-1.6-.5-2.9-1.4-3.8" />
    </svg>
  );
}

/** 意见反馈 */
function FeedbacksIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 15 13H8l-3.5 3v-3H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M7 8h6M7 10.5h4" />
    </svg>
  );
}

/** 地区（地图） */
function RegionsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 5.5l4.7-1.8 4.6 1.8L17 3.7v10.8l-4.7 1.8-4.6-1.8L3 16.3z" />
      <path d="M7.7 3.7v10.8M12.3 5.5v10.8" />
    </svg>
  );
}

/** 景区（山峰） */
function ScenicsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2.5 16h15" />
      <path d="M3.5 16 8.4 6.4l2.8 5 1.6-2.4L17 16" />
      <circle cx="14.6" cy="5.6" r="1.6" />
    </svg>
  );
}

/** 游记（文档） */
function TravelsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3.2h7l3 3V16a.8.8 0 0 1-.8.8H5a.8.8 0 0 1-.8-.8V4A.8.8 0 0 1 5 3.2Z" />
      <path d="M11.8 3.4v3.2h3.2M7 10h6M7 12.6h4" />
    </svg>
  );
}

/** 日志（列表） */
function LogsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 5.5h12M4 10h12M4 14.5h8" />
      <circle cx="16.2" cy="14.5" r="1.3" />
    </svg>
  );
}

/** 退出 */
function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 3.5H5.4A1.4 1.4 0 0 0 4 4.9v10.2a1.4 1.4 0 0 0 1.4 1.4H8" />
      <path d="M12.6 6.6 16 10l-3.4 3.4M16 10H8.2" />
    </svg>
  );
}

/** icon 名 → 组件 */
const ICON_MAP = {
  dashboard: DashboardIcon,
  members: MembersIcon,
  feedbacks: FeedbacksIcon,
  regions: RegionsIcon,
  scenics: ScenicsIcon,
  travels: TravelsIcon,
  logs: LogsIcon,
};

/**
 * 后台侧边栏。
 * @returns {JSX.Element}
 */
export function AdminSidebar() {
  const navigate = useNavigate();
  const { admin, logout } = useAdminAuth();
  const { showToast } = useToast();

  /**
   * 退出后台（服务端会写 logout 日志）。
   */
  const handleLogout = async () => {
    await logout();
    showToast('已退出后台', 'info');
    navigate(ROUTES.ADMIN_LOGIN);
  };

  return (
    <aside className="admin-shell__sidebar" aria-label="后台导航">
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__logo">e</span>
        <span className="admin-sidebar__brand-text">
          <span className="admin-sidebar__brand-name">e起去旅行</span>
          <span className="admin-sidebar__brand-sub">管理后台</span>
        </span>
      </div>

      <nav className="admin-sidebar__nav">
        {ADMIN_NAV.map((item) => {
          const Icon = ICON_MAP[item.icon] || DashboardIcon;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === ROUTES.ADMIN_HOME}
              title={item.label}
              className={({ isActive }) => `admin-sidebar__link${isActive ? ' is-active' : ''}`}
            >
              <span className="admin-sidebar__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="admin-sidebar__label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="admin-sidebar__foot">
        <div className="admin-sidebar__user">
          <span className="avatar avatar--sm">{initialOf(admin ? admin.username : '')}</span>
          <span className="admin-sidebar__brand-text">
            <span className="admin-sidebar__user-name">{admin ? admin.username : '未登录'}</span>
            <span className="admin-sidebar__user-role">管理员</span>
          </span>
        </div>
        <button type="button" className="admin-sidebar__exit" onClick={handleLogout} title="退出登录">
          <LogoutIcon />
          <span className="admin-sidebar__label">退出登录</span>
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
