/**
 * 展示格式化工具（DESIGN §7.2）
 * 纯函数、零依赖、不抛错：任何异常输入都退化为「空串」或原值，避免渲染崩溃。
 */

const MS_MINUTE = 60 * 1000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

/** 中文数字补零 */
function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * 把后端 ISO 字符串（或毫秒时间戳）解析为 Date；非法值返回 null。
 * @param {string|number|Date|null|undefined} input
 * @returns {Date|null}
 */
function toDate(input) {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * '2026-11-15'
 * @param {string|number|Date|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  const date = toDate(iso);
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * '2026-11-15 14:30'
 * @param {string|number|Date|null|undefined} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  const date = toDate(iso);
  if (!date) return '';
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * 相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / N 天前；超过 30 天退化为具体日期。
 * @param {string|number|Date|null|undefined} iso
 * @returns {string}
 */
export function fromNow(iso) {
  const date = toDate(iso);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return formatDate(date); // 未来时间（发布时间填错）直接给日期，避免出现「-3 天前」
  if (diff < MS_MINUTE) return '刚刚';
  if (diff < MS_HOUR) return `${Math.floor(diff / MS_MINUTE)} 分钟前`;
  if (diff < MS_DAY) return `${Math.floor(diff / MS_HOUR)} 小时前`;
  const days = Math.floor(diff / MS_DAY);
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  return formatDate(date);
}

/**
 * 截断并追加省略号（不截断时原样返回）。
 * @param {string|null|undefined} text
 * @param {number} [max=40]
 * @returns {string}
 */
export function truncate(text, max = 40) {
  const source = String(text ?? '').trim();
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 40;
  if (source.length <= limit) return source;
  return `${source.slice(0, limit)}…`;
}

/**
 * 取首字用作头像：'林小满' → '林'；英文取首字母大写；空值返回 '游'。
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function initialOf(name) {
  const source = String(name ?? '').trim();
  if (!source) return '游';
  const first = Array.from(source)[0];
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}

/**
 * 数字缩写：≥10000 显示「1.2万」，≥100000000 显示「1.2亿」，其余原样（千分位不加）。
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value === null || value === undefined ? '0' : String(value);
  const abs = Math.abs(num);
  if (abs >= 100000000) return `${trimZero(num / 100000000)}亿`;
  if (abs >= 10000) return `${trimZero(num / 10000)}万`;
  return String(num);
}

/**
 * 保留 1 位小数并去掉无意义的 .0（供 formatNumber 内部使用）。
 * @param {number} num
 * @returns {string}
 */
function trimZero(num) {
  const fixed = Math.round(num * 10) / 10;
  return Number.isInteger(fixed) ? String(fixed) : fixed.toFixed(1);
}

/**
 * 估算阅读时长（中文 350 字/分钟，最少 1 分钟）。
 * @param {string|null|undefined} text
 * @returns {number} 分钟
 */
export function readingMinutes(text) {
  const source = String(text ?? '').replace(/\s+/g, '');
  if (!source) return 1;
  return Math.max(1, Math.round(source.length / 350));
}

/**
 * 正文分段：按空行或单换行切分，过滤空段（游记正文 / 景区简介共用）。
 * @param {string|null|undefined} text
 * @returns {string[]}
 */
export function splitParagraphs(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!source.trim()) return [];
  return source
    .split(/\n{1,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 门票展示：字符串（'190 元' / '免费'）原样返回，纯数字补「 元」，空值给「免费」。
 * @param {string|number|null|undefined} price
 * @returns {string}
 */
export function formatYuan(price) {
  if (price === null || price === undefined) return '免费';
  if (typeof price === 'number' && Number.isFinite(price)) return price > 0 ? `${price} 元` : '免费';
  const source = String(price).trim();
  if (!source) return '免费';
  if (/^\d+(\.\d+)?$/.test(source)) return Number(source) > 0 ? `${source} 元` : '免费';
  return source;
}

/**
 * 评分展示：数字保留 1 位小数，非数字返回 '—'（用于评分缺失的场景）。
 * @param {number|string|null|undefined} rating
 * @returns {string}
 */
export function formatRating(rating) {
  const num = Number(rating);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return num.toFixed(1);
}
