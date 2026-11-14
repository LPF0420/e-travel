/**
 * 会员路由守卫（DESIGN §5.1：未登录 → /login?redirect=当前地址）
 *
 * 关键点：
 * 1. loading 未结束时只渲染 <Spinner fullPage />，避免「先闪游客态再跳登录」；
 * 2. redirect 带上 pathname + search，登录成功后原路返回（含筛选与分页）。
 *
 * 用法（routes.jsx）：
 *   { element: <ProtectedRoute />, children: [{ path: '/favorites', element: <Favorites /> }] }
 * 或包裹单个元素：<ProtectedRoute><Favorites /></ProtectedRoute>
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useMemberAuth } from '../../context/MemberAuthContext.jsx';
import { ROUTES } from '../../lib/constants.js';
import Spinner from '../ui/Spinner.jsx';

/**
 * 会员守卫。
 * @param {{ children?: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export function ProtectedRoute({ children = null }) {
  const { member, loading } = useMemberAuth();
  const location = useLocation();

  if (loading) return <Spinner fullPage label="正在确认登录状态" />;

  if (!member) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${ROUTES.MEMBER_LOGIN}?redirect=${redirect}`} replace />;
  }

  return children || <Outlet />;
}

export default ProtectedRoute;
