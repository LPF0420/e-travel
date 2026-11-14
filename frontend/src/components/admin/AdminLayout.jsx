/**
 * 后台外壳布局（DESIGN §6.2 `.admin-shell`：Sidebar + Topbar + 内容区）
 *
 * 页面标题由各页自己渲染（.admin-head），布局只负责骨架与留白。
 *
 * 用法（routes.jsx）：
 *   { element: <AdminRoute><AdminLayout /></AdminRoute>, children: [...] }
 */

import { Outlet } from 'react-router-dom';

import AdminSidebar from './AdminSidebar.jsx';
import AdminTopbar from './AdminTopbar.jsx';

/**
 * 后台布局。
 * @returns {JSX.Element}
 */
export function AdminLayout() {
  return (
    <div className="admin-shell">
      <AdminSidebar />
      <div className="admin-shell__main">
        <AdminTopbar />
        <main className="admin-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
