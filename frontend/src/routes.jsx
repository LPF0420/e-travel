/**
 * 路由总表（DESIGN §4：24 个页面 / 27 条路由）
 *
 * 分流规则：
 *   1. 裸路由（无 Layout）：/login、/register 用页面内自带的 AuthLayout；/admin/login 是独立居中卡片。
 *   2. 前台：SiteLayout（Navbar + Footer + Outlet），/favorites 再套 ProtectedRoute。
 *   3. 后台：AdminRoute（未登录跳 /admin/login）→ AdminLayout（侧边栏 + 顶栏 + Outlet）。
 *   4. 兜底：* → NotFound（同时承担 /404 别名）。
 *
 * 守卫内部在登录态 loading 时渲染全屏 Spinner，避免「先闪游客态再跳登录」。
 */

import { Navigate, Route, Routes } from 'react-router-dom';

import SiteLayout from './components/site/SiteLayout.jsx';
import ProtectedRoute from './components/site/ProtectedRoute.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminRoute from './components/admin/AdminRoute.jsx';

// ---------- 前台页面 ----------
import Home from './pages/site/Home.jsx';
import ScenicList from './pages/site/ScenicList.jsx';
import ScenicDetail from './pages/site/ScenicDetail.jsx';
import TravelList from './pages/site/TravelList.jsx';
import TravelDetail from './pages/site/TravelDetail.jsx';
import Login from './pages/site/Login.jsx';
import Register from './pages/site/Register.jsx';
import Favorites from './pages/site/Favorites.jsx';
import About from './pages/site/About.jsx';
import Contact from './pages/site/Contact.jsx';
import NotFound from './pages/site/NotFound.jsx';

// ---------- 后台页面 ----------
import AdminLogin from './pages/admin/AdminLogin.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import MemberList from './pages/admin/MemberList.jsx';
import MemberDetail from './pages/admin/MemberDetail.jsx';
import FeedbackList from './pages/admin/FeedbackList.jsx';
import RegionList from './pages/admin/RegionList.jsx';
import RegionForm from './pages/admin/RegionForm.jsx';
import ScenicListAdmin from './pages/admin/ScenicList.jsx';
import ScenicForm from './pages/admin/ScenicForm.jsx';
import TravelListAdmin from './pages/admin/TravelList.jsx';
import TravelForm from './pages/admin/TravelForm.jsx';
import LogList from './pages/admin/LogList.jsx';
import PasswordChange from './pages/admin/PasswordChange.jsx';

/**
 * @returns {JSX.Element}
 */
export default function AppRoutes() {
  return (
    <Routes>
      {/* ========== 独立页（不套 Layout） ========== */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* ========== 前台 ========== */}
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/scenic" element={<ScenicList />} />
        <Route path="/scenic/:id" element={<ScenicDetail />} />
        <Route path="/travels" element={<TravelList />} />
        <Route path="/travels/:id" element={<TravelDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="/favorites"
          element={(
            <ProtectedRoute>
              <Favorites />
            </ProtectedRoute>
          )}
        />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ========== 后台（登录守卫 → 布局） ========== */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="members" element={<MemberList />} />
          <Route path="members/:id" element={<MemberDetail />} />
          <Route path="feedbacks" element={<FeedbackList />} />
          <Route path="regions" element={<RegionList />} />
          <Route path="regions/new" element={<RegionForm />} />
          <Route path="regions/:id/edit" element={<RegionForm />} />
          <Route path="scenics" element={<ScenicListAdmin />} />
          <Route path="scenics/new" element={<ScenicForm />} />
          <Route path="scenics/:id/edit" element={<ScenicForm />} />
          <Route path="travels" element={<TravelListAdmin />} />
          <Route path="travels/new" element={<TravelForm />} />
          <Route path="travels/:id/edit" element={<TravelForm />} />
          <Route path="logs" element={<LogList />} />
          <Route path="password" element={<PasswordChange />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
