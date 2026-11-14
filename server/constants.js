/**
 * 全局常量：角色、token 有效期、分页尺寸、日志枚举与上限、反馈状态、图片素材。
 * 只放「不会在运行期变化」的静态值，业务数据一律走 db.js。
 */

/** 两套账号体系（互不可见） */
export const ROLES = Object.freeze({
  MEMBER: 'member',
  ADMIN: 'admin',
});

/** token 有效期：7 天（payload.exp 为秒级时间戳） */
export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** 单类日志保留上限，超出裁剪最旧记录 */
export const LOG_LIMIT = 1000;

/** 分页尺寸（与 DESIGN §7.3 一致） */
export const PAGE_SIZE = Object.freeze({
  SCENICS: 9, // 前台景区列表 3 列 × 3 行
  TRAVELS: 6, // 前台游记列表 2 列 × 3 行
  FAVORITES: 9, // 我的收藏 3 列
  ADMIN_LIST: 10, // 后台会员/景区/游记/意见
  LOGS: 20, // 后台日志
  MAX: 100, // 服务端上限
});

/** 景区列表排序枚举 */
export const SCENIC_SORTS = Object.freeze(['default', 'recommend', 'latest', 'popular']);

/** 操作日志枚举 */
export const LOG_MODULES = Object.freeze(['region', 'scenic', 'travel']);
export const LOG_ACTIONS = Object.freeze(['create', 'update', 'delete']);
export const LOG_RESULTS = Object.freeze(['success', 'fail']);

/** 管理员日志事件枚举 */
export const ADMIN_LOG_EVENTS = Object.freeze(['login', 'login_fail', 'logout', 'change_password']);

/** 意见反馈状态 */
export const FEEDBACK_STATUS = Object.freeze({
  PENDING: 'pending',
  RESOLVED: 'resolved',
});

/** 会员列表可排序字段 */
export const MEMBER_SORT_FIELDS = Object.freeze(['id', 'createdAt']);

/** 图片素材强制前缀（不新增图片文件） */
export const IMAGE_PATH_PREFIX = '/images/';

/** 允许的图片扩展名（与 frontend/public/images 实际素材一致：当前均为 .jpg） */
export const IMAGE_EXTENSIONS = Object.freeze(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** 全部合法图片路径（9 张真实素材，实际后缀以磁盘为准，此表仅作文档与提示样例） */
export const AVAILABLE_IMAGES = Object.freeze([
  '/images/jiuzhaigou.jpg',
  '/images/zhangjiajie.jpg',
  '/images/westlake.jpg',
  '/images/potala.jpg',
  '/images/huangshan.jpg',
  '/images/sanya.jpg',
  '/images/guilin.jpg',
  '/images/lijiang.jpg',
  '/images/about.jpg',
]);

/** db.json 顶层集合名（自增计数器同键） */
export const COLLECTIONS = Object.freeze([
  'members',
  'admins',
  'regions',
  'scenics',
  'travels',
  'favorites',
  'feedbacks',
  'operationLogs',
  'adminLogs',
  'memberLoginLogs',
]);

/** 默认密码长度区间（前后端同一套阈值） */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 20;
