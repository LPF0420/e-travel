/**
 * Vite 配置（前端根 = frontend/，产物输出到项目根的 dist/）
 *
 * 说明（与设计文档/协作约定一致，勿随意改动）：
 * - `root` 必须显式指定：`vite build --config frontend/vite.config.js` 是从**项目根**执行的，
 *   而 Vite 的 root 默认取 `process.cwd()`（即项目根），若不指定 root，构建会去项目根找 index.html 而失败。
 *   这里用 `import.meta.url` 推导（ESM 没有 __dirname），避免写死绝对路径。
 * - `outDir: '../dist'` 是**相对 root** 的路径 → 落到项目根的 `dist/`；因为 outDir 在 root 之外，
 *   必须配 `emptyOutDir: true`，否则 Vite 会拒绝清空并改写到 `frontend/dist`。
 * - `publicDir: 'public'`（相对 root）→ `frontend/public/images/*.png` 会在构建时复制到 `dist/images/`，
 *   生产由 server/index.js 静态托管 dist/ 时靠它提供图片。
 * - `strictPort: true`：5173 被占用时直接报错，而不是静默换端口（否则 server.proxy 的假设会失效）。
 * - `host: '127.0.0.1'`：Windows 下 Node 解析 `localhost` 可能只得到 `::1`，导致 Vite 仅监听 IPv6、
 *   而 proxy 目标写的是 IPv4 `127.0.0.1:3001`；显式绑 IPv4 让「浏览器 / curl / 代理」三者口径一致。
 * - 插件保持 `@vitejs/plugin-react` 默认（automatic JSX runtime，所以 .jsx 里无需 import React）。
 */

import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** 前端根目录（= 本配置文件所在目录） */
const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
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
