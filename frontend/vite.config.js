/**
 * Vite 配置（前端根 = frontend/，产物输出到项目根的 dist/）
 *
 * 说明（与设计文档/协作约定一致，勿随意改动）：
 * - `root` 必须显式指定：`vite build --config frontend/vite.config.js` 是从**项目根**执行的，
 *   而 Vite 的 root 默认取 `process.cwd()`（即项目根），若不指定 root，构建会去项目根找 index.html 而失败。
 *   这里用 `import.meta.url` 推导（ESM 没有 __dirname），避免写死绝对路径。
 * - `outDir: '../dist'` 是**相对 root** 的路径 → 落到项目根的 `dist/`；因为 outDir 在 root 之外，
 *   必须配 `emptyOutDir: true`，否则 Vite 会拒绝清空并改写到 `frontend/dist`。
 * - `publicDir: 'public'`（相对 root）→ `frontend/public/images/*.jpg` 会在构建时复制到 `dist/images/`，
 *   生产由 server/index.js 静态托管 dist/ 时靠它提供图片。
 * - `strictPort: true`：5173 被占用时直接报错，而不是静默换端口（否则 server.proxy 的假设会失效）。
 * - `host: '127.0.0.1'`：Windows 下 Node 解析 `localhost` 可能只得到 `::1`，导致 Vite 仅监听 IPv6、
 *   而 proxy 目标写的是 IPv4 `127.0.0.1:3001`；显式绑 IPv4 让「浏览器 / curl / 代理」三者口径一致。
 * - 插件保持 `@vitejs/plugin-react` 默认（automatic JSX runtime，所以 .jsx 里无需 import React）。
 *
 * 静态展示模式（仅 GitHub Pages 构建开启）：
 * - 由 VITE_STATIC_MODE=1 显式打开，默认关闭；`npm run build` / `npm run dev` 完全不受影响。
 * - 打开时 base 改为 '/e-travel/'，并注入编译期常量 __STATIC_MODE__ 供 api.js / main.jsx 分支。
 * - 另注入一段极小的 img error 兜底脚本：少数页面（如 About）直接引用了硬编码的 '/images/x.jpg'
 *   常量，子路径部署时会 404，脚本在图片加载失败时补上 base 前缀；不改动任何页面组件。
 */

import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** 前端根目录（= 本配置文件所在目录） */
const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

/** GitHub Pages 项目站的子路径（与仓库名一致） */
const PAGES_BASE = '/e-travel/';

/** 是否构建纯静态展示版：只有显式设置 VITE_STATIC_MODE=1 才为 true */
const staticMode = ['1', 'true', 'yes'].includes(String(process.env.VITE_STATIC_MODE || '').trim().toLowerCase());

/**
 * 静态模式下给硬编码的 '/images/...' 加 base 前缀。
 * 以 Vite 插件方式注入 index.html，避免修改 frontend/index.html 或任何页面组件。
 * @returns {import('vite').Plugin}
 */
function staticImageBasePlugin() {
  const snippet =
    '<script>(function(){' +
    `var base=${JSON.stringify(PAGES_BASE)};` +
    "window.addEventListener('error',function(e){" +
    "var t=e.target;if(!t||t.tagName!=='IMG')return;" +
    "var src=t.getAttribute('src')||'';" +
    "if(src.indexOf('/images/')===0){t.src=base+src.slice(1);}" +
    '},true);' +
    '})();</script>';
  return {
    name: 'etravel-static-image-base',
    enforce: 'post',
    /** @param {string} html */
    transformIndexHtml(html) {
      return html.includes('</head>') ? html.replace('</head>', `    ${snippet}\n  </head>`) : html;
    },
  };
}

export default defineConfig({
  root: frontendRoot,
  plugins: [react(), ...(staticMode ? [staticImageBasePlugin()] : [])],
  // 仅在静态模式切换 base；本地 dev / 常规 build 仍为 '/'
  base: staticMode ? PAGES_BASE : '/',
  // 编译期常量：非静态模式会被 esbuild 常量折叠并移除静态分支，不影响常规产物
  define: {
    __STATIC_MODE__: JSON.stringify(staticMode),
  },
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // 开发期把 /api 透传给本地 API，前端代码里只写相对路径 '/api/xxx'
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
