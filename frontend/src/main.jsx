/**
 * 站点入口：样式管线 + 三层 Provider + 路由。
 *
 * 样式引入顺序不可调换：
 *   tokens（变量）→ base（reset/排版/布局）→ components（组件类名）→ 页级样式（site / admin）。
 *
 * Provider 顺序：Toast 在最外层（登录态失效时也要能提示），
 * 会员与管理员两套登录态互不依赖，可并列。
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';

/* global __STATIC_MODE__ */

/** 静态演示站部署在 /e-travel/ 子路径且无服务端 rewrite，用 HashRouter 保证深链不 404 */
const Router = typeof __STATIC_MODE__ !== 'undefined' && __STATIC_MODE__ === true ? HashRouter : BrowserRouter;

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/site-pages.css';
import './styles/admin-pages.css';

import App from './App.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { MemberAuthProvider } from './context/MemberAuthContext.jsx';
import { AdminAuthProvider } from './context/AdminAuthContext.jsx';

const container = document.getElementById('root');

if (!container) {
  throw new Error('找不到挂载节点 #root，请检查 index.html');
}

createRoot(container).render(
  <StrictMode>
    <Router>
      <ToastProvider>
        <MemberAuthProvider>
          <AdminAuthProvider>
            <App />
          </AdminAuthProvider>
        </MemberAuthProvider>
      </ToastProvider>
    </Router>
  </StrictMode>,
);
