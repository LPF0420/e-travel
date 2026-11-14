/**
 * QA 独立验收入口：`node tests/api/run.mjs`
 *
 * 职责（严格按 QA 交付约束）：
 * 1. **数据安全（默认隔离库）**：用服务端支持的 `ETRAVEL_DB_FILE` 把数据文件指到
 *    `tests/api/.tmp/db.json`，由 `seed.js` 现场生成种子。**联调库 server/data/db.json 全程只读、
 *    不备份不还原不覆盖**，因此可以随时跑，不会与 team-lead/前端联调抢数据。
 *    运行前后会校验联调库 sha256 未变（变了会明确告警）。
 *    兼容旧环境：`QA_SHARED_DB=1` 时退回「备份→重置→还原 server/data/db.json」的老行为。
 * 2. **端口隔离**：默认 3101（前端联调占用 3001），`QA_PORT` 可改；被占用则直接退出码 2，绝不 kill 别人的进程。
 * 3. **不改业务代码**：只读 server/**，仅新增 tests/api/**。
 * 4. **不引外部框架**：node 内置 fetch + assert，自写极简 runner。
 *
 * 退出码：全部通过 0；存在失败 1；环境异常 2。
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { PATHS, auditDbShape, readDb, setDbFile, state } from './lib/harness.mjs';

const PORT = Number(process.env.QA_PORT || 3101);
const BASE = `http://127.0.0.1:${PORT}`;
state.base = BASE;

/** 是否退回「写联调库」的老模式（默认否） */
const USE_SHARED_DB = process.env.QA_SHARED_DB === '1';

/** 隔离库路径：外部已指定则尊重之，否则用 tests/api/.tmp/db.json */
const ISOLATED_DB = path.resolve(
  PATHS.root,
  process.env.ETRAVEL_DB_FILE || path.join('tests', 'api', '.tmp', 'db.json'),
);

const SUITES = [
  (await import('./suites/a-public.mjs')).default,
  (await import('./suites/b-member.mjs')).default,
  (await import('./suites/c-feedback.mjs')).default,
  (await import('./suites/d-admin.mjs')).default,
  (await import('./suites/e-concurrency.mjs')).default,
];

/** 等待服务可访问 */
async function waitForServer(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      // 还没起来，继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

/** 端口是否已被占用（避免误杀前端进程） */
async function portInUse() {
  try {
    await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * 计算文件 sha256（不存在返回 'absent'）。
 * @param {string} filePath
 * @returns {string}
 */
function sha256Of(filePath) {
  if (!fs.existsSync(filePath)) return 'absent';
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/** 隔离模式准备：清空临时库，交由 seed.js 现场生成；同时记录联调库指纹 */
function prepareIsolated() {
  fs.mkdirSync(path.dirname(ISOLATED_DB), { recursive: true });
  fs.rmSync(ISOLATED_DB, { force: true });
  setDbFile(ISOLATED_DB);
  console.log(`[qa] 隔离数据文件 → ${path.relative(PATHS.root, ISOLATED_DB)}（删除后由 seed.js 重新生成）`);
}

/** 隔离模式收尾：删掉临时目录，并确认联调库未被改动 */
function cleanupIsolated(sharedHashBefore) {
  fs.rmSync(path.dirname(ISOLATED_DB), { recursive: true, force: true });
  const sharedHashAfter = sha256Of(PATHS.sharedDbFile);
  const same = sharedHashAfter === sharedHashBefore;
  console.log(
    `[qa] 已删除隔离数据；联调库 server/data/db.json ${same ? '未改动（sha256 一致）' : `**被外部改动过**（${sharedHashBefore.slice(0, 12)} → ${sharedHashAfter.slice(0, 12)}）`}`,
  );
}

/** 兼容模式：备份/恢复联调库（QA_SHARED_DB=1 时使用） */
function prepareShared() {
  fs.mkdirSync(path.dirname(PATHS.dbFile), { recursive: true });
  if (!fs.existsSync(PATHS.backupFile)) {
    fs.copyFileSync(PATHS.dbFile, PATHS.backupFile);
    console.log(`[qa] 已备份基线数据 → ${path.relative(PATHS.root, PATHS.backupFile)}`);
  } else {
    console.log('[qa] 复用已有备份作为基线');
  }
  fs.copyFileSync(PATHS.backupFile, PATHS.dbFile);
  console.log('[qa] 已用备份重置 server/data/db.json（共享模式）');
}

/** 兼容模式收尾：恢复并校验 */
function restoreShared() {
  if (!fs.existsSync(PATHS.backupFile)) {
    console.log('[qa] 未找到备份文件，跳过恢复');
    return;
  }
  fs.copyFileSync(PATHS.backupFile, PATHS.dbFile);
  fs.rmSync(PATHS.backupFile, { force: true });
  const problems = auditDbShape(readDb());
  console.log(`[qa] 已恢复 db.json 并删除备份；集合自洽${problems.length === 0 ? '' : `（异常：${problems.join('；')}）`}`);
}

/** 收尾函数（main 内注册，供 Ctrl+C 时也能恢复/清理） */
let finalizeFn = null;
let finalized = false;

/**
 * 幂等收尾。
 * @returns {void}
 */
function runFinalize() {
  if (finalized || !finalizeFn) return;
  finalized = true;
  finalizeFn();
}

/** 主流程 */
async function main() {
  if (await portInUse()) {
    console.error(`[qa] 端口 ${PORT} 已被占用（可能是上次未关停的进程），请先释放或用 QA_PORT 换端口；本脚本不会 kill 任何进程`);
    process.exit(2);
  }

  const sharedHashBefore = sha256Of(PATHS.sharedDbFile);
  if (USE_SHARED_DB) prepareShared();
  else prepareIsolated();

  const logFile = path.join(PATHS.root, 'tests', 'api', '.server.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'w' });
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: PATHS.root,
    env: {
      ...process.env,
      PORT: String(PORT),
      // 隔离模式把数据文件指到临时目录；共享模式沿用服务端默认路径
      ...(USE_SHARED_DB ? {} : { ETRAVEL_DB_FILE: ISOLATED_DB }),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  const shutdown = async () => {
    await new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }
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
    logStream.end();
  };

  const finalize = () => {
    if (USE_SHARED_DB) restoreShared();
    else cleanupIsolated(sharedHashBefore);
  };
  finalizeFn = finalize;

  let failed = 0;
  let passed = 0;
  const failures = [];

  try {
    const up = await waitForServer();
    if (!up) {
      console.error(`[qa] 服务未能启动，日志见 ${path.relative(PATHS.root, logFile)}`);
      console.error(fs.readFileSync(logFile, 'utf8').slice(-2000));
      await shutdown();
      finalize();
      process.exit(2);
    }

    // 取服务端真实签名密钥（用于构造「签名有效但过期」的 token）
    state.secret = readDb().meta.secret;
    if (!state.secret) {
      console.error('[qa] 未能从数据文件读到 meta.secret，过期 token 用例将跳过');
    }

    console.log(`\n[qa] API = ${BASE}，共 ${SUITES.length} 组用例\n${'='.repeat(72)}`);

    for (const suite of SUITES) {
      console.log(`\n${suite.name}`);
      for (const hook of suite.beforeAll) {
        try {
          await hook();
        } catch (error) {
          console.error(`  ⚠ 前置准备失败：${error.message}`);
        }
      }
      for (const item of suite.tests) {
        const started = Date.now();
        try {
          await item.fn();
          passed += 1;
          console.log(`  ✓ ${item.title}  (${Date.now() - started}ms)`);
        } catch (error) {
          failed += 1;
          failures.push({ suite: suite.name, title: item.title, message: error.message });
          console.log(`  ✗ ${item.title}`);
          console.log(`      ${String(error.message).split('\n').join('\n      ')}`);
        }
      }
    }
  } finally {
    await shutdown();
    runFinalize();
  }

  const total = passed + failed;
  console.log(`\n${'='.repeat(72)}`);
  console.log('## QA 汇总');
  for (const suite of SUITES) {
    const suiteFailures = failures.filter((item) => item.suite === suite.name);
    const suiteTotal = suite.tests.length;
    console.log(`- ${suite.name}：${suiteTotal - suiteFailures.length}/${suiteTotal} 通过`);
  }
  console.log(`- 合计：${passed}/${total} 通过，失败 ${failed}`);

  if (failures.length > 0) {
    console.log('\n## 失败用例');
    for (const item of failures) {
      console.log(`- [${item.suite}] ${item.title}`);
      console.log(`  → ${item.message.replace(/\n/g, ' ')}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

process.on('SIGINT', () => {
  console.error('\n[qa] 收到中断信号，正在清理…');
  runFinalize();
  process.exit(2);
});

main().catch((error) => {
  console.error('[qa] 执行异常：', error);
  process.exit(2);
});
