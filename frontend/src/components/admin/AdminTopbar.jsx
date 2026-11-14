/**
 * 后台顶栏（DESIGN：面包屑 + 查看前台 + 当前管理员 + 退出）
 *
 * 面包屑由 useLocation 依 ADMIN_NAV 推导，例如：
 *   /admin            → 管理后台 / 仪表盘
 *   /admin/scenics    → 管理后台 / 景区管理
 *   /admin/scenics/new→ 管理后台 / 景区管理 / 新增景区
 */

import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ADMIN_NAV, ROUTES } from '../../lib/constants.js';
import { initialOf } from '../../lib/format.js';

/** 外链图标 */
function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.5 3.5H3.5v9h9v-3" />
      <path d="M9.5 3.5h3v3M12.5 3.5 7.5 8.5" />
    </svg>
  );
}

/** 退出图标 */
function LogoutIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.5 2.8H4.2A1.2 1.2 0 0 0 3 4v8a1.2 1.2 0 0 0 1.2 1.2h2.3" />
      <path d="M10.2 5.4 12.8 8l-2.6 2.6M12.8 8H6.6" />
    </svg>
  );
}

/** 子页面标题（末段路径的中文名，未匹配则用通用词） */
const SUB_PAGE_LABELS = {
  new: '新增',
  edit: '编辑',
};

/**
 * 依当前路径推导面包屑。
 * @param {string} pathname
 * @returns {Array<{ label: string, to?: string }>}
 */
function buildCrumbs(pathname) {
  const crumbs = [{ label: '管理后台', to: ROUTES.ADMIN_HOME }];

  // 匹配最长的菜单前缀（仪表盘路径 '/admin' 单独处理）
  const matched = ADMIN_NAV.filter(
    (item) => item.path !== ROUTES.ADMIN_HOME && (pathname === item.path || pathname.startsWith(`${item.path}/`)),
  ).sort((a, b) => b.path.length - a.path.length)[0];

  if (pathname === ROUTES.ADMIN_PASSWORD) {
    crumbs.push({ label: '修改密码' });
    return crumbs;
  }

  if (!matched) {
    crumbs.push({ label: '仪表盘' });
    return crumbs;
  }

  crumbs.push({ label: matched.label, to: matched.path });

  // 更深一层（/admin/scenics/new、/admin/members/3）
  const rest = pathname.slice(matched.path.length).replace(/^\//, '');
  if (rest) {
    const segment = rest.split('/')[0];
    const label = SUB_PAGE_LABELS[segment] || (/^\d+$/.test(segment) ? '详情' : segment);
    crumbs.push({ label });
  }

  return crumbs;
}

/**
 * 后台顶栏。
 * @returns {JSX.Element}
 */
export function AdminTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, logout } = useAdminAuth();
  const { showToast } = useToast();
  const crumbs = buildCrumbs(location.pathname);

  /**
   * 退出后台。
   */
  const handleLogout = async () => {
    await logout();
    showToast('已退出后台', 'info');
    navigate(ROUTES.ADMIN_LOGIN);
  };

  return (
    <header className="admin-shell__topbar">
      <nav className="admin-topbar__crumbs" aria-label="面包屑">
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
              <span className={index === crumbs.length - 1 ? 'breadcrumb__current' : undefined}>{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="admin-topbar__right">
        <Link className="admin-topbar__link" to={ROUTES.HOME} target="_blank" rel="noreferrer">
          查看前台
          <ExternalIcon />
        </Link>

        <span className="admin-topbar__user">
          <span className="avatar avatar--sm">{initialOf(admin ? admin.username : '')}</span>
          <span className="admin-topbar__user-name">{admin ? admin.displayName || admin.username : '管理员'}</span>
        </span>

        <button type="button" className="admin-topbar__exit" onClick={handleLogout}>
          <LogoutIcon />
          退出
        </button>
      </div>
    </header>
  );
}

export default AdminTopbar;
