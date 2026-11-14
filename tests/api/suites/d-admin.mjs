/**
 * D 组：后台链路（F-20~F-23、F-25~F-33、F-34~F-38、F-39~F-46）。
 *
 * 口径：DESIGN §3.3（后台 29 个接口）+ §3.4 错误码表 + §7.6 日志约定。
 * 依赖顺序：建地区 → 建景区 → 建游记/收藏 → 级联删除景区 → 删空地区，链路闭环且不留垃圾数据。
 */

import assert from 'node:assert/strict';

import { api, defineSuite, expectFail, expectOk, expectStatus, state } from '../lib/harness.mjs';

const S = {
  stamp: Date.now().toString().slice(-8),
  regionId: null,
  regionName: '',
  scenicId: null,
  scenicName: '',
  travelId: null,
  travelTitle: '',
  feedbackId: null,
};

/** 本地日期 YYYY-MM-DD */
function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 取操作日志总数（分页包 total） */
async function opsTotal() {
  const data = expectOk(await api('GET', '/api/admin/logs/operations?pageSize=1', { token: state.adminToken }), '操作日志 total');
  return data.total;
}

/** 取最新一条操作日志 */
async function latestOp() {
  const data = expectOk(await api('GET', '/api/admin/logs/operations?pageSize=1', { token: state.adminToken }), '最新操作日志');
  return data.list[0];
}

/** 合法地区表单 */
function regionBody(name) {
  return { name, coverImage: '/images/about.jpg', description: 'QA 验收创建，测后恢复数据', sortOrder: 11 };
}

export default defineSuite('D. 后台链路（账号/地区/景区/游记/日志/仪表盘）', (t) => {
  t.beforeAll(async () => {
    if (!state.adminToken) {
      const login = expectOk(await api('POST', '/api/admin/auth/login', {
        body: { username: 'admin', password: process.env.ETRAVEL_ADMIN_PASSWORD || 'admin123' },
      }), '管理员登录（D 组 beforeAll）');
      state.adminToken = login.token;
    }
    if (!state.memberToken) {
      const login = expectOk(await api('POST', '/api/auth/login', {
        body: { username: '林小满', password: process.env.ETRAVEL_MEMBER_PASSWORD || '123456' },
      }), '会员登录（D 组 beforeAll）');
      state.memberToken = login.token;
    }
  });

  /* ---------------- F-20 / F-21 / F-44 ---------------- */
  t.test('[F-20] 管理员错误密码 → 401 + 2003；[F-44] 失败登录写入管理员日志', async () => {
    const before = expectOk(await api('GET', '/api/admin/logs/admins?event=login_fail&pageSize=1', { token: state.adminToken }), 'login_fail 基线');
    const res = await api('POST', '/api/admin/auth/login', { body: { username: 'admin', password: 'definitely-wrong' } });
    expectStatus(res, 401, '管理员错误密码');
    expectFail(res, 2003, '管理员错误密码');

    const after = expectOk(await api('GET', '/api/admin/logs/admins?event=login_fail&pageSize=1', { token: state.adminToken }), 'login_fail 复测');
    assert.equal(after.total, before.total + 1, `登录失败日志应 +1，实际 ${before.total} → ${after.total}`);
    assert.equal(after.list[0].event, 'login_fail', '最新管理员日志事件应为 login_fail');
    assert.equal(after.list[0].result, 'fail', '失败日志 result 应为 fail');
    assert.equal(after.list[0].username, 'admin', '失败日志应记录尝试的账号');
  });

  t.test('[F-21] GET /api/admin/auth/me 返回当前管理员且无 passwordHash', async () => {
    const data = expectOk(await api('GET', '/api/admin/auth/me', { token: state.adminToken }), 'admin me');
    assert.equal(data.admin.username, 'admin', `管理员账号应为 admin，实际 ${data.admin.username}`);
    assert.ok(!('passwordHash' in data.admin), 'admin me 泄露 passwordHash');
    assert.equal(typeof data.admin.displayName, 'string', 'admin 缺少 displayName');
  });

  /* ---------------- F-31 新增地区 ---------------- */
  t.test('[F-31] 新增地区 → 201，且[F-43]操作日志 +1（module/action/target 合理）', async () => {
    const before = await opsTotal();
    S.regionName = `验收地区${S.stamp}`;
    const res = await api('POST', '/api/admin/regions', { token: state.adminToken, body: regionBody(S.regionName) });
    expectStatus(res, 201, '新增地区');
    const data = expectOk(res, '新增地区');
    assert.equal(data.region.name, S.regionName, '返回地区名不符');
    assert.ok(Number.isInteger(data.region.id), '返回地区 id 非法');
    S.regionId = data.region.id;

    const after = await opsTotal();
    assert.equal(after, before + 1, `操作日志应 +1，实际 ${before} → ${after}`);
    const op = await latestOp();
    assert.equal(op.module, 'region', `最新日志 module 应为 region，实际 ${op.module}`);
    assert.equal(op.action, 'create', `最新日志 action 应为 create，实际 ${op.action}`);
    assert.equal(op.result, 'success', `最新日志 result 应为 success，实际 ${op.result}`);
    assert.equal(op.targetId, S.regionId, `日志 targetId 应为 ${S.regionId}，实际 ${op.targetId}`);
    assert.equal(op.targetName, S.regionName, '日志 targetName 与地区名不一致');
    assert.equal(op.adminName, 'admin', '日志应记录操作人');
  });

  t.test('[F-31] 地区重名 → 409 + 1003，且日志 result=fail', async () => {
    const before = await opsTotal();
    const res = await api('POST', '/api/admin/regions', { token: state.adminToken, body: regionBody(S.regionName) });
    expectStatus(res, 409, '地区重名');
    expectFail(res, 1003, '地区重名');
    const after = await opsTotal();
    assert.equal(after, before + 1, '失败的新增也应记录操作日志（F-43）');
    const op = await latestOp();
    assert.equal(op.result, 'fail', `失败日志 result 应为 fail，实际 ${op.result}`);
  });

  t.test('[F-31] 地区字段校验：名称过短 / 封面非法 → 1001 且定位字段', async () => {
    const short = await api('POST', '/api/admin/regions', {
      token: state.adminToken,
      body: { name: 'A', coverImage: '/images/about.jpg', description: '', sortOrder: 1 },
    });
    const d1 = expectFail(short, 1001, '地区名过短');
    assert.ok(d1 && d1.name, '1001 data 应含 name');

    const badImage = await api('POST', '/api/admin/regions', {
      token: state.adminToken,
      body: { name: `封面非法${S.stamp}`, coverImage: 'https://evil.example.com/x.png', description: '', sortOrder: 1 },
    });
    const d2 = expectFail(badImage, 1001, '封面路径非法');
    assert.ok(d2 && d2.coverImage, '1001 data 应含 coverImage（须为 /images/ 下真实存在的图片）');
  });

  /* ---------------- F-30 / F-32 ---------------- */
  t.test('[F-30] 后台地区列表：含 scenicCount/isHomeRecommended，keyword 精确命中', async () => {
    const all = expectOk(await api('GET', '/api/admin/regions?pageSize=100', { token: state.adminToken }), '后台地区列表');
    const found = all.list.find((item) => item.id === S.regionId);
    assert.ok(found, '新建地区未出现在后台列表');
    assert.equal(found.scenicCount, 0, `新地区景区数应为 0，实际 ${found.scenicCount}`);
    assert.equal(typeof found.isHomeRecommended, 'boolean', '列表项缺少 isHomeRecommended');
    assert.equal(typeof found.sortOrder, 'number', '列表项缺少 sortOrder');

    const searched = expectOk(
      await api('GET', `/api/admin/regions?keyword=${encodeURIComponent(S.regionName)}&pageSize=100`, { token: state.adminToken }),
      '后台地区搜索',
    );
    assert.equal(searched.total, 1, `keyword 应精确命中 1 条，实际 ${searched.total}`);
    assert.equal(searched.list[0].id, S.regionId, '搜索结果 id 不符');
  });

  t.test('[F-32] 编辑地区（改名）→ 回填一致；改成其他地区名 → 1003', async () => {
    const renamed = `验收地区改${S.stamp}`;
    const put = await api('PUT', `/api/admin/regions/${S.regionId}`, {
      token: state.adminToken,
      body: { ...regionBody(renamed), description: '已编辑', sortOrder: 12 },
    });
    const data = expectOk(put, '编辑地区');
    assert.equal(data.region.name, renamed, '编辑后名称未更新');
    assert.equal(data.region.sortOrder, 12, '编辑后 sortOrder 未更新');
    S.regionName = renamed;

    const detail = expectOk(await api('GET', `/api/admin/regions/${S.regionId}`, { token: state.adminToken }), '地区详情回填');
    assert.equal(detail.region.name, renamed, '详情回填名称不一致');
    assert.equal(detail.region.description, '已编辑', '详情回填简介不一致');

    const conflict = await api('PUT', `/api/admin/regions/${S.regionId}`, {
      token: state.adminToken,
      body: regionBody('四川'),
    });
    expectStatus(conflict, 409, '改成已存在地区名');
    expectFail(conflict, 1003, '改成已存在地区名');

    const missing = await api('PUT', '/api/admin/regions/999999', { token: state.adminToken, body: regionBody('随便改名') });
    expectStatus(missing, 404, '编辑不存在地区');
    expectFail(missing, 1002, '编辑不存在地区');
  });

  /* ---------------- F-33 删除地区 ---------------- */
  t.test('[F-33] 删除仍有景区的地区 → 409 + 3001，message 含「还有 N 个景区」且日志 result=fail', async () => {
    const regions = expectOk(await api('GET', '/api/admin/regions?pageSize=100', { token: state.adminToken }), '地区列表（找有景区的）');
    const occupied = regions.list.find((item) => item.scenicCount > 0);
    assert.ok(occupied, '种子里没有「有景区的地区」，无法验证 3001');

    const before = await opsTotal();
    const res = await api('DELETE', `/api/admin/regions/${occupied.id}`, { token: state.adminToken });
    expectStatus(res, 409, '删除有景区的地区');
    expectFail(res, 3001, '删除有景区的地区');
    assert.ok(
      res.json.message.includes(`${occupied.scenicCount} 个景区`),
      `message 应包含「${occupied.scenicCount} 个景区」，实际：${res.json.message}`,
    );
    const after = await opsTotal();
    assert.equal(after, before + 1, '被拒绝的删除也应记录失败日志（F-43 明确要求）');
    const op = await latestOp();
    assert.equal(op.result, 'fail', '失败日志 result 应为 fail');
    assert.equal(op.action, 'delete', '失败日志 action 应为 delete');
  });

  /* ---------------- F-35 / F-34 / F-38 ---------------- */
  t.test('[F-35] 新增景区：regionId 不存在 → 400 + 3002 且提示可读', async () => {
    const res = await api('POST', '/api/admin/scenics', {
      token: state.adminToken,
      body: {
        name: `验收景区坏${S.stamp}`,
        regionId: 999999,
        coverImage: '/images/about.jpg',
        description: '这是一段足够长的景区简介内容，用于通过长度校验。',
      },
    });
    expectStatus(res, 400, '景区 regionId 不存在');
    expectFail(res, 3002, '景区 regionId 不存在');
    assert.ok(res.json.message.includes('地区'), `3002 message 应可读并指出地区问题，实际：${res.json.message}`);
  });

  t.test('[F-35] 新增景区成功 → 201，且[F-43]操作日志 +1', async () => {
    const before = await opsTotal();
    S.scenicName = `验收景区${S.stamp}`;
    const res = await api('POST', '/api/admin/scenics', {
      token: state.adminToken,
      body: {
        name: S.scenicName,
        regionId: S.regionId,
        coverImage: '/images/about.jpg',
        gallery: ['/images/about.jpg', '/images/westlake.jpg'],
        openTime: '08:00–18:00',
        ticketPrice: '免费',
        traffic: '地铁 1 号线可达，自驾有停车场。',
        description: '这是 QA 验收创建的景区简介，长度足够通过 10 字下限校验，测后随地区一起删除。',
        isRecommended: false,
        level: '4A',
        rating: '4.5',
        bestSeason: '四季皆宜',
        highlights: ['验收看点一', '验收看点二'],
      },
    });
    expectStatus(res, 201, '新增景区');
    const data = expectOk(res, '新增景区');
    S.scenicId = data.scenic.id;
    assert.equal(data.scenic.regionId, S.regionId, '景区归属地区不符');
    assert.equal(data.scenic.rating, 4.5, `rating 应归一化为 4.5，实际 ${data.scenic.rating}`);
    assert.deepEqual(data.scenic.gallery, ['/images/about.jpg', '/images/westlake.jpg'], 'gallery 归一化异常');

    const after = await opsTotal();
    assert.equal(after, before + 1, '新增景区应写 1 条操作日志');
    const op = await latestOp();
    assert.equal(op.module, 'scenic', '日志 module 应为 scenic');
    assert.equal(op.action, 'create', '日志 action 应为 create');
    assert.equal(op.targetId, S.scenicId, '日志 targetId 不符');
  });

  t.test('[F-35] 新增景区校验：名称过短 / 简介过短 / 评分越界 → 1001 且逐项定位', async () => {
    const res = await api('POST', '/api/admin/scenics', {
      token: state.adminToken,
      body: { name: 'A', regionId: S.regionId, coverImage: '/images/about.jpg', description: '太短', rating: 9 },
    });
    const data = expectFail(res, 1001, '景区字段校验');
    for (const field of ['name', 'description', 'rating']) {
      assert.ok(data && data[field], `1001 data 缺少 ${field}，实际 ${JSON.stringify(data)}`);
    }
  });

  t.test('[F-31/F-35] 图片白名单：只接受 /images/ 下真实存在的 .jpg（.png/不存在/无前缀/非法扩展名 → 1001）', async () => {
    // 校验失败发生在 push/save 之前，不写库；用于锁定 isAvailableImagePath 口径。
    const badPaths = ['/images/guilin.png', '/images/not-a-real-asset.jpg', 'images/x.jpg', '/images/jiuzhaigou.gif'];
    for (const coverImage of badPaths) {
      const res = await api('POST', '/api/admin/regions', {
        token: state.adminToken,
        body: { name: `图片校验${S.stamp}`, coverImage, description: '', sortOrder: 1 },
      });
      const data = expectFail(res, 1001, `地区封面 ${coverImage}`);
      assert.ok(data && data.coverImage, `${coverImage}：1001 data 应含 coverImage`);
      assert.ok(
        String(data.coverImage).includes('/images/'),
        `${coverImage}：提示文案应指出「/images/ 下已存在的图片」并给示例`,
      );
    }
  });

  t.test('[F-35/F-40] 图集每一项与游记封面同样走白名单（已下线图片 → 1001）', async () => {
    const gallery = await api('POST', '/api/admin/scenics', {
      token: state.adminToken,
      body: {
        name: `图集校验${S.stamp}`,
        regionId: S.regionId,
        coverImage: '/images/about.jpg',
        gallery: ['/images/about.jpg', '/images/guilin.png'],
        description: '这是一段足够长的景区简介，用于通过长度校验。',
      },
    });
    const galleryErrors = expectFail(gallery, 1001, '图集含已下线图片');
    assert.ok(galleryErrors && galleryErrors.gallery, '1001 data 应含 gallery，前端才能定位到图集字段');

    const travel = await api('POST', '/api/admin/travels', {
      token: state.adminToken,
      body: {
        title: `封面校验${S.stamp}`,
        scenicId: 1,
        coverImage: '/images/guilin.png',
        content: '这是一段足够长的游记正文内容，用于通过长度校验。',
      },
    });
    const travelErrors = expectFail(travel, 1001, '游记封面图为已下线图片');
    assert.ok(travelErrors && travelErrors.coverImage, '1001 data 应含 coverImage');
  });

  t.test('[F-34] 后台景区列表：keyword 命中且含 regionName/travelCount/favoriteCount', async () => {
    const data = expectOk(
      await api('GET', `/api/admin/scenics?keyword=${encodeURIComponent(S.scenicName)}&pageSize=100`, { token: state.adminToken }),
      '后台景区搜索',
    );
    assert.equal(data.total, 1, `keyword 应命中 1 条，实际 ${data.total}`);
    const item = data.list[0];
    assert.equal(item.id, S.scenicId, '命中景区 id 不符');
    assert.equal(item.regionName, S.regionName, `regionName 应为「${S.regionName}」，实际「${item.regionName}」`);
    assert.equal(item.travelCount, 0, '新景区游记数应为 0');
    assert.equal(typeof item.favoriteCount, 'number', '缺少 favoriteCount');
  });

  t.test('[F-38] 推荐开关：设为推荐 → isRecommended=true 且返回 recommendedTotal；超 6 个时给 warning', async () => {
    const on = await api('PATCH', `/api/admin/scenics/${S.scenicId}/recommend`, { token: state.adminToken, body: { isRecommended: true } });
    const data = expectOk(on, '设为推荐');
    assert.equal(data.isRecommended, true, 'isRecommended 应变为 true');
    assert.ok(Number.isInteger(data.recommendedTotal) && data.recommendedTotal >= 1, `recommendedTotal 非法：${data.recommendedTotal}`);
    if (data.recommendedTotal > 6) {
      assert.ok(data.warning, `推荐数 ${data.recommendedTotal} 已超 6，应返回 warning`);
    }

    // F-38 + F-05 交叉验证：推荐数超 6 时，首页推荐位仍只取 6 个
    const home = expectOk(await api('GET', '/api/scenics?isRecommended=true&limit=6'), '首页推荐位（超量时）');
    assert.equal(home.list.length, 6, `推荐位超量时首页仍应只返回 6 个，实际 ${home.list.length}`);
    assert.equal(home.total, data.recommendedTotal, `推荐位 total(${home.total}) 应等于 recommendedTotal(${data.recommendedTotal})`);

    const off = await api('PATCH', `/api/admin/scenics/${S.scenicId}/recommend`, { token: state.adminToken, body: { isRecommended: false } });
    const data2 = expectOk(off, '取消推荐');
    assert.equal(data2.isRecommended, false, 'isRecommended 应变为 false');

    const bad = await api('PATCH', `/api/admin/scenics/${S.scenicId}/recommend`, { token: state.adminToken, body: {} });
    expectFail(bad, 1001, '推荐开关缺参数');
    const missing = await api('PATCH', '/api/admin/scenics/999999/recommend', { token: state.adminToken, body: { isRecommended: true } });
    expectFail(missing, 1002, '推荐开关景区不存在');
  });

  /* ---------------- F-40 / F-41 / F-42 游记 ---------------- */
  t.test('[F-40] 新增游记校验：title 过短 1001 / scenicId 不存在 3002', async () => {
    const shortTitle = await api('POST', '/api/admin/travels', {
      token: state.adminToken,
      body: { title: '短', scenicId: S.scenicId, content: '这是一段足够长的正文内容，用于通过校验。' },
    });
    const d1 = expectFail(shortTitle, 1001, '游记标题过短');
    assert.ok(d1 && d1.title, '1001 data 应含 title');

    const badScenic = await api('POST', '/api/admin/travels', {
      token: state.adminToken,
      body: { title: `不存在的景区游记${S.stamp}`, scenicId: 999999, content: '这是一段足够长的正文内容，用于通过校验。' },
    });
    expectStatus(badScenic, 400, '游记 scenicId 不存在');
    expectFail(badScenic, 3002, '游记 scenicId 不存在');
  });

  t.test('[F-40] 新增游记成功 → 201，前台详情可访问，作者缺省为「站点编辑」', async () => {
    S.travelTitle = `验收游记${S.stamp}`;
    const res = await api('POST', '/api/admin/travels', {
      token: state.adminToken,
      body: {
        title: S.travelTitle,
        scenicId: S.scenicId,
        content: '第一段：QA 验收创建的游记正文，用于验证级联删除。\n\n第二段：段落换行应被保留。',
      },
    });
    expectStatus(res, 201, '新增游记');
    const data = expectOk(res, '新增游记');
    S.travelId = data.travel.id;
    assert.equal(data.travel.authorName, '站点编辑', `作者缺省值应为「站点编辑」，实际 ${data.travel.authorName}`);
    assert.ok(data.travel.content.includes('\n'), '正文换行被吞掉，前端无法分段渲染');
    assert.equal(data.travel.scenicName, S.scenicName, 'scenicName 不符');
    assert.equal(data.travel.coverImage, '/images/about.jpg', '未传封面时应回落景区封面');

    const front = expectOk(await api('GET', `/api/travels/${S.travelId}`), '前台游记详情');
    assert.equal(front.travel.title, S.travelTitle, '前台游记标题未同步');
  });

  t.test('[F-36] 编辑景区：名称/评分更新，后台详情返回 travelCount/favoriteCount', async () => {
    const renamed = `${S.scenicName}改`;
    const put = await api('PUT', `/api/admin/scenics/${S.scenicId}`, {
      token: state.adminToken,
      body: {
        name: renamed,
        regionId: S.regionId,
        coverImage: '/images/about.jpg',
        description: '编辑后的景区简介，内容仍然足够长，用于通过 10 字下限。',
        level: '5A',
        rating: 4.9,
      },
    });
    const data = expectOk(put, '编辑景区');
    assert.equal(data.scenic.name, renamed, '景区名未更新');
    assert.equal(data.scenic.rating, 4.9, '景区评分未更新');
    assert.ok(data.scenic.updatedAt >= data.scenic.createdAt, 'updatedAt 应不早于 createdAt');
    S.scenicName = renamed;

    const adminDetail = expectOk(await api('GET', `/api/admin/scenics/${S.scenicId}`, { token: state.adminToken }), '后台景区详情');
    assert.equal(adminDetail.travelCount, 1, `travelCount 应为 1，实际 ${adminDetail.travelCount}`);
    assert.equal(typeof adminDetail.favoriteCount, 'number', '后台景区详情缺少 favoriteCount');

    const front = expectOk(await api('GET', `/api/scenics/${S.scenicId}`), '前台景区详情（编辑后）');
    assert.equal(front.scenic.name, renamed, '前台景区详情未同步编辑结果');
  });

  /* ---------------- F-37 级联删除 ---------------- */
  t.test('[F-37] 删除景区级联删除游记与收藏，且删除后前台 404', async () => {
    // 1) 造一条收藏（会员 token）
    const fav = await api('POST', '/api/favorites', { token: state.memberToken, body: { scenicId: S.scenicId } });
    const favData = expectOk(fav, '为级联测试新增收藏');
    assert.equal(favData.created, true, '级联测试的收藏应新建成功');

    // 2) 删除景区
    const opsBefore = await opsTotal();
    const del = await api('DELETE', `/api/admin/scenics/${S.scenicId}`, { token: state.adminToken });
    const data = expectOk(del, '删除景区');
    assert.equal(data.deleted, true, 'deleted 应为 true');
    assert.ok(data.cascade, '删除响应应返回 cascade 统计（F-37 弹窗文案依赖）');
    assert.equal(data.cascade.travels, 1, `级联删除游记数应为 1，实际 ${data.cascade.travels}`);
    assert.equal(data.cascade.favorites, 1, `级联删除收藏数应为 1，实际 ${data.cascade.favorites}`);

    // 2.1) F-43：删除景区必须写操作日志，且 message 说明级联数量
    const opsAfter = await opsTotal();
    assert.equal(opsAfter, opsBefore + 1, `删除景区应写 1 条操作日志，实际 ${opsBefore} → ${opsAfter}`);
    const deleteOp = await latestOp();
    assert.equal(deleteOp.module, 'scenic', `删除景区日志 module 应为 scenic，实际 ${deleteOp.module}`);
    assert.equal(deleteOp.action, 'delete', `删除景区日志 action 应为 delete，实际 ${deleteOp.action}`);
    assert.equal(deleteOp.targetId, S.scenicId, '删除景区日志 targetId 不符');
    assert.ok(
      deleteOp.message.includes('级联删除'),
      `删除景区日志 message 应说明级联数量（F-37/F-43），实际：「${deleteOp.message}」`,
    );

    // 3) 级联结果校验
    const scenicGone = await api('GET', `/api/scenics/${S.scenicId}`);
    expectStatus(scenicGone, 404, '删除后景区详情');
    expectFail(scenicGone, 1002, '删除后景区详情');

    const travelGone = await api('GET', `/api/travels/${S.travelId}`);
    expectStatus(travelGone, 404, '级联后游记详情');
    expectFail(travelGone, 1002, '级联后游记详情');

    const favorites = expectOk(await api('GET', '/api/favorites?pageSize=100', { token: state.memberToken }), '级联后收藏列表');
    assert.ok(!favorites.list.some((item) => item.id === S.scenicId), '级联后收藏列表仍残留该景区');
    S.scenicId = null;
  });

  t.test('[F-37] 删除不存在的景区 → 1002', async () => {
    const res = await api('DELETE', '/api/admin/scenics/999999', { token: state.adminToken });
    expectStatus(res, 404, '删除不存在景区');
    expectFail(res, 1002, '删除不存在景区');
  });

  /* ---------------- F-41 / F-42 游记增删改查 ---------------- */
  t.test('[F-41] 游记增删改查闭环：create → detail → update → 前台同步 → delete → 前台 1002', async () => {
    const scenics = expectOk(await api('GET', '/api/scenics?pageSize=1'), '取一个存活景区');
    const targetScenic = scenics.list[0];
    assert.ok(targetScenic, '没有存活景区可用');

    const opsBeforeCreate = await opsTotal();
    const created = expectOk(
      await api('POST', '/api/admin/travels', {
        token: state.adminToken,
        body: {
          title: `CRUD游记${S.stamp}`,
          scenicId: targetScenic.id,
          content: '第一段正文内容足够长。\n\n第二段正文内容也足够长。',
          publishedAt: '2026-01-02T10:00',
        },
      }),
      '游记 create',
    );
    const id = created.travel.id;
    assert.ok(created.travel.publishedAt.startsWith('2026-01-02'), `publishedAt 归一化异常：${created.travel.publishedAt}`);

    // F-43：游记新增也要写操作日志
    const opsAfterCreate = await opsTotal();
    assert.equal(opsAfterCreate, opsBeforeCreate + 1, '新增游记应写 1 条操作日志');
    const createOp = await latestOp();
    assert.equal(createOp.module, 'travel', `游记日志 module 应为 travel，实际 ${createOp.module}`);
    assert.equal(createOp.action, 'create', `游记日志 action 应为 create，实际 ${createOp.action}`);
    assert.equal(createOp.targetId, id, '游记日志 targetId 不符');

    const detail = expectOk(await api('GET', `/api/admin/travels/${id}`, { token: state.adminToken }), '游记后台详情');
    assert.equal(detail.travel.id, id, '后台详情 id 不符');

    const updated = expectOk(
      await api('PUT', `/api/admin/travels/${id}`, {
        token: state.adminToken,
        body: {
          title: `CRUD游记改名${S.stamp}`,
          scenicId: targetScenic.id,
          content: '改后的正文内容同样足够长，用于通过校验。',
          publishedAt: '2026-02-03T09:30',
        },
      }),
      '游记 update',
    );
    assert.equal(updated.travel.title, `CRUD游记改名${S.stamp}`, '游记标题未更新');
    assert.ok(updated.travel.publishedAt.startsWith('2026-02-03'), '发布时间未更新（F-41 要求可调整排序）');

    const front = expectOk(await api('GET', `/api/travels/${id}`), '前台游记详情');
    assert.equal(front.travel.title, updated.travel.title, '前台未同步标题');
    assert.equal(front.travel.id, id, '前台详情 id 不符');

    const opsBeforeDelete = await opsTotal();
    const del = await api('DELETE', `/api/admin/travels/${id}`, { token: state.adminToken });
    expectOk(del, '游记 delete');

    // F-43：游记删除同样写日志
    const opsAfterDelete = await opsTotal();
    assert.equal(opsAfterDelete, opsBeforeDelete + 1, '删除游记应写 1 条操作日志');
    const deleteOp = await latestOp();
    assert.equal(deleteOp.module, 'travel', `游记删除日志 module 应为 travel，实际 ${deleteOp.module}`);
    assert.equal(deleteOp.action, 'delete', `游记删除日志 action 应为 delete，实际 ${deleteOp.action}`);

    const gone = await api('GET', `/api/travels/${id}`);
    expectStatus(gone, 404, '删除后前台游记');
    expectFail(gone, 1002, '删除后前台游记');
  });

  t.test('[F-42] 删除/编辑不存在的游记 → 1002', async () => {
    expectFail(await api('DELETE', '/api/admin/travels/999999', { token: state.adminToken }), 1002, '删除不存在游记');
    expectFail(await api('GET', '/api/admin/travels/999999', { token: state.adminToken }), 1002, '后台查不存在游记');
    expectFail(
      await api('PUT', '/api/admin/travels/999999', {
        token: state.adminToken,
        body: { title: '随便改个标题', scenicId: 1, content: '正文内容足够长足够长。' },
      }),
      1002,
      '编辑不存在游记',
    );
  });

  /* ---------------- F-33 删除空地区（此时刚建地区已无景区） ---------------- */
  t.test('[F-33] 删除已无景区的地区 → 成功；再删除 → 1002', async () => {
    const before = await opsTotal();
    const del = await api('DELETE', `/api/admin/regions/${S.regionId}`, { token: state.adminToken });
    const data = expectOk(del, '删除空地区');
    assert.equal(data.deleted, true, 'deleted 应为 true');
    const after = await opsTotal();
    assert.equal(after, before + 1, '删除地区应写 1 条操作日志');
    const op = await latestOp();
    assert.equal(op.action, 'delete', '最新日志 action 应为 delete');
    assert.equal(op.result, 'success', '最新日志 result 应为 success');

    const again = await api('DELETE', `/api/admin/regions/${S.regionId}`, { token: state.adminToken });
    expectStatus(again, 404, '重复删除地区');
    expectFail(again, 1002, '重复删除地区');
  });

  /* ---------------- F-26 / F-27 会员管理 ---------------- */
  t.test('[F-26] 会员列表：分页字段完整、无 passwordHash、含 favoriteCount；keyword 可查', async () => {
    const data = expectOk(await api('GET', '/api/admin/members?pageSize=100', { token: state.adminToken }), '后台会员列表');
    assert.ok(data.total >= 3, `种子 2 人 + 本轮注册 1 人，total 应 ≥3，实际 ${data.total}`);
    assert.equal(data.pageSize, 100, 'pageSize 回写异常');
    for (const item of data.list) {
      assert.ok(!('passwordHash' in item), `会员列表泄露 passwordHash（id=${item.id}）`);
      assert.equal(typeof item.favoriteCount, 'number', '会员项缺少 favoriteCount');
      for (const field of ['id', 'username', 'phone', 'email', 'createdAt']) {
        assert.ok(field in item, `会员项缺少字段 ${field}`);
      }
    }
    const searched = expectOk(
      await api('GET', `/api/admin/members?keyword=${encodeURIComponent('林小满')}&pageSize=100`, { token: state.adminToken }),
      '会员搜索',
    );
    assert.ok(searched.total >= 1, 'keyword=林小满 未命中');
    assert.ok(searched.list.every((item) => `${item.username}${item.phone}${item.email}`.includes('林小满')), '搜索命中项与关键词无关');
  });

  t.test('[F-26] 会员排序：sortBy=id&order=asc 生效；非法 sortBy/order → 1001', async () => {
    const asc = expectOk(await api('GET', '/api/admin/members?sortBy=id&order=asc&pageSize=100', { token: state.adminToken }), '会员 id asc');
    for (let i = 1; i < asc.list.length; i += 1) {
      assert.ok(asc.list[i - 1].id < asc.list[i].id, `id asc 顺序错误：${asc.list[i - 1].id} → ${asc.list[i].id}`);
    }
    const desc = expectOk(await api('GET', '/api/admin/members?sortBy=id&order=desc&pageSize=100', { token: state.adminToken }), '会员 id desc');
    for (let i = 1; i < desc.list.length; i += 1) {
      assert.ok(desc.list[i - 1].id > desc.list[i].id, `id desc 顺序错误：${desc.list[i - 1].id} → ${desc.list[i].id}`);
    }
    expectFail(await api('GET', '/api/admin/members?sortBy=passwordHash', { token: state.adminToken }), 1001, '非法 sortBy');
    expectFail(await api('GET', '/api/admin/members?order=sideways', { token: state.adminToken }), 1001, '非法 order');
  });

  t.test('[F-27] 会员详情：收藏列表与收藏数一致、登录日志 ≤10 条；不存在 → 1002', async () => {
    const data = expectOk(await api('GET', '/api/admin/members/1', { token: state.adminToken }), '会员详情');
    assert.equal(data.member.id, 1, '会员 id 不符');
    assert.ok(!('passwordHash' in data.member), '会员详情泄露 passwordHash');
    assert.equal(data.favorites.length, data.member.favoriteCount, `收藏列表长度(${data.favorites.length}) 与 favoriteCount(${data.member.favoriteCount}) 不一致`);
    assert.ok(data.loginLogs.length <= 10, `登录日志应 ≤10 条，实际 ${data.loginLogs.length}`);
    for (const fav of data.favorites) {
      for (const field of ['id', 'name', 'favoriteId', 'favoritedAt']) {
        assert.ok(field in fav, `会员收藏项缺少 ${field}`);
      }
    }
    const missing = await api('GET', '/api/admin/members/999999', { token: state.adminToken });
    expectStatus(missing, 404, '会员不存在');
    expectFail(missing, 1002, '会员不存在');
  });

  /* ---------------- F-28 / F-29 意见反馈管理 ---------------- */
  t.test('[F-28] 意见建议列表：pendingCount 与 pending 过滤自洽；非法 status → 1001', async () => {
    const all = expectOk(await api('GET', '/api/admin/feedbacks?pageSize=100', { token: state.adminToken }), '后台反馈列表');
    assert.ok(typeof all.pendingCount === 'number', '缺少 pendingCount');
    const pending = expectOk(await api('GET', '/api/admin/feedbacks?status=pending&pageSize=100', { token: state.adminToken }), 'pending 反馈');
    assert.equal(pending.total, all.pendingCount, `pending 过滤 total(${pending.total}) 与 pendingCount(${all.pendingCount}) 不一致`);
    assert.ok(pending.list.length > 0, '本轮提交过反馈，pending 列表不应为空');
    S.feedbackId = pending.list[0].id;
    expectFail(await api('GET', '/api/admin/feedbacks?status=archived', { token: state.adminToken }), 1001, '非法 status');
  });

  t.test('[F-29] 标记已处理：status=resolved 且 handledAt 落值；非法状态/不存在 id 各自报错', async () => {
    const before = expectOk(await api('GET', '/api/admin/feedbacks?status=pending&pageSize=1', { token: state.adminToken }), 'pending 基线');
    const res = await api('PATCH', `/api/admin/feedbacks/${S.feedbackId}`, { token: state.adminToken, body: { status: 'resolved' } });
    const data = expectOk(res, '标记已处理');
    assert.equal(data.status, 'resolved', 'status 应为 resolved');
    assert.ok(data.handledAt && !Number.isNaN(Date.parse(data.handledAt)), `handledAt 非法：${data.handledAt}`);

    const after = expectOk(await api('GET', '/api/admin/feedbacks?status=pending&pageSize=1', { token: state.adminToken }), 'pending 复测');
    assert.equal(after.total, before.total - 1, `pendingCount 应减 1，实际 ${before.total} → ${after.total}`);

    expectFail(
      await api('PATCH', `/api/admin/feedbacks/${S.feedbackId}`, { token: state.adminToken, body: { status: 'done' } }),
      1001,
      '非法反馈状态',
    );
    expectFail(
      await api('PATCH', '/api/admin/feedbacks/999999', { token: state.adminToken, body: { status: 'resolved' } }),
      1002,
      '不存在反馈',
    );

    // 复原为 pending，避免污染种子语义
    expectOk(
      await api('PATCH', `/api/admin/feedbacks/${S.feedbackId}`, { token: state.adminToken, body: { status: 'pending' } }),
      '复原反馈状态',
    );
  });

  /* ---------------- F-22 改密 ---------------- */
  t.test('[F-22] 改密：原密码错 → 1001/2005；成功后新密码可登、旧密码失效；随后必须改回', async () => {
    const original = process.env.ETRAVEL_ADMIN_PASSWORD || 'admin123';
    const tempPassword = 'qaTmp2024';
    assert.notEqual(original, tempPassword, '临时密码不能与原密码相同，否则用例无意义');

    const wrongOld = await api('PUT', '/api/admin/auth/password', {
      token: state.adminToken,
      body: { oldPassword: 'not-the-original', newPassword: tempPassword, confirmPassword: tempPassword },
    });
    expectFail(wrongOld, 2005, '原密码错误');
    assert.ok(wrongOld.json.data && wrongOld.json.data.oldPassword, '2005 的 data 应定位 oldPassword');

    const tooShort = await api('PUT', '/api/admin/auth/password', {
      token: state.adminToken,
      body: { oldPassword: original, newPassword: '12345', confirmPassword: '12345' },
    });
    expectFail(tooShort, 1001, '新密码过短');

    const mismatch = await api('PUT', '/api/admin/auth/password', {
      token: state.adminToken,
      body: { oldPassword: original, newPassword: tempPassword, confirmPassword: 'other12345' },
    });
    expectFail(mismatch, 1001, '两次新密码不一致');

    const ok = await api('PUT', '/api/admin/auth/password', {
      token: state.adminToken,
      body: { oldPassword: original, newPassword: tempPassword, confirmPassword: tempPassword },
    });
    const data = expectOk(ok, '改密成功');
    assert.equal(data.reloginRequired, true, '改密后应要求重新登录');

    const newLogin = await api('POST', '/api/admin/auth/login', { body: { username: 'admin', password: tempPassword } });
    expectOk(newLogin, '新密码登录');

    const oldLogin = await api('POST', '/api/admin/auth/login', { body: { username: 'admin', password: original } });
    expectFail(oldLogin, 2003, '旧密码登录应失败');

    // 必须改回，否则污染前端联调
    const restore = await api('PUT', '/api/admin/auth/password', {
      token: state.adminToken,
      body: { oldPassword: tempPassword, newPassword: original, confirmPassword: original },
    });
    expectOk(restore, '恢复原密码');

    const restored = await api('POST', '/api/admin/auth/login', { body: { username: 'admin', password: original } });
    const restoredData = expectOk(restored, '原密码复登');
    state.adminToken = restoredData.token;
  });

  /* ---------------- F-43 / F-44 / F-45 / F-46 日志 ---------------- */
  t.test('[F-43] 三类日志均可分页查询，字段结构与 totalPages 自洽', async () => {
    const endpoints = [
      ['/api/admin/logs/operations', ['module', 'action', 'targetId', 'targetName', 'result', 'adminName', 'createdAt']],
      ['/api/admin/logs/admins', ['username', 'event', 'ip', 'result', 'createdAt']],
      ['/api/admin/logs/member-logins', ['username', 'ip', 'result', 'createdAt']],
    ];
    for (const [path, fields] of endpoints) {
      const data = expectOk(await api('GET', `${path}?pageSize=5`, { token: state.adminToken }), `${path} 分页`);
      assert.equal(data.pageSize, 5, `${path} pageSize 回写异常`);
      assert.ok(Array.isArray(data.list), `${path} list 应为数组`);
      assert.ok(data.list.length <= 5, `${path} 单页条数超限：${data.list.length}`);
      assert.equal(data.totalPages, Math.max(1, Math.ceil(data.total / 5)), `${path} totalPages 计算错误`);
      if (data.list.length > 0) {
        for (const field of fields) {
          assert.ok(field in data.list[0], `${path} 日志缺少字段 ${field}`);
        }
      }
    }
  });

  t.test('[F-43] 操作日志筛选：module/action/result 各自生效；非法值 → 1001', async () => {
    const regionLogs = expectOk(await api('GET', '/api/admin/logs/operations?module=region&pageSize=100', { token: state.adminToken }), 'region 日志');
    assert.ok(regionLogs.total >= 1, '本轮做过地区增改删，region 日志应 ≥1');
    for (const item of regionLogs.list) {
      assert.equal(item.module, 'region', `module=region 结果混入 ${item.module}`);
    }
    const failLogs = expectOk(await api('GET', '/api/admin/logs/operations?result=fail&pageSize=100', { token: state.adminToken }), 'fail 日志');
    assert.ok(failLogs.total >= 1, '本轮有失败操作（重名/占用删除），fail 日志应 ≥1');
    for (const item of failLogs.list) {
      assert.equal(item.result, 'fail', `result=fail 结果混入 ${item.result}`);
    }
    const delLogs = expectOk(await api('GET', '/api/admin/logs/operations?action=delete&pageSize=100', { token: state.adminToken }), 'delete 日志');
    for (const item of delLogs.list) {
      assert.equal(item.action, 'delete', `action=delete 结果混入 ${item.action}`);
    }
    expectFail(await api('GET', '/api/admin/logs/operations?module=member', { token: state.adminToken }), 1001, '非法 module');
    expectFail(await api('GET', '/api/admin/logs/operations?action=logout', { token: state.adminToken }), 1001, '非法 action');
  });

  t.test('[F-44] 管理员日志：event=login/logout 过滤生效；非法 event → 1001', async () => {
    const logins = expectOk(await api('GET', '/api/admin/logs/admins?event=login&pageSize=100', { token: state.adminToken }), 'login 事件');
    assert.ok(logins.total >= 1, '本轮登录过后台，login 事件应 ≥1');
    for (const item of logins.list) {
      assert.equal(item.event, 'login', `event=login 结果混入 ${item.event}`);
    }
    expectFail(await api('GET', '/api/admin/logs/admins?event=reset_password', { token: state.adminToken }), 1001, '非法 event');
  });

  t.test('[F-45] 会员登录日志：result=fail 过滤生效，失败记录带会员名', async () => {
    const fails = expectOk(await api('GET', '/api/admin/logs/member-logins?result=fail&pageSize=100', { token: state.adminToken }), '会员失败登录');
    assert.ok(fails.total >= 1, '本轮制造过错误密码登录，fail 日志应 ≥1');
    for (const item of fails.list) {
      assert.equal(item.result, 'fail', `result=fail 结果混入 ${item.result}`);
      assert.ok(typeof item.username === 'string' && item.username.length > 0, '失败日志未记录会员名');
    }
    expectFail(await api('GET', '/api/admin/logs/member-logins?result=maybe', { token: state.adminToken }), 1001, '非法 result');
  });

  t.test('[F-46] pageSize 上限 100 生效（500/999/1000 均被截断）；时间范围筛选可用', async () => {
    for (const path of ['/api/admin/logs/operations', '/api/admin/logs/admins', '/api/admin/logs/member-logins']) {
      for (const requested of [500, 999, 1000]) {
        const capped = expectOk(
          await api('GET', `${path}?pageSize=${requested}`, { token: state.adminToken }),
          `${path} pageSize=${requested}`,
        );
        assert.equal(capped.pageSize, 100, `${path} pageSize=${requested} 应被截断到契约上限 100，实际 ${capped.pageSize}`);
        assert.ok(capped.list.length <= 100, `${path} pageSize=${requested} 单页返回 ${capped.list.length} 条，超过上限`);
      }
      // 边界值 100 必须原样生效，不能被误截断成更小值
      const exact = expectOk(await api('GET', `${path}?pageSize=100`, { token: state.adminToken }), `${path} pageSize=100`);
      assert.equal(exact.pageSize, 100, `${path} pageSize=100 应原样生效，实际 ${exact.pageSize}`);
    }
    const day = today();
    const todayLogs = expectOk(
      await api('GET', `/api/admin/logs/operations?startDate=${day}&endDate=${day}&pageSize=100`, { token: state.adminToken }),
      '今日操作日志',
    );
    assert.ok(todayLogs.total >= 1, '本轮刚做过写操作，今日操作日志应 ≥1');
    for (const item of todayLogs.list) {
      assert.equal(new Date(item.createdAt).toDateString(), new Date().toDateString(), `时间范围筛选混入非今日日志：${item.createdAt}`);
    }
    const ancient = expectOk(
      await api('GET', '/api/admin/logs/operations?startDate=2020-01-01&endDate=2020-01-02', { token: state.adminToken }),
      '历史区间日志',
    );
    assert.equal(ancient.total, 0, `2020 年区间不应有日志，实际 ${ancient.total}`);
  });

  /* ---------------- F-25 仪表盘 ---------------- */
  t.test('[F-25] 仪表盘 stats 与各模块列表 total 完全一致，recentLogs ≤8 且倒序', async () => {
    const dash = expectOk(await api('GET', '/api/admin/dashboard', { token: state.adminToken }), '仪表盘');
    const regions = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '地区 total');
    const scenics = expectOk(await api('GET', '/api/admin/scenics?pageSize=1', { token: state.adminToken }), '景区 total');
    const travels = expectOk(await api('GET', '/api/admin/travels?pageSize=1', { token: state.adminToken }), '游记 total');
    const members = expectOk(await api('GET', '/api/admin/members?pageSize=1', { token: state.adminToken }), '会员 total');
    const feedbacks = expectOk(await api('GET', '/api/admin/feedbacks?pageSize=1', { token: state.adminToken }), '反馈 total');

    assert.equal(dash.stats.regionCount, regions.total, `regionCount=${dash.stats.regionCount}，列表=${regions.total}`);
    assert.equal(dash.stats.scenicCount, scenics.total, `scenicCount=${dash.stats.scenicCount}，列表=${scenics.total}`);
    assert.equal(dash.stats.travelCount, travels.total, `travelCount=${dash.stats.travelCount}，列表=${travels.total}`);
    assert.equal(dash.stats.memberCount, members.total, `memberCount=${dash.stats.memberCount}，列表=${members.total}`);
    assert.equal(dash.stats.pendingFeedbackCount, feedbacks.pendingCount, `pendingFeedbackCount=${dash.stats.pendingFeedbackCount}，列表=${feedbacks.pendingCount}`);
    assert.equal(typeof dash.stats.todayMemberLoginCount, 'number', '缺少 todayMemberLoginCount');
    assert.ok(dash.stats.todayMemberLoginCount >= 1, '今天登录过会员，todayMemberLoginCount 应 ≥1');

    const day = today();
    const todaySuccess = expectOk(
      await api('GET', `/api/admin/logs/member-logins?result=success&startDate=${day}&endDate=${day}&pageSize=1`, { token: state.adminToken }),
      '今日成功登录日志',
    );
    assert.equal(
      dash.stats.todayMemberLoginCount,
      todaySuccess.total,
      `todayMemberLoginCount(${dash.stats.todayMemberLoginCount}) 与今日成功登录日志(${todaySuccess.total}) 不一致`,
    );

    assert.ok(Array.isArray(dash.recentLogs), 'recentLogs 应为数组');
    assert.ok(dash.recentLogs.length <= 8, `recentLogs 最多 8 条，实际 ${dash.recentLogs.length}`);
    for (let i = 1; i < dash.recentLogs.length; i += 1) {
      const prev = Date.parse(dash.recentLogs[i - 1].createdAt) || 0;
      const next = Date.parse(dash.recentLogs[i].createdAt) || 0;
      assert.ok(prev >= next, `recentLogs 顺序错误（第 ${i} 条早于第 ${i + 1} 条）`);
    }
  });

  /* ---------------- F-35 / F-40 下拉选项 ---------------- */
  t.test('[F-35/F-40] 下拉选项接口：regions/scenics/members 结构正确；非法 type → 1001', async () => {
    for (const [type, check] of [
      ['regions', (item) => typeof item.label === 'string'],
      ['scenics', (item) => typeof item.label === 'string' && 'extra' in item],
      ['members', (item) => typeof item.label === 'string'],
    ]) {
      const data = expectOk(await api('GET', `/api/admin/options?type=${type}`, { token: state.adminToken }), `options ${type}`);
      assert.ok(Array.isArray(data.list) && data.list.length > 0, `options ${type} 列表为空`);
      for (const item of data.list) {
        assert.ok(Number.isInteger(item.value), `options ${type} 的 value 应为整数 id`);
        assert.ok(check(item), `options ${type} 的 label 结构异常`);
      }
    }
    const bad = await api('GET', '/api/admin/options?type=passwords', { token: state.adminToken });
    expectFail(bad, 1001, '非法 options type');
    assert.ok(bad.json.data && bad.json.data.type, '1001 data 应定位 type');
  });

  /* ---------------- F-23 退出 ---------------- */
  t.test('[F-23] 管理员退出写 logout 日志', async () => {
    const before = expectOk(await api('GET', '/api/admin/logs/admins?event=logout&pageSize=1', { token: state.adminToken }), 'logout 基线');
    const res = await api('POST', '/api/admin/auth/logout', { token: state.adminToken });
    expectOk(res, '管理员 logout');
    const after = expectOk(await api('GET', '/api/admin/logs/admins?event=logout&pageSize=1', { token: state.adminToken }), 'logout 复测');
    assert.equal(after.total, before.total + 1, `logout 日志应 +1，实际 ${before.total} → ${after.total}`);
    assert.equal(after.list[0].event, 'logout', '最新日志事件应为 logout');
  });
});
