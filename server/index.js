/**
 * Express 应用装配。
 *
 * 顺序要点（规避架构师点名的坑）：
 * 1. `/api/*` 先挂载，且路由内部自带 JSON 404 —— 未命中的 /api 请求绝不会掉进 SPA 回落。
 * 2. 生产态才挂 `dist/` 静态资源与 SPA 回落（`app.get('*')` 内再次排除 `/api`）。
 * 3. 错误兜底放最后：AppError → 统一包；JSON 解析失败 → 1004；未知错误 → 5000。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { db } from './db.js';
import apiRouter from './routes/index.js';
import { AppError, fail } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

/** 服务端口：固定 3001（可用 PORT 覆盖） */
const PORT = Number(process.env.PORT) || 3001;

/** 单次请求体上限：1 MiB = 1048576 字节（超限由错误中间件转成 413 / code 1001） */
const BODY_LIMIT_BYTES = 1024 * 1024;

const app = express();

app.disable('x-powered-by');
// 反向代理/本地调试下让 req.ip 取到真实来源
app.set('trust proxy', true);

// 1) requestId：必须最先挂载，保证 JSON 解析失败 / 请求体超限的响应与日志也能带上 reqId
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 2) JSON 解析：非法 JSON 由错误中间件转成 code 1004；超限转成 413 / code 1001
app.use(express.json({ limit: BODY_LIMIT_BYTES }));

// 3) 业务路由（含 /api/health 与 /api 通配 404）
app.use('/api', apiRouter);

// 4) 生产态静态资源 + SPA 回落
const hasDist = fs.existsSync(path.join(DIST_DIR, 'index.html'));
if (hasDist) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    // 带扩展名的请求视为静态资源（图片/字体/地图等）：
    // 找不到时返回 JSON 404，绝不回落到 index.html——否则前端 <img> 会把 HTML 当图片解码，
    // 或把不存在的资源当成 200 成功，掩盖真实缺失（QA 实测 /images/jiagou.png → 200 text/html）。
    if (path.extname(req.path)) {
      res.status(404).json(fail(1002, '资源不存在', null));
      return;
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

// 5) 兜底 404（未构建前端时，非 /api 的访问也返回 JSON，方便早期联调）
app.use((req, res) => {
  res.status(404).json(fail(1002, '接口不存在', null));
});

// 6) 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error instanceof AppError) {
    const data = error.data === undefined ? null : error.data;
    res.status(error.status || 400).json(fail(error.code, error.message, data));
    return;
  }
  // 请求体超过 express.json 上限（PayloadTooLargeError）：413 + code 1001，
  // 否则前端会把「内容太长」误报成系统故障。
  if (error.type === 'entity.too.large' || error.status === 413 || error.statusCode === 413) {
    console.warn(
      `[server] 请求体超限被拒绝 ${req.method} ${req.originalUrl} reqId=${req.id} limit=${BODY_LIMIT_BYTES}bytes`,
    );
    res.status(413).json(fail(1001, '提交内容过长，请精简后重试', null));
    return;
  }
  // express.json 解析失败（非法 JSON）
  if (error.type === 'entity.parse.failed' || (error instanceof SyntaxError && error.status === 400 && 'body' in error)) {
    res.status(400).json(fail(1004, '请求格式错误', null));
    return;
  }
  console.error(`[server] 未捕获异常 ${req.method} ${req.originalUrl}`, error);
  res.status(500).json(fail(5000, '服务器开小差了，请稍后重试', null));
});

/**
 * 启动：先自举数据，再监听端口。
 * @returns {Promise<void>}
 */
async function start() {
  await db.bootstrap();
  app.listen(PORT, () => {
    console.log(`[server] e起去旅行 API 已启动 → http://localhost:${PORT}/api/health`);
    console.log(`[server] 静态资源：${hasDist ? `已挂载 ${DIST_DIR}` : '未构建（dev 模式由 Vite 提供前端）'}`);
  });
}

start().catch((error) => {
  console.error('[server] 启动失败：', error);
  process.exit(1);
});

export default app;
