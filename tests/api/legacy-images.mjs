/**
 * 定向回归：图片白名单的「编辑豁免」口径（对应 server/routes/admin/{regions,scenics,travels}.js）。
 *
 * 背景：白名单要求 coverImage 命中真实文件后，库里已存的旧值（如 `/images/xxx.png`）会让
 * 运营「打开旧记录 → 原样保存」必然 1001，等于历史数据不可编辑。工程师改为：
 *   - POST（新增）：严格校验
 *   - PUT（编辑）：值未改动则放行，改动则严格校验
 *
 * 本脚本自建隔离数据：用 seed.js 生成种子 → 把 region/scenic/travel 各 1 条伪造成旧脏值 → 启独立端口 →
 * 用「GET → 原样 PUT」复现运营操作。**全程不碰 server/data/db.json、不碰 3101/3001**。
 *
 * 用法：node tests/api/legacy-images.mjs        （默认端口 3198）
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { PATHS, api, expectFail, expectOk, expectStatus, state } from './lib/harness.mjs';
import { createSeedData } from '../../server/seed.js';

const PORT = Number(process.env.QA_LEGACY_PORT || 3198);
const BASE = `http://127.0.0.1:${PORT}`;
state.base = BASE;

const DIR = path.join(PATHS.root, 'tests', 'api', '.tmp');
const DB = path.join(DIR, 'legacy-db.json');
const LOG = path.join(DIR, 'legacy-server.log');
const ADMIN = { username: 'admin', password: process.env.ETRAVEL_ADMIN_PASSWORD || 'admin123' };
const DIRTY = '/images/jiuzhaigou.png'; // 已下线资产，真实文件只有 .jpg

const results = [];
let child = null;

/**
 * 一条断言。
 * @param {string} name
 * @param {() => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function check(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push(false);
    console.log(`  ✗ ${name}\n      ${String(error.message).split('\n').join('\n      ')}`);
  }
}

/** 等待服务就绪 */
async function waitForServer(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* 继续等 */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

/** 端口占用检查（绝不 kill 别人的进程） */
async function portInUse() {
  try {
    await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

/** 生成「带历史脏值」的隔离种子数据 */
async function prepareDirtySeed() {
  fs.mkdirSync(DIR, { recursive: true });
  fs.rmSync(DB, { force: true });

  const data = await createSeedData();
  const region = data.regions[0];
  const scenic = data.scenics[0];
  const travel = data.travels[0];
  region.coverImage = DIRTY;
  scenic.coverImage = DIRTY;
  scenic.gallery = [DIRTY, scenic.gallery?.[1] || '/images/jiuzhaigou.jpg'];
  travel.coverImage = DIRTY;

  fs.writeFileSync(DB, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[legacy] 已生成隔离脏库（region#${region.id} / scenic#${scenic.id} / travel#${travel.id} 封面均为 ${DIRTY}）\n`);
}

/** 关停并清理 */
async function cleanup() {
  if (child && child.exitCode === null) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
  fs.rmSync(DIR, { recursive: true, force: true });
}

async function main() {
  if (await portInUse()) {
    console.error(`[legacy] 端口 ${PORT} 被占用，请用 QA_LEGACY_PORT 换端口（不会 kill 任何进程）`);
    process.exit(2);
  }

  await prepareDirtySeed();

  child = spawn(process.execPath, ['server/index.js'], {
    cwd: PATHS.root,
    env: { ...process.env, PORT: String(PORT), ETRAVEL_DB_FILE: DB },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logStream = fs.createWriteStream(LOG, { flags: 'w' });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  if (!(await waitForServer())) {
    console.error('[legacy] 服务启动失败：');
    console.error(fs.readFileSync(LOG, 'utf8').slice(-1500));
    await cleanup();
    process.exit(2);
  }

  console.log(`图片白名单「编辑豁免」定向回归 → ${BASE}（隔离库，不碰 db.json / 3001 / 3101）\n`);

  const login = expectOk(await api('POST', '/api/admin/auth/login', { body: ADMIN }), '管理员登录');
  const token = login.token;

  // 取库里真实记录（模拟表单回填）
  const regionDetail = expectOk(await api('GET', '/api/admin/regions/1', { token }), '地区 1 详情').region;
  const scenicDetail = expectOk(await api('GET', '/api/admin/scenics/1', { token }), '景区 1 详情').scenic;
  const travelDetail = expectOk(await api('GET', '/api/admin/travels/1', { token }), '游记 1 详情').travel;

  console.log(`[legacy] 回填值：region=${regionDetail.coverImage} scenic=${scenicDetail.coverImage} travel=${travelDetail.coverImage}\n`);

  await check('[F-32] 地区：旧脏值原样保存 → 放行（200）', async () => {
    const res = await api('PUT', '/api/admin/regions/1', {
      token,
      body: {
        name: regionDetail.name,
        coverImage: regionDetail.coverImage,
        description: regionDetail.description,
        sortOrder: regionDetail.sortOrder,
      },
    });
    const data = expectOk(res, '地区原样保存');
    if (data.region.coverImage !== DIRTY) {
      throw new Error(`旧值被改写了：${data.region.coverImage}`);
    }
  });

  await check('[F-32] 地区：改成另一个非法路径 → 严格拒绝（1001 + data.coverImage）', async () => {
    const res = await api('PUT', '/api/admin/regions/1', {
      token,
      body: {
        name: regionDetail.name,
        coverImage: '/images/not-a-real-asset.jpg',
        description: regionDetail.description,
        sortOrder: regionDetail.sortOrder,
      },
    });
    expectStatus(res, 400, '地区改成非法图片');
    const errors = expectFail(res, 1001, '地区改成非法图片');
    if (!errors || !errors.coverImage) throw new Error('1001 data 应含 coverImage');
  });

  await check('[F-32] 地区：改成合法 .jpg → 放行并落库', async () => {
    const res = await api('PUT', '/api/admin/regions/1', {
      token,
      body: {
        name: regionDetail.name,
        coverImage: '/images/guilin.jpg',
        description: regionDetail.description,
        sortOrder: regionDetail.sortOrder,
      },
    });
    const data = expectOk(res, '地区改成合法图片');
    if (data.region.coverImage !== '/images/guilin.jpg') {
      throw new Error(`新值未落库：${data.region.coverImage}`);
    }
  });

  await check('[F-36] 景区：旧封面+旧图集原样保存 → 放行（200）', async () => {
    const res = await api('PUT', '/api/admin/scenics/1', {
      token,
      body: {
        name: scenicDetail.name,
        regionId: scenicDetail.regionId,
        coverImage: scenicDetail.coverImage,
        gallery: scenicDetail.gallery,
        openTime: scenicDetail.openTime,
        ticketPrice: scenicDetail.ticketPrice,
        traffic: scenicDetail.traffic,
        description: scenicDetail.description,
        isRecommended: scenicDetail.isRecommended,
        level: scenicDetail.level,
        rating: scenicDetail.rating,
        bestSeason: scenicDetail.bestSeason,
        highlights: scenicDetail.highlights,
      },
    });
    const data = expectOk(res, '景区原样保存');
    if (data.scenic.coverImage !== DIRTY) throw new Error(`封面被改写：${data.scenic.coverImage}`);
    if (!data.scenic.gallery.includes(DIRTY)) throw new Error(`图集被改写：${JSON.stringify(data.scenic.gallery)}`);
  });

  await check('[F-36] 景区：图集改动为已下线图片 → 严格拒绝（1001 + data.gallery）', async () => {
    const res = await api('PUT', '/api/admin/scenics/1', {
      token,
      body: {
        name: scenicDetail.name,
        regionId: scenicDetail.regionId,
        coverImage: scenicDetail.coverImage,
        gallery: ['/images/guilin.png'],
        description: scenicDetail.description,
      },
    });
    expectStatus(res, 400, '图集改成已下线图片');
    const errors = expectFail(res, 1001, '图集改成已下线图片');
    if (!errors || !errors.gallery) throw new Error('1001 data 应含 gallery');
  });

  await check('[F-41] 游记：旧封面原样保存 → 放行（200）', async () => {
    const res = await api('PUT', '/api/admin/travels/1', {
      token,
      body: {
        title: travelDetail.title,
        scenicId: travelDetail.scenicId,
        coverImage: travelDetail.coverImage,
        authorName: travelDetail.authorName,
        content: travelDetail.content,
      },
    });
    const data = expectOk(res, '游记原样保存');
    if (data.travel.coverImage !== DIRTY) throw new Error(`封面被改写：${data.travel.coverImage}`);
  });

  await check('[F-31] 新增（POST）仍然严格：已下线 .png 一律 1001', async () => {
    const res = await api('POST', '/api/admin/regions', {
      token,
      body: { name: '新增严格校验', coverImage: DIRTY, description: '', sortOrder: 1 },
    });
    expectStatus(res, 400, '新增地区用已下线图片');
    const errors = expectFail(res, 1001, '新增地区用已下线图片');
    if (!errors || !errors.coverImage) throw new Error('1001 data 应含 coverImage');
  });

  await check('[契约] PUT 是全量替换：省略 coverImage 视为「清空」→ 1001（防日后悄悄改成部分合并）', async () => {
    // DESIGN §3 中 #33/#38/#44 的 body 均为「同上（同 POST 必填项）」，
    // 因此省略必填字段必须报 1001，而不是沿用旧值静默成功。
    const res = await api('PUT', '/api/admin/regions/1', {
      token,
      body: { name: regionDetail.name, description: regionDetail.description, sortOrder: regionDetail.sortOrder },
    });
    expectStatus(res, 400, '地区省略 coverImage');
    const errors = expectFail(res, 1001, '地区省略 coverImage');
    if (!errors || !errors.coverImage) throw new Error('1001 data 应含 coverImage');
  });

  await cleanup();

  const passed = results.filter(Boolean).length;
  console.log(`\n合计 ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch(async (error) => {
  console.error('[legacy] 执行异常：', error);
  await cleanup();
  process.exit(2);
});
