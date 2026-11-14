/**
 * 路由层共享投影工具：把「内存里的原始记录」转成「接口出参」。
 *
 * 派生字段（不落盘）统一在此计算，且同时给出两种键名：
 * - `regionName / favoriteCount / travelCount / isFavorited`（DESIGN §3 接口表用名）
 * - `_regionName / _favoriteCount / _travelCount / _isFavorited`（DESIGN §2.3 字段表用名）
 * 前端任取其一即可，避免联调时因键名差异返工。
 */

import { db } from '../db.js';

/**
 * @param {number|null|undefined} id
 * @returns {object|undefined}
 */
export function findRegion(id) {
  return db.data.regions.find((item) => item.id === id);
}

/**
 * @param {number|null|undefined} id
 * @returns {object|undefined}
 */
export function findScenic(id) {
  return db.data.scenics.find((item) => item.id === id);
}

/**
 * @param {number|null|undefined} id
 * @returns {object|undefined}
 */
export function findTravel(id) {
  return db.data.travels.find((item) => item.id === id);
}

/**
 * @param {number|null|undefined} id
 * @returns {object|undefined}
 */
export function findMember(id) {
  return db.data.members.find((item) => item.id === id);
}

/**
 * @param {number|null|undefined} id
 * @returns {object|undefined}
 */
export function findAdmin(id) {
  return db.data.admins.find((item) => item.id === id);
}

/**
 * 某景区被收藏次数。
 * @param {number} scenicId
 * @returns {number}
 */
export function favoriteCountOf(scenicId) {
  return db.data.favorites.filter((item) => item.scenicId === scenicId).length;
}

/**
 * 某地区下属景区数。
 * @param {number} regionId
 * @returns {number}
 */
export function scenicCountOf(regionId) {
  return db.data.scenics.filter((item) => item.regionId === regionId).length;
}

/**
 * 某景区的游记数。
 * @param {number} scenicId
 * @returns {number}
 */
export function travelCountOf(scenicId) {
  return db.data.travels.filter((item) => item.scenicId === scenicId).length;
}

/**
 * 某会员是否收藏了某景区。
 * @param {number|null} memberId
 * @param {number} scenicId
 * @returns {boolean}
 */
export function isFavorited(memberId, scenicId) {
  if (!memberId) return false;
  return db.data.favorites.some((item) => item.memberId === memberId && item.scenicId === scenicId);
}

/**
 * 地区出参（含 scenicCount、是否进入首页推荐位）。
 *
 * 首页推荐位规则：按 `sortOrder` 倒序取前 6 个地区（与 `GET /api/regions?limit=6` 一致），
 * 供后台地区列表做「是否进入首页推荐」状态提示（F-30）。
 *
 * @param {object} region
 * @returns {object}
 */
export function regionView(region) {
  if (!region) return null;
  const scenicCount = scenicCountOf(region.id);
  const ordered = db.data.regions
    .slice()
    .sort((a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || a.id - b.id);
  const isHomeRecommended = ordered.slice(0, 6).some((item) => item.id === region.id);
  return {
    ...region,
    scenicCount,
    isHomeRecommended,
    _scenicCount: scenicCount,
    _isHomeRecommended: isHomeRecommended,
  };
}

/**
 * 景区出参（含地区名、收藏数、游记数、是否已收藏）。
 * @param {object} scenic
 * @param {number|null} [memberId=null]
 * @returns {object}
 */
export function scenicView(scenic, memberId = null) {
  if (!scenic) return null;
  const region = findRegion(scenic.regionId);
  const favoriteCount = favoriteCountOf(scenic.id);
  const travelCount = travelCountOf(scenic.id);
  const favorited = isFavorited(memberId, scenic.id);
  return {
    ...scenic,
    regionName: region ? region.name : '',
    favoriteCount,
    travelCount,
    isFavorited: favorited,
    _regionName: region ? region.name : '',
    _favoriteCount: favoriteCount,
    _travelCount: travelCount,
    _isFavorited: favorited,
  };
}

/**
 * 景区精简视图（地区详情侧栏、会员收藏标签用）。
 * @param {object} scenic
 * @returns {object}
 */
export function scenicBrief(scenic) {
  if (!scenic) return null;
  return {
    id: scenic.id,
    name: scenic.name,
    regionId: scenic.regionId,
    coverImage: scenic.coverImage,
    level: scenic.level || '',
    rating: typeof scenic.rating === 'number' ? scenic.rating : null,
    ticketPrice: scenic.ticketPrice || '',
    bestSeason: scenic.bestSeason || '',
    isRecommended: Boolean(scenic.isRecommended),
  };
}

/**
 * 游记出参（含景区名）。
 * @param {object} travel
 * @returns {object}
 */
export function travelView(travel) {
  if (!travel) return null;
  const scenic = findScenic(travel.scenicId);
  const scenicName = scenic ? scenic.name : '';
  return {
    ...travel,
    scenicName,
    _scenicName: scenicName,
  };
}

/**
 * 按发布时间倒序比较（同时间回落 id 倒序）。
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function byPublishedAtDesc(a, b) {
  const left = Date.parse(a.publishedAt || '') || 0;
  const right = Date.parse(b.publishedAt || '') || 0;
  if (right !== left) return right - left;
  return b.id - a.id;
}
