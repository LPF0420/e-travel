/**
 * 数据持久化内核：单 JSON 文件 + 内存缓存（唯一读源）+ 串行写队列 + 原子落盘。
 *
 * 三条铁律（对应架构师点名的坑）：
 * 1. 读：只读 `db.data` 内存缓存，绝不在 handler 里 fs 读文件。
 * 2. 写：改内存 → `await db.save()` → 再响应；save 内部单 Promise 链串行、唯一 tmp 文件名、rename 原子替换。
 * 3. ID：唯一分配器 `db.nextId(coll)`，删除后不复用。
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLLECTIONS } from './constants.js';
import { createSeedData } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 数据文件路径（运行时生成，不入库）。
 * 默认 `server/data/db.json`；可用环境变量 `ETRAVEL_DB_FILE` 指向别的文件
 * （联调用例/自动化测试各用一份库，避免互相覆盖，也避免动到正在联调的那份）。
 */
export const DB_FILE = process.env.ETRAVEL_DB_FILE
  ? path.resolve(process.cwd(), process.env.ETRAVEL_DB_FILE)
  : path.join(__dirname, 'data', 'db.json');

/** 数据文件所在目录（缺失时自举会创建） */
export const DATA_DIR = path.dirname(DB_FILE);

/** 写队列：所有 save() 串到同一条 Promise 链上，天然串行 */
let writeChain = Promise.resolve();

/** tmp 文件名自增序号，保证并发下文件名唯一 */
let tmpSeq = 0;

/**
 * 空数据结构（db.json 缺失时先占位，随后由 seed 填充）。
 * @returns {object}
 */
function createEmptyData() {
  const counters = {};
  for (const name of COLLECTIONS) counters[name] = 0;
  return {
    meta: { version: 1, seededAt: null, secret: '', counters },
    members: [],
    admins: [],
    regions: [],
    scenics: [],
    travels: [],
    favorites: [],
    feedbacks: [],
    operationLogs: [],
    adminLogs: [],
    memberLoginLogs: [],
  };
}

/** 进程内唯一数据对象（引用不变，内容随读写更新） */
const data = createEmptyData();

/**
 * 把磁盘读到的对象规整成合法结构（缺字段补齐，计数器不低于现有最大 id）。
 * @param {any} parsed
 * @returns {object}
 */
function normalizeData(parsed) {
  const base = createEmptyData();
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};

  const result = {
    meta: {
      version: Number.isInteger(meta.version) ? meta.version : base.meta.version,
      seededAt: typeof meta.seededAt === 'string' ? meta.seededAt : null,
      secret: typeof meta.secret === 'string' ? meta.secret : '',
      counters: {},
    },
    members: [],
    admins: [],
    regions: [],
    scenics: [],
    travels: [],
    favorites: [],
    feedbacks: [],
    operationLogs: [],
    adminLogs: [],
    memberLoginLogs: [],
  };

  const counters = meta.counters && typeof meta.counters === 'object' ? meta.counters : {};
  for (const name of COLLECTIONS) {
    const list = Array.isArray(source[name]) ? source[name].filter((item) => item && typeof item === 'object') : [];
    result[name] = list;
    const maxId = list.reduce((acc, item) => (Number.isInteger(item.id) && item.id > acc ? item.id : acc), 0);
    const stored = Number.isInteger(counters[name]) ? counters[name] : 0;
    result.meta.counters[name] = Math.max(stored, maxId);
  }

  if (!result.meta.secret) {
    result.meta.secret = crypto.randomBytes(32).toString('hex');
  }
  return result;
}

/**
 * 原子写入：唯一 tmp 文件名 → fs.rename（同分区 rename 为原子操作）。
 * 快照在任务真正执行时才序列化，保证写入的是「最新内存状态」。
 * @returns {Promise<void>}
 */
async function writeSnapshot() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const json = JSON.stringify(data, null, 2);
  tmpSeq += 1;
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.${tmpSeq}.tmp`;
  await fs.writeFile(tmpFile, json, 'utf8');
  try {
    await fs.rename(tmpFile, DB_FILE);
  } catch (error) {
    await fs.rm(tmpFile, { force: true }).catch(() => {});
    throw error;
  }
}

export const db = {
  /** 内存数据（业务代码只读约定；写操作改此处后必须 await save()） */
  data,

  /**
   * 分配自增 id（先自增再返回，删除后不复用）。
   * @param {string} collection COLLECTIONS 之一
   * @returns {number}
   */
  nextId(collection) {
    const counters = data.meta.counters;
    const current = Number.isInteger(counters[collection]) ? counters[collection] : 0;
    const next = current + 1;
    counters[collection] = next;
    return next;
  },

  /**
   * 持久化当前内存状态。多次并发调用会被串行执行。
   * @returns {Promise<void>}
   */
  save() {
    const run = writeChain.then(writeSnapshot, writeSnapshot);
    // 队列自身吞掉异常，避免一次写失败让后续写入全部 reject
    writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  },

  /**
   * 启动自举：目录缺失则创建；文件缺失则按种子生成；文件损坏则备份后重建。
   * @returns {Promise<object>} 完整数据快照
   */
  async bootstrap() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    let raw = null;
    try {
      raw = await fs.readFile(DB_FILE, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      raw = null;
    }

    if (raw === null) {
      const seeded = await createSeedData();
      Object.assign(data, seeded);
      // 双保险：任何自举路径都必须有签名密钥，否则 token 无法签发
      if (!data.meta.secret) data.meta.secret = crypto.randomBytes(32).toString('hex');
      await this.save();
      console.log(`[db] 未发现数据文件，已生成种子数据 → ${path.relative(process.cwd(), DB_FILE) || DB_FILE}`);
      return data;
    }

    try {
      const parsed = JSON.parse(raw);
      Object.assign(data, normalizeData(parsed));
      if (!data.meta.seededAt) {
        data.meta.seededAt = new Date().toISOString();
        await this.save();
      }
    } catch (error) {
      const backup = `${DB_FILE}.corrupt-${Date.now()}`;
      await fs.rename(DB_FILE, backup).catch(() => {});
      console.warn(
        `[db] 数据文件解析失败（${error.message}），已备份为 ${path.basename(backup)} 并重新生成种子数据`,
      );
      const seeded = await createSeedData();
      Object.assign(data, seeded);
      await this.save();
    }
    return data;
  },
};

/**
 * 同步判断数据文件是否已存在（诊断用，不参与业务逻辑）。
 * @returns {boolean}
 */
export function dbFileExists() {
  return fsSync.existsSync(DB_FILE);
}
