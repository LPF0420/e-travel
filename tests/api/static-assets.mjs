/**
 * 只读回归：静态资源 404 修复 + SPA 回落边界（对应 server/index.js 的 app.get('*') 补丁）。
 *
 * 特点：**完全不写盘** —— 不启动/关停服务、不备份、不还原 db.json，只对「已在运行的服务」发 HTTP 请求。
 * 因此可以安全地指向 team-lead 正在用的 3001，不会干扰其会话。
 *
 * 用法：
 *   node tests/api/static-assets.mjs                                  # 默认 http://127.0.0.1:3001
 *   API_BASE=http://127.0.0.1:3101 node tests/api/static-assets.mjs   # 指定其他实例
 *
 * 注：同一组断言也内联在 suites/a-public.mjs 中，整套跑（run.mjs）时会再验证一遍。
 */

import { api, expectFail, expectStatus, state } from './lib/harness.mjs';

const BASE = (process.env.API_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
state.base = BASE;

const results = [];

/**
 * 执行一条只读断言。
 * @param {string} name
 * @param {() => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function check(name, fn) {
  try {
    await fn();
    results.push({ ok: true, name });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ ok: false, name, message: error.message });
    console.log(`  ✗ ${name}\n      ${String(error.message).split('\n').join('\n      ')}`);
  }
}

console.log(`静态资源/SPA 回落只读回归 → ${BASE}（不启动服务、不碰 db.json）\n`);

await check('[资产] /images/jiuzhaigou.jpg → 200 + image/jpeg', async () => {
  const res = await api('GET', '/images/jiuzhaigou.jpg');
  expectStatus(res, 200, 'jiuzhaigou.jpg');
  if (!res.contentType.startsWith('image/jpeg')) {
    throw new Error(`Content-Type 期望 image/jpeg，实际 ${res.contentType}`);
  }
});

await check('[资产] 已下线的 /images/jiuzhaigou.png → 404 + JSON 1002（不得回落 index.html）', async () => {
  const res = await api('GET', '/images/jiuzhaigou.png');
  if (res.status !== 404) {
    throw new Error(`期望 HTTP 404，实际 ${res.status} + ${res.contentType}（回落成 index.html 说明补丁失效）`);
  }
  if (!res.contentType.includes('application/json')) {
    throw new Error(`期望 application/json，实际 ${res.contentType}`);
  }
  expectFail(res, 1002, 'jiuzhaigou.png');
});

await check('[SPA] /no-such-page（无扩展名）→ 200 + text/html 且含 <div id="root">', async () => {
  const res = await api('GET', '/no-such-page');
  expectStatus(res, 200, '/no-such-page');
  if (!res.contentType.includes('text/html')) {
    throw new Error(`期望 text/html（SPA 回落），实际 ${res.contentType}`);
  }
  if (!res.text.includes('id="root"')) {
    throw new Error('回落内容不含 <div id="root"> 挂载点，可能不是 index.html');
  }
});

await check('[SPA] /api/not-exist 仍为 404 + JSON 1002（补丁未把 /api 拖进静态分支）', async () => {
  const res = await api('GET', '/api/not-exist');
  expectStatus(res, 404, '/api/not-exist');
  if (!res.contentType.includes('application/json')) {
    throw new Error(`期望 application/json，实际 ${res.contentType}`);
  }
  expectFail(res, 1002, '/api/not-exist');
});

const passed = results.filter((item) => item.ok).length;
console.log(`\n合计 ${passed}/${results.length} 通过`);
process.exit(passed === results.length ? 0 : 1);
