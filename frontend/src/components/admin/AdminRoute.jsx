/**
 * 管理员路由守卫（DESIGN §5.2：未登录 → /admin/login?redirect=当前地址）
 *
 * loading 期间只渲染 Spinner，避免先闪登录页。
 *
 * 用法：<AdminRoute><AdminLayout /></AdminRoute>
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAdminAuth } from '../../context/AdminAuthContext.jsx';
import { ROUTES } from '../../lib/constants.js';
import Spinner from '../ui/Spinner.jsx';

/**
 * 后台守卫。
 * @param {{ children?: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export function AdminRoute({ children = null }) {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) return <Spinner fullPage label="正在确认管理员身份" />;

  if (!admin) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.ADMIN_LOGIN}?redirect=${redirect}`} replace />;
  }

  return children || <Outlet />;
}

export default AdminRoute;
