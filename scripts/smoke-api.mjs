/**
 * 后端冒烟脚本：`node scripts/smoke-api.mjs`（或 `npm run smoke`）
 *
 * 前置：API 已启动（`node server/index.js` 或 `npm run dev`），默认 http://127.0.0.1:3001。
 * 可用环境变量覆盖：`API_BASE=http://127.0.0.1:3101 node scripts/smoke-api.mjs`。
 *
 * 覆盖范围：公开接口 8 个 + 会员注册/登录/收藏全链路 + 后台登录/地区/景区 CRUD/日志/改密 +
 * 越权（会员 token 打后台）+ /api 未命中返回 JSON 404。脚本可重复运行（用户名带时间戳），
 * 结束时会把管理员密码复原为 admin123、删除本轮新建的地区与景区。
 */

const BASE = (process.env.API_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');

/** 统计 */
const state = { passed: 0, failed: 0, failures: [] };

/**
 * 记录一条断言。
 * @param {string} name
 * @param {boolean} condition
 * @param {string} [detail]
 * @returns {boolean}
 */
function check(name, condition, detail = '') {
  if (condition) {
    state.passed += 1;
    console.log(`  ✓ ${name}`);
    return true;
  }
  state.failed += 1;
  state.failures.push(`${name}${detail ? ` → ${detail}` : ''}`);
  console.log(`  ✗ ${name}${detail ? ` → ${detail}` : ''}`);
  return false;
}

/**
 * 发请求并解析 JSON（解析失败返回 null，不抛错）。
 * @param {string} method
 * @param {string} apiPath
 * @param {{body?:any, token?:string}} [options]
 * @returns {Promise<{status:number,json:any,text:string,contentType:string}>}
 */
async function request(method, apiPath, options = {}) {
  const headers = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${BASE}${apiPath}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (error) {
    json = null;
  }
  return { status: response.status, json, text, contentType: response.headers.get('content-type') || '' };
}

/** @param {string} title */
function section(title) {
  console.log(`\n[${title}]`);
}

const stamp = Date.now().toString().slice(-8);
const newMember = { username: `冒烟${stamp}`, password: 'smoke123456', phone: '13511112222', email: `smoke${stamp}@example.com` };
const newRegionName = `冒烟地区${stamp}`;
const newRegionName2 = `冒烟地区改${stamp}`;
const newScenicName = `冒烟景区${stamp}`;
const TEMP_ADMIN_PASSWORD = 'temp123456';

/** 需要在 finally 里清理/复原的资源 */
const cleanup = { regionId: null, scenicId: null, adminPasswordChanged: false, adminToken: null };

/**
 * 尝试复原管理员密码。
 * @returns {Promise<void>}
 */
async function restoreAdminPassword() {
  if (!cleanup.adminPasswordChanged) return;
  const login = await request('POST', '/api/admin/auth/login', {
    body: { username: 'admin', password: TEMP_ADMIN_PASSWORD },
  });
  const token = login.json && login.json.data ? login.json.data.token : null;
  if (!token) return;
  await request('PUT', '/api/admin/auth/password', {
    token,
    body: { oldPassword: TEMP_ADMIN_PASSWORD, newPassword: 'admin123', confirmPassword: 'admin123' },
  });
  cleanup.adminPasswordChanged = false;
}

/**
 * 清理本轮新建的地区/景区。
 * @returns {Promise<void>}
 */
async function cleanupResources() {
  if (!cleanup.adminToken) return;
  if (cleanup.scenicId) {
    await request('DELETE', `/api/admin/scenics/${cleanup.scenicId}`, { token: cleanup.adminToken });
    cleanup.scenicId = null;
  }
  if (cleanup.regionId) {
    await request('DELETE', `/api/admin/regions/${cleanup.regionId}`, { token: cleanup.adminToken });
    cleanup.regionId = null;
  }
}

/**
 * 主流程。
 * @returns {Promise<void>}
 */
async function run() {
  console.log(`冒烟目标：${BASE}`);

  /* ---------- 0. 健康检查 ---------- */
  section('0. 健康检查');
  const health = await request('GET', '/api/health');
  check('GET /api/health 返回 200 且 code=0', health.status === 200 && health.json && health.json.code === 0, health.text.slice(0, 120));

  /* ---------- 1. 公开内容接口 ---------- */
  section('1. 公开内容接口');
  const regions = await request('GET', '/api/regions');
  const regionList = regions.json && regions.json.data ? regions.json.data.list : [];
  check('GET /api/regions 返回 code=0 且 list 为数组', regions.json && regions.json.code === 0 && Array.isArray(regionList));
  check('地区数 ≥ 8（种子）', regionList.length >= 8, `实际 ${regionList.length}`);
  check('地区项含 scenicCount 派生字段', regionList.length > 0 && typeof regionList[0].scenicCount === 'number');

  const regionLimit = await request('GET', '/api/regions?limit=6');
  check('GET /api/regions?limit=6 截断为 6 条', regionLimit.json && regionLimit.json.data.list.length === 6);

  const regionDetail = await request('GET', '/api/regions/1');
  check('GET /api/regions/1 返回 region + scenics', Boolean(regionDetail.json && regionDetail.json.data.region && Array.isArray(regionDetail.json.data.scenics)));

  const scenicsPage = await request('GET', '/api/scenics?page=1&pageSize=6');
  const scenicPageData = scenicsPage.json ? scenicsPage.json.data : null;
  check('GET /api/scenics 分页包字段齐全', Boolean(scenicPageData && Array.isArray(scenicPageData.list) && typeof scenicPageData.total === 'number' && typeof scenicPageData.page === 'number' && typeof scenicPageData.pageSize === 'number' && typeof scenicPageData.totalPages === 'number'));
  check('pageSize=6 生效且 total ≥ 8', Boolean(scenicPageData && scenicPageData.list.length === 6 && scenicPageData.total >= 8), scenicPageData ? `list=${scenicPageData.list.length}, total=${scenicPageData.total}` : '');
  const firstScenic = scenicPageData && scenicPageData.list.length > 0 ? scenicPageData.list[0] : null;
  check('景区项含 regionName / favoriteCount / isFavorited', Boolean(firstScenic && typeof firstScenic.regionName === 'string' && typeof firstScenic.favoriteCount === 'number' && typeof firstScenic.isFavorited === 'boolean'));

  const scenicKeyword = await request('GET', `/api/scenics?keyword=${encodeURIComponent('九寨')}`);
  const keywordList = scenicKeyword.json ? scenicKeyword.json.data.list : [];
  check('GET /api/scenics?keyword=九寨 命中且仅含九寨', keywordList.length >= 1 && keywordList.every((item) => item.name.includes('九寨')), `命中 ${keywordList.length} 条`);

  const scenicSort = await request('GET', '/api/scenics?sort=popular&pageSize=3');
  check('GET /api/scenics?sort=popular 正常返回', Boolean(scenicSort.json && scenicSort.json.code === 0 && scenicSort.json.data.list.length === 3));

  const scenicRecommended = await request('GET', '/api/scenics?isRecommended=true&limit=6');
  const recommendedList = scenicRecommended.json ? scenicRecommended.json.data.list : [];
  check('GET /api/scenics?isRecommended=true&limit=6 只返回推荐且 ≤6', recommendedList.length === 6 && recommendedList.every((item) => item.isRecommended === true), `实际 ${recommendedList.length}`);

  const scenicDetail = await request('GET', '/api/scenics/1');
  const detailScenic = scenicDetail.json ? scenicDetail.json.data.scenic : null;
  const detailRegion = scenicDetail.json ? scenicDetail.json.data.region : null;
  check('GET /api/scenics/1 含 scenic + region', Boolean(detailScenic && detailRegion && detailScenic.id === 1 && detailRegion.name === '四川'));
  check('景区详情含 _isFavorited / _favoriteCount / _travelCount', Boolean(detailScenic && typeof detailScenic._isFavorited === 'boolean' && typeof detailScenic._favoriteCount === 'number' && typeof detailScenic._travelCount === 'number'));

  const scenicMissing = await request('GET', '/api/scenics/999999');
  check('不存在的景区返回 404 + code 1002', scenicMissing.status === 404 && scenicMissing.json && scenicMissing.json.code === 1002);

  const scenicTravels = await request('GET', '/api/scenics/1/travels');
  check('GET /api/scenics/1/travels 返回该景区游记', Boolean(scenicTravels.json && scenicTravels.json.data.list.length >= 2 && scenicTravels.json.data.total >= 2));

  const travels = await request('GET', '/api/travels');
  const travelList = travels.json ? travels.json.data.list : [];
  check('GET /api/travels 返回分页包且默认 6 条', Boolean(travels.json && travels.json.code === 0 && travelList.length === 6));
  check('游记项含 scenicName', travelList.length > 0 && typeof travelList[0].scenicName === 'string' && travelList[0].scenicName.length > 0);
  const sortedDesc = travelList.every((item, index) => index === 0 || Date.parse(travelList[index - 1].publishedAt) >= Date.parse(item.publishedAt));
  check('游记按 publishedAt 倒序', sortedDesc);

  const travelDetail = await request('GET', '/api/travels/1');
  check('GET /api/travels/1 含 travel + scenic + related', Boolean(travelDetail.json && travelDetail.json.data.travel && travelDetail.json.data.scenic && Array.isArray(travelDetail.json.data.related)));

  const stats = await request('GET', '/api/stats/public');
  const statsData = stats.json ? stats.json.data : null;
  check('GET /api/stats/public 三个数字齐全', Boolean(statsData && typeof statsData.regionCount === 'number' && typeof statsData.scenicCount === 'number' && typeof statsData.travelCount === 'number'));

  /* ---------- 2. 会员链路 ---------- */
  section('2. 会员注册 / 登录 / 收藏');
  const register = await request('POST', '/api/auth/register', { body: { ...newMember, confirmPassword: newMember.password } });
  const memberToken = register.json && register.json.data ? register.json.data.token : null;
  check('注册新会员成功并返回 token + member', Boolean(register.json && register.json.code === 0 && memberToken && register.json.data.member.username === newMember.username), register.text.slice(0, 160));
  check('注册返回的 member 不含 passwordHash', Boolean(register.json && register.json.data.member.passwordHash === undefined));

  const duplicate = await request('POST', '/api/auth/register', { body: { ...newMember, confirmPassword: newMember.password } });
  check('重复会员名被拒 → 409 / code 1003', duplicate.status === 409 && duplicate.json && duplicate.json.code === 1003, duplicate.text.slice(0, 120));

  const badRegister = await request('POST', '/api/auth/register', { body: { username: 'x', password: '1', confirmPassword: '2', phone: '123', email: 'bad' } });
  check('注册非法字段 → 400 / code 1001 且 data 为字段映射', badRegister.status === 400 && badRegister.json && badRegister.json.code === 1001 && badRegister.json.data && Object.keys(badRegister.json.data).length >= 4, badRegister.text.slice(0, 160));

  const emptyRegister = await request('POST', '/api/auth/register', { body: {} });
  const emptyFields = emptyRegister.json && emptyRegister.json.data ? Object.keys(emptyRegister.json.data) : [];
  check(
    '空表单注册 → 5 个字段全部有字段级提示（含 confirmPassword）',
    emptyRegister.status === 400
      && emptyRegister.json
      && emptyRegister.json.code === 1001
      && ['username', 'password', 'confirmPassword', 'phone', 'email'].every((key) => emptyFields.includes(key)),
    `data 字段：${emptyFields.join(',')}`,
  );

  const memberLogin = await request('POST', '/api/auth/login', { body: { username: newMember.username, password: newMember.password } });
  check('会员登录成功返回 token', Boolean(memberLogin.json && memberLogin.json.code === 0 && memberLogin.json.data.token));

  const memberLoginFail = await request('POST', '/api/auth/login', { body: { username: newMember.username, password: 'wrong-password' } });
  check('会员密码错误 → 401 / code 2003', memberLoginFail.status === 401 && memberLoginFail.json && memberLoginFail.json.code === 2003);

  const memberMe = await request('GET', '/api/auth/me', { token: memberToken });
  check('GET /api/auth/me 返回当前会员', Boolean(memberMe.json && memberMe.json.code === 0 && memberMe.json.data.member.username === newMember.username));

  const favoriteScenicId = 8; // 丽江古城（种子 0 收藏，便于验证计数变化）
  const beforeCount = (await request('GET', `/api/scenics/${favoriteScenicId}`)).json.data.scenic.favoriteCount;
  const favAdd = await request('POST', '/api/favorites', { token: memberToken, body: { scenicId: favoriteScenicId } });
  check('POST /api/favorites 新增成功 created=true', Boolean(favAdd.json && favAdd.json.code === 0 && favAdd.json.data.created === true && favAdd.json.data.favorited === true));
  check('收藏后 favoriteCount +1', Boolean(favAdd.json && favAdd.json.data.favoriteCount === beforeCount + 1), `before=${beforeCount}, after=${favAdd.json && favAdd.json.data.favoriteCount}`);

  const favAgain = await request('POST', '/api/favorites', { token: memberToken, body: { scenicId: favoriteScenicId } });
  check('重复收藏幂等 created=false 且不新增', Boolean(favAgain.json && favAgain.json.code === 0 && favAgain.json.data.created === false && favAgain.json.data.favoriteCount === beforeCount + 1));

  const favList = await request('GET', '/api/favorites', { token: memberToken });
  const favItems = favList.json ? favList.json.data.list : [];
  check('GET /api/favorites 含刚收藏的景区与 favoritedAt', favItems.some((item) => item.id === favoriteScenicId && typeof item.favoritedAt === 'string'));

  const favDelete = await request('DELETE', `/api/favorites/${favoriteScenicId}`, { token: memberToken });
  check('DELETE /api/favorites/:id 取消成功且计数回落', Boolean(favDelete.json && favDelete.json.code === 0 && favDelete.json.data.favorited === false && favDelete.json.data.favoriteCount === beforeCount));

  const favDeleteAgain = await request('DELETE', `/api/favorites/${favoriteScenicId}`, { token: memberToken });
  check('重复取消幂等（仍返回成功）', Boolean(favDeleteAgain.json && favDeleteAgain.json.code === 0));

  const favNoToken = await request('GET', '/api/favorites');
  check('未带 token 访问收藏 → 401 / code 2001', favNoToken.status === 401 && favNoToken.json && favNoToken.json.code === 2001);

  const optionalBadToken = await request('GET', '/api/scenics/1', { token: 'not-a-real-token' });
  check('坏 token 走 optionalMember 按游客处理（200，不 500）', optionalBadToken.status === 200 && optionalBadToken.json && optionalBadToken.json.code === 0);

  const memberLogout = await request('POST', '/api/auth/logout', { token: memberToken });
  check('POST /api/auth/logout 返回成功', Boolean(memberLogout.json && memberLogout.json.code === 0));

  /* ---------- 3. 意见反馈 ---------- */
  section('3. 意见反馈（游客提交）');
  const feedbackBad = await request('POST', '/api/feedbacks', { body: { nickname: 'a', contact: '', content: '短' } });
  check('留言字段非法 → 400 / code 1001', feedbackBad.status === 400 && feedbackBad.json && feedbackBad.json.code === 1001);
  const feedbackOk = await request('POST', '/api/feedbacks', {
    body: { nickname: `冒烟用户${stamp}`, contact: `smoke${stamp}@example.com`, content: `这是冒烟脚本自动提交的反馈内容（${stamp}），用于验证留言接口可写入且后台可见。` },
  });
  check('游客提交留言成功 → id + createdAt', Boolean(feedbackOk.json && feedbackOk.json.code === 0 && Number.isInteger(feedbackOk.json.data.id)));

  /* ---------- 4. 管理员链路 ---------- */
  section('4. 后台登录与鉴权');
  const adminLogin = await request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const adminToken = adminLogin.json && adminLogin.json.data ? adminLogin.json.data.token : null;
  cleanup.adminToken = adminToken;
  check('管理员登录成功返回 token + admin', Boolean(adminLogin.json && adminLogin.json.code === 0 && adminToken && adminLogin.json.data.admin.username === 'admin'), adminLogin.text.slice(0, 160));

  const adminLoginFail = await request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'wrong' } });
  check('管理员密码错误 → 401 / code 2003', adminLoginFail.status === 401 && adminLoginFail.json && adminLoginFail.json.code === 2003);

  const adminMe = await request('GET', '/api/admin/auth/me', { token: adminToken });
  check('GET /api/admin/auth/me 返回当前管理员', Boolean(adminMe.json && adminMe.json.code === 0 && adminMe.json.data.admin.username === 'admin'));

  const memberToAdmin = await request('GET', '/api/admin/members', { token: memberToken });
  check('会员 token 打 /api/admin/members 被拒（401/403）', memberToAdmin.status === 401 || memberToAdmin.status === 403, `status=${memberToAdmin.status}, code=${memberToAdmin.json && memberToAdmin.json.code}`);
  check('越权返回码为 2001/2002/2004 之一', Boolean(memberToAdmin.json && [2001, 2002, 2004].includes(memberToAdmin.json.code)), `code=${memberToAdmin.json && memberToAdmin.json.code}`);

  const noTokenAdmin = await request('GET', '/api/admin/dashboard');
  check('无 token 访问后台 → 401 / code 2001', noTokenAdmin.status === 401 && noTokenAdmin.json && noTokenAdmin.json.code === 2001);

  section('5. 后台只读接口');
  const dashboard = await request('GET', '/api/admin/dashboard', { token: adminToken });
  const dashStats = dashboard.json ? dashboard.json.data.stats : null;
  check('GET /api/admin/dashboard 六项统计齐全', Boolean(dashStats && ['regionCount', 'scenicCount', 'travelCount', 'memberCount', 'pendingFeedbackCount', 'todayMemberLoginCount'].every((key) => typeof dashStats[key] === 'number')));
  check('dashboard 返回最近 ≤8 条操作日志', Boolean(dashboard.json && Array.isArray(dashboard.json.data.recentLogs) && dashboard.json.data.recentLogs.length <= 8));

  const options = await request('GET', '/api/admin/options?type=regions', { token: adminToken });
  check('GET /api/admin/options?type=regions 返回 value/label', Boolean(options.json && options.json.code === 0 && options.json.data.list.length > 0 && typeof options.json.data.list[0].value === 'number' && typeof options.json.data.list[0].label === 'string'));

  const badOptions = await request('GET', '/api/admin/options?type=nope', { token: adminToken });
  check('非法 type → 400 / code 1001', badOptions.status === 400 && badOptions.json && badOptions.json.code === 1001);

  const members = await request('GET', '/api/admin/members?keyword=冒烟&page=1&pageSize=10', { token: adminToken });
  const memberItems = members.json ? members.json.data.list : [];
  check('GET /api/admin/members 关键词命中新注册会员且含 favoriteCount', memberItems.some((item) => item.username === newMember.username && typeof item.favoriteCount === 'number'));
  check('会员出参不含 passwordHash', memberItems.every((item) => item.passwordHash === undefined));

  const memberDetail = await request('GET', `/api/admin/members/${register.json.data.member.id}`, { token: adminToken });
  check('GET /api/admin/members/:id 含 favorites + loginLogs', Boolean(memberDetail.json && Array.isArray(memberDetail.json.data.favorites) && Array.isArray(memberDetail.json.data.loginLogs)));

  const feedbackList = await request('GET', '/api/admin/feedbacks', { token: adminToken });
  check('GET /api/admin/feedbacks 含 pendingCount', Boolean(feedbackList.json && typeof feedbackList.json.data.pendingCount === 'number'));

  const targetFeedback = feedbackList.json.data.list.find((item) => item.status === 'pending');
  if (targetFeedback) {
    const patched = await request('PATCH', `/api/admin/feedbacks/${targetFeedback.id}`, { token: adminToken, body: { status: 'resolved' } });
    check('PATCH 意见状态为 resolved 并写 handledAt', Boolean(patched.json && patched.json.code === 0 && patched.json.data.status === 'resolved' && typeof patched.json.data.handledAt === 'string'));
    await request('PATCH', `/api/admin/feedbacks/${targetFeedback.id}`, { token: adminToken, body: { status: 'pending' } });
  } else {
    check('PATCH 意见状态为 resolved 并写 handledAt', false, '没有 pending 数据可测');
  }

  section('6. 后台地区 / 景区 CRUD');
  const createRegion = await request('POST', '/api/admin/regions', {
    token: adminToken,
    body: { name: newRegionName, coverImage: '/images/guilin.jpg', description: '冒烟脚本创建的临时地区，用于验证新增/编辑/删除链路。', sortOrder: 12 },
  });
  const createdRegion = createRegion.json && createRegion.json.data ? createRegion.json.data.region : null;
  cleanup.regionId = createdRegion ? createdRegion.id : null;
  check('POST /api/admin/regions 新增成功', Boolean(createdRegion && createdRegion.name === newRegionName && createRegion.status === 201), createRegion.text.slice(0, 160));

  const dupRegion = await request('POST', '/api/admin/regions', {
    token: adminToken,
    body: { name: newRegionName, coverImage: '/images/guilin.jpg', description: '', sortOrder: 0 },
  });
  check('重复地区名 → 409 / code 1003', dupRegion.status === 409 && dupRegion.json && dupRegion.json.code === 1003);

  const updateRegion = await request('PUT', `/api/admin/regions/${cleanup.regionId}`, {
    token: adminToken,
    body: { name: newRegionName2, coverImage: '/images/huangshan.jpg', description: '已编辑', sortOrder: 33 },
  });
  check('PUT /api/admin/regions/:id 编辑生效', Boolean(updateRegion.json && updateRegion.json.code === 0 && updateRegion.json.data.region.name === newRegionName2 && updateRegion.json.data.region.sortOrder === 33));

  const badRegion = await request('POST', '/api/admin/regions', { token: adminToken, body: { name: '', coverImage: 'nope.jpg', description: '' } });
  check('地区字段非法 → 400 / code 1001 且 data 有 name/coverImage', Boolean(badRegion.json && badRegion.json.code === 1001 && badRegion.json.data.name && badRegion.json.data.coverImage));

  const missingImageRegion = await request('POST', '/api/admin/regions', {
    token: adminToken,
    body: { name: `${newRegionName}图`, coverImage: '/images/not-a-real-asset.jpg', description: '' },
  });
  check(
    '不存在的图片路径 → 400 / code 1001 且 data.coverImage 有提示',
    missingImageRegion.status === 400
      && Boolean(missingImageRegion.json)
      && missingImageRegion.json.code === 1001
      && Boolean(missingImageRegion.json.data && missingImageRegion.json.data.coverImage),
    missingImageRegion.text.slice(0, 160),
  );

  const createScenic = await request('POST', '/api/admin/scenics', {
    token: adminToken,
    body: {
      name: newScenicName,
      regionId: cleanup.regionId,
      coverImage: '/images/sanya.jpg',
      gallery: ['/images/sanya.jpg', '/images/guilin.jpg'],
      openTime: '08:00–18:00',
      ticketPrice: '免费',
      traffic: '冒烟脚本临时数据，用于验证景区新增与级联删除。',
      description: '这是冒烟脚本创建的临时景区简介，长度足以通过十字校验。',
      isRecommended: false,
      level: '4A',
      rating: 4.2,
      bestSeason: '全年',
      highlights: ['测试点一', '测试点二'],
    },
  });
  const createdScenic = createScenic.json && createScenic.json.data ? createScenic.json.data.scenic : null;
  cleanup.scenicId = createdScenic ? createdScenic.id : null;
  check('POST /api/admin/scenics 新增成功（含 regionName 派生）', Boolean(createdScenic && createdScenic.regionName === newRegionName2 && createScenic.status === 201), createScenic.text.slice(0, 200));
  check('新增景区 highlights/gallery 归一化为数组', Boolean(createdScenic && Array.isArray(createdScenic.highlights) && createdScenic.highlights.length === 2 && Array.isArray(createdScenic.gallery)));

  const scenicBadRegion = await request('POST', '/api/admin/scenics', {
    token: adminToken,
    body: { name: `${newScenicName}坏`, regionId: 999999, coverImage: '/images/sanya.jpg', description: '所属地区不存在的校验用例。' },
  });
  check('所属地区不存在 → 400 / code 3002', scenicBadRegion.status === 400 && scenicBadRegion.json && scenicBadRegion.json.code === 3002);

  const recommend = await request('PATCH', `/api/admin/scenics/${cleanup.scenicId}/recommend`, { token: adminToken, body: { isRecommended: true } });
  check('PATCH 推荐开关返回 recommendedTotal', Boolean(recommend.json && recommend.json.code === 0 && recommend.json.data.isRecommended === true && typeof recommend.json.data.recommendedTotal === 'number'));
  await request('PATCH', `/api/admin/scenics/${cleanup.scenicId}/recommend`, { token: adminToken, body: { isRecommended: false } });

  const regionInUse = await request('DELETE', `/api/admin/regions/${cleanup.regionId}`, { token: adminToken });
  check('删除仍有景区的地区 → 409 / code 3001', regionInUse.status === 409 && regionInUse.json && regionInUse.json.code === 3001, regionInUse.text.slice(0, 140));
  check('占用提示含景区数量', Boolean(regionInUse.json && /还有\s*1\s*个景区/.test(regionInUse.json.message)), regionInUse.json && regionInUse.json.message);

  const scenicDetailAdmin = await request('GET', `/api/admin/scenics/${cleanup.scenicId}`, { token: adminToken });
  check('GET /api/admin/scenics/:id 含 travelCount/favoriteCount', Boolean(scenicDetailAdmin.json && typeof scenicDetailAdmin.json.data.travelCount === 'number' && typeof scenicDetailAdmin.json.data.favoriteCount === 'number'));

  const deleteScenic = await request('DELETE', `/api/admin/scenics/${cleanup.scenicId}`, { token: adminToken });
  check('DELETE /api/admin/scenics/:id 返回 cascade 数量', Boolean(deleteScenic.json && deleteScenic.json.code === 0 && deleteScenic.json.data.deleted === true && deleteScenic.json.data.cascade && typeof deleteScenic.json.data.cascade.travels === 'number'));
  cleanup.scenicId = null;

  const deleteRegion = await request('DELETE', `/api/admin/regions/${cleanup.regionId}`, { token: adminToken });
  check('DELETE /api/admin/regions/:id 删除成功', Boolean(deleteRegion.json && deleteRegion.json.code === 0 && deleteRegion.json.data.deleted === true));
  cleanup.regionId = null;

  section('7. 游记后台 CRUD');
  const createTravel = await request('POST', '/api/admin/travels', {
    token: adminToken,
    body: {
      title: `冒烟游记标题${stamp}`,
      scenicId: 1,
      coverImage: '',
      authorName: '',
      content: '冒烟脚本创建的临时游记正文，长度超过十个字，用于验证新增与删除链路是否畅通。',
    },
  });
  const createdTravel = createTravel.json && createTravel.json.data ? createTravel.json.data.travel : null;
  check('POST /api/admin/travels 新增成功（封面回落景区图、作者默认站点编辑）', Boolean(createdTravel && createdTravel.coverImage === '/images/jiuzhaigou.jpg' && createdTravel.authorName === '站点编辑'), createTravel.text.slice(0, 200));

  if (createdTravel) {
    const updateTravel = await request('PUT', `/api/admin/travels/${createdTravel.id}`, {
      token: adminToken,
      body: { title: `冒烟游记改标题${stamp}`, scenicId: 1, content: '修改后的正文，依然需要超过十个字以满足校验规则。', publishedAt: '2026-11-01T10:00:00.000Z' },
    });
    check('PUT /api/admin/travels/:id 编辑生效（含 publishedAt ISO 归一）', Boolean(updateTravel.json && updateTravel.json.code === 0 && updateTravel.json.data.travel.title === `冒烟游记改标题${stamp}` && updateTravel.json.data.travel.publishedAt === '2026-11-01T10:00:00.000Z'));

    const travelBadScenic = await request('POST', '/api/admin/travels', {
      token: adminToken,
      body: { title: '所属景区不存在用例', scenicId: 999999, content: '这条应当在景区外键校验时被拒绝并写失败日志。' },
    });
    check('游记所属景区不存在 → 400 / code 3002', travelBadScenic.status === 400 && travelBadScenic.json && travelBadScenic.json.code === 3002);

    const deleteTravel = await request('DELETE', `/api/admin/travels/${createdTravel.id}`, { token: adminToken });
    check('DELETE /api/admin/travels/:id 删除成功', Boolean(deleteTravel.json && deleteTravel.json.code === 0 && deleteTravel.json.data.deleted === true));
  } else {
    check('PUT /api/admin/travels/:id 编辑生效', false, '新增失败，跳过');
    check('DELETE /api/admin/travels/:id 删除成功', false, '新增失败，跳过');
  }

  section('8. 日志接口');
  const opLogs = await request('GET', '/api/admin/logs/operations?page=1&pageSize=20', { token: adminToken });
  const opList = opLogs.json ? opLogs.json.data.list : [];
  check('GET /api/admin/logs/operations 返回分页包', Boolean(opLogs.json && opLogs.json.code === 0 && Array.isArray(opList)));
  check('本轮写操作已进日志（含本地区名）', opList.some((log) => log.targetName === newRegionName2 || log.targetName === newScenicName), `前 3 条：${opList.slice(0, 3).map((log) => log.targetName).join(' / ')}`);
  check('失败操作日志 result=fail 且 message 非空', opList.some((log) => log.result === 'fail' && typeof log.message === 'string' && log.message.length > 0));

  const regionCreateLogs = await request('GET', '/api/admin/logs/operations?module=region&action=create', { token: adminToken });
  check('日志按 module+action 筛选生效', Boolean(regionCreateLogs.json && regionCreateLogs.json.data.list.every((log) => log.module === 'region' && log.action === 'create')));

  const adminLogs = await request('GET', '/api/admin/logs/admins?pageSize=20', { token: adminToken });
  check('GET /api/admin/logs/admins 含本轮 login 记录', Boolean(adminLogs.json && adminLogs.json.data.list.some((log) => log.event === 'login' && log.result === 'success')));

  const memberLogs = await request('GET', `/api/admin/logs/member-logins?keyword=${encodeURIComponent(newMember.username)}`, { token: adminToken });
  check('GET /api/admin/logs/member-logins 记录本轮会员登录', Boolean(memberLogs.json && memberLogs.json.data.list.length >= 1 && memberLogs.json.data.list.every((log) => log.username === newMember.username)));

  const dateFiltered = await request('GET', '/api/admin/logs/operations?startDate=2000-01-01&endDate=2000-01-02', { token: adminToken });
  check('日志时间范围筛选可返回空集', Boolean(dateFiltered.json && dateFiltered.json.data.total === 0));

  section('9. 后台改密');
  const changePassword = await request('PUT', '/api/admin/auth/password', {
    token: adminToken,
    body: { oldPassword: 'admin123', newPassword: TEMP_ADMIN_PASSWORD, confirmPassword: TEMP_ADMIN_PASSWORD },
  });
  check('PUT /api/admin/auth/password 改密成功（reloginRequired）', Boolean(changePassword.json && changePassword.json.code === 0 && changePassword.json.data.reloginRequired === true));
  cleanup.adminPasswordChanged = true;

  const loginOld = await request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'admin123' } });
  check('改密后旧密码登录失败 → 2003', loginOld.status === 401 && loginOld.json && loginOld.json.code === 2003);

  const loginNew = await request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: TEMP_ADMIN_PASSWORD } });
  const newToken = loginNew.json && loginNew.json.data ? loginNew.json.data.token : null;
  check('改密后新密码登录成功', Boolean(newToken && loginNew.json.code === 0));

  const wrongOld = await request('PUT', '/api/admin/auth/password', {
    token: newToken,
    body: { oldPassword: 'not-the-old-one', newPassword: 'another123', confirmPassword: 'another123' },
  });
  check('原密码不正确 → 400 / code 2005', wrongOld.status === 400 && wrongOld.json && wrongOld.json.code === 2005);

  const reverted = await request('PUT', '/api/admin/auth/password', {
    token: newToken,
    body: { oldPassword: TEMP_ADMIN_PASSWORD, newPassword: 'admin123', confirmPassword: 'admin123' },
  });
  check('管理员密码已复原为 admin123', Boolean(reverted.json && reverted.json.code === 0));
  cleanup.adminPasswordChanged = false;

  const loginRestored = await request('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'admin123' } });
  check('复原后 admin123 可正常登录', Boolean(loginRestored.json && loginRestored.json.code === 0));

  const adminLogout = await request('POST', '/api/admin/auth/logout', { token: adminToken });
  check('POST /api/admin/auth/logout 返回成功', Boolean(adminLogout.json && adminLogout.json.code === 0));

  section('10. 404 与错误包');
  const notFound = await request('GET', '/api/not-exist');
  check('GET /api/not-exist 返回 JSON 404（非 HTML）', notFound.status === 404 && notFound.json !== null && notFound.contentType.includes('application/json'), `content-type=${notFound.contentType}`);
  check('未知接口 code=1002', Boolean(notFound.json && notFound.json.code === 1002));

  const badJson = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  const badJsonText = await badJson.text();
  let badJsonBody = null;
  try {
    badJsonBody = JSON.parse(badJsonText);
  } catch (error) {
    badJsonBody = null;
  }
  check('非法 JSON 请求体 → 400 / code 1004', badJson.status === 400 && badJsonBody && badJsonBody.code === 1004, badJsonText.slice(0, 120));

  // 超限请求体（> 1 MiB）必须走 413 / code 1001，而不是 500 / 5000
  const tooLargeResponse = await fetch(`${BASE}/api/feedbacks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '冒烟', contact: 'x@example.com', content: 'x'.repeat(1100 * 1024) }),
  });
  const tooLargeText = await tooLargeResponse.text();
  let tooLargeBody = null;
  try {
    tooLargeBody = JSON.parse(tooLargeText);
  } catch (error) {
    tooLargeBody = null;
  }
  check(
    '超 1 MB 请求体 → 413 / code 1001（非 5000）',
    tooLargeResponse.status === 413 && tooLargeBody !== null && tooLargeBody.code === 1001,
    `status=${tooLargeResponse.status}, body=${tooLargeText.slice(0, 120)}`,
  );
}

try {
  await run();
} catch (error) {
  state.failed += 1;
  state.failures.push(`脚本异常：${error.message}`);
  console.error('\n[脚本异常]', error);
} finally {
  await restoreAdminPassword().catch(() => {});
  await cleanupResources().catch(() => {});
}

console.log('\n================ 冒烟结果 ================');
console.log(`通过：${state.passed} 项，失败：${state.failed} 项`);
if (state.failures.length > 0) {
  console.log('失败明细：');
  for (const item of state.failures) console.log(`  - ${item}`);
  process.exitCode = 1;
} else {
  console.log('全部通过 ✔');
}
