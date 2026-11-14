/**
 * 单命令开发启动器：`npm run dev`
 *
 * 做两件事：
 * 1. spawn 一个子进程跑 API（server/index.js，:3001）；
 * 2. 用 Vite 的 Node API `createServer()` 在 :5173 起前端（/api 由 vite.config.js 的 proxy 转发到 3001）。
 *
 * 容错：前端尚未搭好（frontend/vite.config.js 或 vite 依赖缺失）时只启动 API，并给出提示，
 * 保证后端可以独立联调；任一进程退出或收到 SIGINT/SIGTERM 时一起优雅退出。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_ENTRY = path.join(ROOT, 'server', 'index.js');
const VITE_CONFIG = path.join(ROOT, 'frontend', 'vite.config.js');
const FRONTEND_ROOT = path.join(ROOT, 'frontend');
const API_PORT = Number(process.env.PORT) || 3001;

let apiChild = null;
let viteServer = null;
let shuttingDown = false;

/**
 * 关闭全部子进程/服务，然后退出。
 * @param {number} [code=0]
 * @returns {Promise<void>}
 */
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (viteServer) {
    try {
      await viteServer.close();
    } catch (error) {
      console.error('[dev] 关闭 Vite 失败：', error.message);
    }
    viteServer = null;
  }

  if (apiChild && !apiChild.killed) {
    try {
      apiChild.kill('SIGTERM');
    } catch (error) {
      console.error('[dev] 关闭 API 失败：', error.message);
    }
    apiChild = null;
  }

  process.exit(code);
}

/**
 * 启动 API 子进程。
 * @returns {void}
 */
function startApi() {
  apiChild = spawn(process.execPath, [API_ENTRY], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(API_PORT) },
  });

  apiChild.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev] API 进程退出（code=${code}, signal=${signal}），开发服务一并关闭`);
    shutdown(code === 0 ? 0 : 1);
  });

  apiChild.on('error', (error) => {
    console.error('[dev] 无法启动 API 进程：', error.message);
    shutdown(1);
  });
}

/**
 * 启动 Vite 开发服务器；前端未就绪时静默跳过。
 * @returns {Promise<void>}
 */
async function startVite() {
  if (!existsSync(VITE_CONFIG)) {
    console.warn('[dev] 未找到 frontend/vite.config.js，本次仅启动 API（:3001）。前端就绪后重跑 npm run dev 即可。');
    return;
  }

  let createServer;
  try {
    ({ createServer } = await import('vite'));
  } catch (error) {
    console.warn(`[dev] 未能加载 vite（${error.message}），本次仅启动 API（:3001）。`);
    return;
  }

  try {
    viteServer = await createServer({
      configFile: VITE_CONFIG,
      root: FRONTEND_ROOT,
    });
    await viteServer.listen();
    viteServer.printUrls();
  } catch (error) {
    console.error('[dev] Vite 启动失败（API 仍在运行）：', error.message);
    viteServer = null;
  }
}

process.on('SIGINT', () => {
  console.log('\n[dev] 收到 SIGINT，正在关闭开发服务…');
  shutdown(0);
});
process.on('SIGTERM', () => {
  shutdown(0);
});

startApi();
await startVite();

if (!viteServer) {
  console.log('[dev] 当前可用：API → http://localhost:' + API_PORT + '/api/health');
}
