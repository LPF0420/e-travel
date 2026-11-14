/**
 * 全站常量（DESIGN §6.3 图片规范 + §7.3 分页 + 后端枚举对齐）
 *
 * 硬约束：枚举值必须与 server/constants.js 一致，否则后端会返回 1001 校验错误。
 * 修改本文件前请先核对后端：SCENIC_SORTS / FEEDBACK_STATUS / LOG_MODULES / SCENIC 等级。
 */

/* ============================================================
 * 路由常量（守卫与跳转统一引用，禁止页面里写字面量）
 * ============================================================ */
export const ROUTES = Object.freeze({
  HOME: '/',
  SCENIC_LIST: '/scenic',
  TRAVEL_LIST: '/travels',
  ABOUT: '/about',
  CONTACT: '/contact',
  MEMBER_LOGIN: '/login',
  MEMBER_REGISTER: '/register',
  FAVORITES: '/favorites',
  ADMIN_LOGIN: '/admin/login',
  ADMIN_HOME: '/admin',
  ADMIN_PASSWORD: '/admin/password',
  NOT_FOUND: '/404',
});

/** 前台一级导航（顺序即导航栏顺序；key 用于高亮匹配） */
export const NAV_ITEMS = Object.freeze([
  { key: 'home', label: '首页', path: '/' },
  { key: 'scenic', label: '景区', path: '/scenic' },
  { key: 'travels', label: '游记', path: '/travels' },
  { key: 'about', label: '关于我们', path: '/about' },
  { key: 'contact', label: '联系我们', path: '/contact' },
]);

/**
 * 后台侧边栏 7 项菜单（DESIGN §6.2 / §4 P-13~P-23）。
 * icon 只是「图标名字符串」，由 AdminSidebar 内联 SVG 映射渲染，本文件不引入任何组件。
 */
export const ADMIN_NAV = Object.freeze([
  { key: 'dashboard', label: '仪表盘', path: '/admin', icon: 'dashboard' },
  { key: 'members', label: '会员管理', path: '/admin/members', icon: 'members' },
  { key: 'feedbacks', label: '意见建议', path: '/admin/feedbacks', icon: 'feedbacks' },
  { key: 'regions', label: '地区管理', path: '/admin/regions', icon: 'regions' },
  { key: 'scenics', label: '景区管理', path: '/admin/scenics', icon: 'scenics' },
  { key: 'travels', label: '游记管理', path: '/admin/travels', icon: 'travels' },
  { key: 'logs', label: '日志管理', path: '/admin/logs', icon: 'logs' },
]);

/* ============================================================
 * 图片素材（PRD 附录 A.1：仅这 9 张，不得新增路径）
 * ============================================================ */
const IMAGE_PREFIX = '/images/';

/** 键名即文件名（去掉 .jpg），值即 coverImage 全路径 */
export const IMAGES = Object.freeze({
  jiuzhaigou: `${IMAGE_PREFIX}jiuzhaigou.jpg`,
  zhangjiajie: `${IMAGE_PREFIX}zhangjiajie.jpg`,
  westlake: `${IMAGE_PREFIX}westlake.jpg`,
  potala: `${IMAGE_PREFIX}potala.jpg`,
  huangshan: `${IMAGE_PREFIX}huangshan.jpg`,
  sanya: `${IMAGE_PREFIX}sanya.jpg`,
  guilin: `${IMAGE_PREFIX}guilin.jpg`,
  lijiang: `${IMAGE_PREFIX}lijiang.jpg`,
  about: `${IMAGE_PREFIX}about.jpg`,
});

/** 合法图片路径数组（后台表单做 datalist / 校验提示用） */
export const IMAGE_PATHS = Object.freeze(Object.values(IMAGES));

/** 图片路径前缀（后端校验口径） */
export const IMAGE_PATH_PREFIX = IMAGE_PREFIX;

/** 首页横幅与登录页侧图（DESIGN §6.3，从推荐景区图里取） */
export const HERO_IMAGE = IMAGES.jiuzhaigou;
export const AUTH_SIDE_IMAGE = IMAGES.westlake;

/* ============================================================
 * 接口路径备忘（易记错的几个，统一在这里写死，页面别手打字符串）
 * ------------------------------------------------------------
 * 公开统计   GET  /api/stats/public     → { regionCount, scenicCount, travelCount }
 *                  （不是 /api/stats；关于我们页与后台仪表盘口径一致）
 * 操作日志   GET  /api/admin/logs/operations    ?module&action&result&startDate&endDate&page
 * 管理员日志 GET  /api/admin/logs/admins        ?event&startDate&endDate&page
 * 会员登录   GET  /api/admin/logs/member-logins ?result&keyword&startDate&endDate&page
 *                  （三个独立路径，不是 /logs?type=）
 * 推荐开关   PATCH /api/admin/scenics/:id/recommend  body { isRecommended:boolean }
 * 下拉选项   GET  /api/admin/options?type=regions|scenics|members → { list:[{value,label,extra?}] }
 * 收藏       POST /api/favorites { scenicId }（幂等）/ DELETE /api/favorites/:scenicId
 * ============================================================ */

/** 公开统计接口路径（关于我们 / 后台概览共用） */
export const STATS_PATH = '/stats/public';

/** 后台接口路径（已是完整路径，可直接传 api.get/post）；推荐开关见下方注释 */
export const ADMIN_PATHS = Object.freeze({
  DASHBOARD: '/admin/dashboard',
  OPTIONS: '/admin/options',
  MEMBERS: '/admin/members',
  FEEDBACKS: '/admin/feedbacks',
  REGIONS: '/admin/regions',
  SCENICS: '/admin/scenics',
  TRAVELS: '/admin/travels',
  LOG_OPERATIONS: '/admin/logs/operations',
  LOG_ADMINS: '/admin/logs/admins',
  LOG_MEMBER_LOGINS: '/admin/logs/member-logins',
  PASSWORD: '/admin/auth/password',
});

/** 景区推荐开关路径：PATCH `/admin/scenics/${id}/recommend`，body { isRecommended } */
export function adminRecommendPath(scenicId) {
  return `/admin/scenics/${scenicId}/recommend`;
}

/**
 * 默认演示账号（**密码一律见 README.md「默认账号」表格，代码中不得硬编码**）：
 * 管理员 admin、会员 林小满 / 周叙白；会员登录用会员名（不是邮箱）。
 * 这里的常量只用于说明文案与占位提示。
 */
export const DEFAULT_ACCOUNT_HINT = Object.freeze({
  ADMIN_USERNAME: 'admin',
  MEMBER_USERNAME: '林小满',
  PASSWORD_SOURCE: 'README.md「默认账号」',
  LOGIN_HINT: '会员请用会员名登录（例如「林小满」），不是邮箱',
});

/* ============================================================
 * 景区排序（必须与后端 server/constants.js 的 SCENIC_SORTS 完全一致）
 * 只有这 4 个合法值，传其它值后端返回 1001：
 *   default   默认（id 倒序）
 *   popular   按收藏数倒序
 *   latest    按创建时间倒序
 *   recommend 推荐优先（isRecommended 优先，再按更新时间）
 * 注意：后端没有 rating 排序，不要臆造 'rating' / 'favorites'。
 * ============================================================ */
export const SORT_OPTIONS = Object.freeze([
  { value: 'default', label: '综合推荐' },
  { value: 'popular', label: '人气优先' },
  { value: 'latest', label: '最新上架' },
  { value: 'recommend', label: '编辑推荐' },
]);

/** 默认排序值（URL 里 sort 缺失时使用） */
export const DEFAULT_SORT = 'default';

/**
 * 会员列表排序（后端 MEMBER_SORT_FIELDS：id / createdAt，且 sortBy 与 order 是两个参数）。
 * `value` 只用于 <select> 绑定；提交时请用 sortBy + order 两个字段。
 */
export const MEMBER_SORT_OPTIONS = Object.freeze([
  { value: 'createdAt:desc', label: '注册时间（新→旧）', sortBy: 'createdAt', order: 'desc' },
  { value: 'createdAt:asc', label: '注册时间（旧→新）', sortBy: 'createdAt', order: 'asc' },
  { value: 'id:desc', label: 'ID（大→小）', sortBy: 'id', order: 'desc' },
  { value: 'id:asc', label: 'ID（小→大）', sortBy: 'id', order: 'asc' },
]);

/* ============================================================
 * 分页尺寸（DESIGN §7.3）
 * ============================================================ */
export const PAGE_SIZE = Object.freeze({
  SCENICS: 9, // 前台景区 3 列 × 3 行
  TRAVELS: 6, // 前台游记 2 列 × 3 行
  FAVORITES: 9, // 我的收藏 3 列
  ADMIN: 10, // 后台会员/景区/游记/意见表格
  LOGS: 20, // 后台日志
});

/**
 * limit 型取数（不翻页的场景）。
 * 后端支持情况（已实测）：
 * - `/scenics?limit=6&isRecommended=true`、`/scenics/:id/travels?limit=5`、`/regions?limit=6` 原生支持 limit；
 * - `/travels?limit=3` 于本轮补齐（等价 pageSize=3&page=1，返回体仍是分页包 {list,total,page,pageSize,totalPages}），
 *   所以 HOME_TRAVELS 直接传 limit 即可，不必自己切 list。
 */
export const LIMITS = Object.freeze({
  HOME_SCENICS: 6, // 首页推荐景区
  HOME_REGIONS: 6, // 首页推荐地区
  HOME_TRAVELS: 3, // 首页最新游记
  SCENIC_TRAVELS: 5, // 景区详情关联游记
  TRAVEL_RELATED: 3, // 游记详情相关游记
  ADMIN_RECENT_LOGS: 8, // 仪表盘最近操作日志
});

/* ============================================================
 * 状态文案映射
 * ============================================================ */

/** 意见反馈状态（后端 FEEDBACK_STATUS：pending / resolved） */
export const FEEDBACK_STATUS = Object.freeze({
  pending: '待处理',
  resolved: '已处理',
});

/** 反馈筛选下拉选项（第一项为「全部」） */
export const FEEDBACK_STATUS_OPTIONS = Object.freeze([
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'resolved', label: '已处理' },
]);

/** 三类日志的中文名（LogList 三个 Tab 用） */
export const LOG_TYPE_LABELS = Object.freeze({
  operation: '操作日志',
  admin: '管理员登录日志',
  memberLogin: '会员登录日志',
});

/** 日志 Tab 定义（key 同时是 URL 的 ?tab= 取值；api 是对应的后端路径） */
export const LOG_TABS = Object.freeze([
  { key: 'operation', label: '操作日志', api: '/admin/logs/operations' },
  { key: 'admin', label: '管理员登录日志', api: '/admin/logs/admins' },
  { key: 'memberLogin', label: '会员登录日志', api: '/admin/logs/member-logins' },
]);

/** 操作日志模块（后端 LOG_MODULES） */
export const LOG_MODULE_LABELS = Object.freeze({
  region: '地区',
  scenic: '景区',
  travel: '游记',
});

/** 操作日志动作（后端 LOG_ACTIONS） */
export const LOG_ACTION_LABELS = Object.freeze({
  create: '新增',
  update: '修改',
  delete: '删除',
});

/** 日志结果（后端 LOG_RESULTS） */
export const LOG_RESULT_LABELS = Object.freeze({
  success: '成功',
  fail: '失败',
});

/** 管理员登录事件（后端 ADMIN_LOG_EVENTS） */
export const ADMIN_LOG_EVENT_LABELS = Object.freeze({
  login: '登录',
  login_fail: '登录失败',
  logout: '退出登录',
  change_password: '修改密码',
});

/** 景区等级（后端只校验长度 ≤10，这里给前台下拉与标签用；空串表示未评级） */
export const SCENIC_LEVELS = Object.freeze(['5A', '4A', '3A', '2A', 'A']);

/* ============================================================
 * 其他
 * ============================================================ */

/** 登录后默认回跳地址（无 redirect 参数时） */
export const DEFAULT_REDIRECT = '/';

/** 后台登录后默认落地页 */
export const ADMIN_DEFAULT_REDIRECT = '/admin';

/** Toast 类型（与 ToastContext / .toast--* 变体一一对应） */
export const TOAST_TYPES = Object.freeze({
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
});

/** Toast 行为：2.5s 消失、同屏最多 3 条（DESIGN §6.2） */
export const TOAST_DURATION = 2500;
export const TOAST_MAX = 3;
