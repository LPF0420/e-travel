/**
 * 生成 GitHub Pages 静态展示版的数据快照。
 *
 * 只从 server/data/db.json 提取「公开可读」的字段，输出 frontend/public/static-data.json；
 * Vite 构建时会把 public/ 原样拷进 dist/，因此页面可离线读取内容而无需后端。
 *
 * 脱敏策略（双保险）：
 * 1. 白名单投影：只拷贝下面 *_FIELDS 声明的字段，members / admins / favorites / 各类日志
 *    以及 meta.secret 一律不会进入输出；
 * 2. 输出断言：序列化后扫描禁止的键名，并逐一比对 db 里的 passwordHash / 手机号 / 邮箱 /
 *    secret 等敏感值，一旦命中立即抛错，避免将来有人误加字段造成泄露。
 *
 * 兼容 Windows：路径一律用 path.join + fileURLToPath，不硬编码 '/'。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const DB_FILE = path.join(PROJECT_ROOT, 'server', 'data', 'db.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'frontend', 'public', 'static-data.json');

/** 地区公开字段（与 server/routes/shared.js 的 regionView 原始数据一致） */
const REGION_FIELDS = ['id', 'name', 'coverImage', 'description', 'sortOrder', 'createdAt', 'updatedAt'];

/** 景区公开字段（scenicView 的派生字段由前端按同样口径现算） */
const SCENIC_FIELDS = [
  'id',
  'name',
  'regionId',
  'coverImage',
  'gallery',
  'level',
  'rating',
  'openTime',
  'ticketPrice',
  'bestSeason',
  'highlights',
  'traffic',
  'description',
  'isRecommended',
  'viewCount',
  'createdAt',
  'updatedAt',
];

/** 游记公开字段（authorMemberId 是公开署名关联，不含任何会员资料） */
const TRAVEL_FIELDS = [
  'id',
  'title',
  'scenicId',
  'coverImage',
  'authorName',
  'authorMemberId',
  'content',
  'publishedAt',
  'createdAt',
  'updatedAt',
];

/** 禁止出现在快照中的键名（按 JSON 键精确匹配） */
const FORBIDDEN_KEYS = [
  'passwordHash',
  'token',
  'secret',
  'ip',
  'members',
  'admins',
  'favorites',
  'feedbacks',
  'operationLogs',
  'adminLogs',
  'memberLoginLogs',
];

/**
 * 按白名单取字段。
 * @param {object} source 原始记录
 * @param {string[]} fields 允许的字段名
 * @returns {object} 新对象
 */
function pickFields(source, fields) {
  const row = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      row[field] = source[field];
    }
  }
  return row;
}

/**
 * 投影一个集合。
 * @param {any} list 原始数组
 * @param {string[]} fields 允许的字段名
 * @returns {object[]}
 */
function projectList(list, fields) {
  return (Array.isArray(list) ? list : []).map((item) => pickFields(item, fields));
}

/**
 * 按景区聚合收藏数（只导出数量，不导出 memberId / 收藏记录）。
 * @param {any[]} favorites
 * @returns {Record<string, number>}
 */
function aggregateFavoriteCounts(favorites) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of Array.isArray(favorites) ? favorites : []) {
    const key = String(item.scenicId);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * 脱敏断言：命中任何禁止键或敏感值就抛错。
 * @param {object} snapshot 待写出的快照
 * @param {object} db 原始 db（仅用于取敏感值做反查）
 * @returns {void}
 */
function assertNoSecrets(snapshot, db) {
  const text = JSON.stringify(snapshot);

  for (const key of FORBIDDEN_KEYS) {
    if (text.includes(`"${key}"`)) {
      throw new Error(`[build-static] 快照中出现了禁止的键名 "${key}"，已中止写出`);
    }
  }

  /** @type {string[]} */
  const sensitiveValues = [];
  if (db && typeof db === 'object') {
    if (db.meta && typeof db.meta.secret === 'string') sensitiveValues.push(db.meta.secret);
    for (const member of Array.isArray(db.members) ? db.members : []) {
      if (typeof member.passwordHash === 'string') sensitiveValues.push(member.passwordHash);
      if (typeof member.phone === 'string') sensitiveValues.push(member.phone);
      if (typeof member.email === 'string') sensitiveValues.push(member.email);
    }
    for (const admin of Array.isArray(db.admins) ? db.admins : []) {
      if (typeof admin.passwordHash === 'string') sensitiveValues.push(admin.passwordHash);
    }
    for (const log of [
      ...(Array.isArray(db.operationLogs) ? db.operationLogs : []),
      ...(Array.isArray(db.adminLogs) ? db.adminLogs : []),
      ...(Array.isArray(db.memberLoginLogs) ? db.memberLoginLogs : []),
    ]) {
      if (typeof log.ip === 'string') sensitiveValues.push(log.ip);
    }
  }

  for (const value of sensitiveValues) {
    if (value && text.includes(value)) {
      throw new Error('[build-static] 快照中出现了敏感值（密码哈希 / 手机号 / 邮箱 / secret / ip），已中止写出');
    }
  }
}

/**
 * 主流程。
 * @returns {void}
 */
function main() {
  let raw = '';
  try {
    raw = fs.readFileSync(DB_FILE, 'utf8');
  } catch (error) {
    throw new Error(`[build-static] 读取 ${DB_FILE} 失败：${error.message}`);
  }

  /** @type {any} */
  const db = JSON.parse(raw);

  const regions = projectList(db.regions, REGION_FIELDS);
  const scenics = projectList(db.scenics, SCENIC_FIELDS);
  const travels = projectList(db.travels, TRAVEL_FIELDS);

  // scenic→travels 通过 travels[].scenicId 关联；travel→scenic 同理，
  // scenicBrief 由前端按 server/routes/shared.js 的同名字段现算，无需额外导出映射表。
  const snapshot = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'server/data/db.json',
      note: '公开只读快照：仅含地区 / 景区 / 游记与收藏计数，已脱敏',
    },
    stats: {
      regionCount: regions.length,
      scenicCount: scenics.length,
      travelCount: travels.length,
    },
    favoriteCounts: aggregateFavoriteCounts(db.favorites),
    regions,
    scenics,
    travels,
  };

  assertNoSecrets(snapshot, db);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log(`[build-static] 已生成 ${OUTPUT_FILE}`);
  console.log(
    `[build-static] regions=${regions.length} scenics=${scenics.length} travels=${travels.length} ` +
      `favoriteCounts=${Object.keys(snapshot.favoriteCounts).length}（脱敏校验通过）`,
  );
}

main();
