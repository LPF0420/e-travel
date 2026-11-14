/**
 * B 组：会员链路（F-01 / F-02 / F-03 / F-04 / F-11 / F-12 / F-16 / F-45）+ 鉴权与越权。
 *
 * 口径：DESIGN §3.2 #1~#7、§3.4 错误码表、§3.1 鉴权约定。
 * 重点：断言业务 code（不能只看 HTTP 状态码）；过期/篡改 token 用真实密钥自行签名验证。
 */

import assert from 'node:assert/strict';

import {
  CREDS,
  api,
  defineSuite,
  expectFail,
  expectOk,
  expectStatus,
  forgeToken,
  state,
} from '../lib/harness.mjs';

/** 本组内部上下文 */
const S = {
  stamp: Date.now().toString().slice(-8),
  member: null, // { username, password, phone, email }
  newMemberToken: null,
  newMemberId: null,
  favoriteScenicId: null,
  favoriteCountBefore: 0,
};

export default defineSuite('B. 会员链路 + 鉴权/越权', (t) => {
  t.beforeAll(async () => {
    // 管理员 token（供 F-45 日志核对与越权用例）
    const login = expectOk(await api('POST', '/api/admin/auth/login', { body: CREDS.admin }), '管理员登录（beforeAll）');
    state.adminToken = login.token;

    // 会员 token
    const memberLogin = expectOk(await api('POST', '/api/auth/login', { body: CREDS.member }), '会员登录（beforeAll）');
    state.memberToken = memberLogin.token;
    state.ids.memberId = memberLogin.member.id;

    // 选一个「当前会员尚未收藏」的景区，避免与种子收藏撞车
    const mine = expectOk(await api('GET', '/api/favorites?pageSize=100', { token: state.memberToken }), '会员收藏基线');
    const favorited = new Set(mine.list.map((item) => item.id));
    const scenics = expectOk(await api('GET', '/api/scenics?pageSize=100'), '景区全量（beforeAll）');
    const candidate = scenics.list.find((item) => !favorited.has(item.id));
    assert.ok(candidate, '没有可用于新增收藏的景区（种子数据异常）');
    S.favoriteScenicId = candidate.id;
    S.favoriteCountBefore = candidate.favoriteCount;
  });

  /* ---------------- 登录 ---------------- */
  t.test('[F-02] 会员名 林小满 + 真实密码 登录成功，返回 token 且不含 passwordHash', async () => {
    const data = expectOk(await api('POST', '/api/auth/login', { body: CREDS.member }), '会员登录');
    assert.ok(typeof data.token === 'string' && data.token.includes('.'), 'token 应为 payload.signature 结构');
    assert.equal(data.member.username, CREDS.member.username, `会员名不符：${data.member.username}`);
    assert.ok(!('passwordHash' in data.member), '登录响应泄露 passwordHash');
    assert.equal(typeof data.member.favoriteCount, 'number', 'member.favoriteCount 应为数字');
  });

  t.test('[F-02] 密码错误 → HTTP 401 + code 2003（文案可展示）', async () => {
    const res = await api('POST', '/api/auth/login', { body: { username: CREDS.member.username, password: 'wrong-password' } });
    expectStatus(res, 401, '会员密码错误');
    expectFail(res, 2003, '会员密码错误');
    assert.ok(res.json.message.length > 0, '2003 应带中文提示');
  });

  t.test('[F-02] 账号不存在 → code 2003（不泄露账号是否存在）', async () => {
    const res = await api('POST', '/api/auth/login', { body: { username: `查无此人${S.stamp}`, password: 'whatever1' } });
    expectStatus(res, 401, '会员不存在');
    expectFail(res, 2003, '会员不存在');
  });

  t.test('[F-02] 登录缺字段 → 1001 且 data 能逐项定位 username/password', async () => {
    const res = await api('POST', '/api/auth/login', { body: {} });
    expectStatus(res, 400, '登录空 body');
    const data = expectFail(res, 1001, '登录空 body');
    assert.ok(data && data.username, '1001 data 缺少 username 字段提示');
    assert.ok(data && data.password, '1001 data 缺少 password 字段提示');
  });

  /* ---------------- 注册 ---------------- */
  t.test('[F-01] 正常注册 → 201 + token + favoriteCount=0 + 无 passwordHash', async () => {
    S.member = {
      username: `验收${S.stamp}`,
      password: 'qa123456',
      confirmPassword: 'qa123456',
      phone: '13711112222',
      email: `qa${S.stamp}@example.com`,
    };
    const res = await api('POST', '/api/auth/register', { body: S.member });
    expectStatus(res, 201, '注册');
    const data = expectOk(res, '注册');
    assert.ok(data.token, '注册应自动登录并下发 token');
    assert.equal(data.member.username, S.member.username, '返回的会员名不符');
    assert.equal(data.member.favoriteCount, 0, '新会员收藏数应为 0');
    assert.ok(!('passwordHash' in data.member), '注册响应泄露 passwordHash');
    S.newMemberToken = data.token;
    S.newMemberId = data.member.id;
  });

  t.test('[F-01] 重复会员名 → HTTP 409 + code 1003', async () => {
    const res = await api('POST', '/api/auth/register', { body: { ...S.member } });
    expectStatus(res, 409, '重复注册');
    expectFail(res, 1003, '重复注册');
    assert.ok(res.json.data && res.json.data.username, '1003 的 data 应定位到 username');
  });

  t.test('[F-01] 两次密码不一致 → 1001 且 data.confirmPassword 命中', async () => {
    const res = await api('POST', '/api/auth/register', {
      body: { ...S.member, username: `校验a${S.stamp}`, confirmPassword: 'qa654321' },
    });
    const data = expectFail(res, 1001, '密码不一致');
    assert.ok(data && data.confirmPassword, `1001 data 应含 confirmPassword，实际 ${JSON.stringify(data)}`);
  });

  t.test('[F-01] 手机号非法 → 1001 且 data.phone 命中', async () => {
    const res = await api('POST', '/api/auth/register', {
      body: { ...S.member, username: `校验b${S.stamp}`, phone: '12345' },
    });
    const data = expectFail(res, 1001, '手机号非法');
    assert.ok(data && data.phone, `1001 data 应含 phone，实际 ${JSON.stringify(data)}`);
  });

  t.test('[F-01] 密码仅 5 位 → 1001 且 data.password 命中', async () => {
    const res = await api('POST', '/api/auth/register', {
      body: { ...S.member, username: `校验c${S.stamp}`, password: '12345', confirmPassword: '12345' },
    });
    const data = expectFail(res, 1001, '密码 5 位');
    assert.ok(data && data.password, `1001 data 应含 password，实际 ${JSON.stringify(data)}`);
  });

  t.test('[F-01] 空表单 → 1001 且返回 username/password/phone/email 字段映射', async () => {
    const data = expectFail(await api('POST', '/api/auth/register', { body: {} }), 1001, '空注册');
    for (const field of ['username', 'password', 'phone', 'email']) {
      assert.ok(data && data[field], `1001 data 缺少 ${field} 字段提示，实际 ${JSON.stringify(data)}`);
    }
  });

  t.test('[F-01] 回归：空表单时 data 必须含 confirmPassword 字段提示（曾为 P2 缺陷）', async () => {
    // 历史缺陷：两密码字段同为空时 `confirmPassword !== password` 不成立，导致漏掉该字段提示。
    // 现要求 5 个字段可同时标红；若有人改回旧写法，本用例会立刻红。
    // 复现命令：POST /api/auth/register {}
    const data = expectFail(await api('POST', '/api/auth/register', { body: {} }), 1001, '空注册');
    assert.ok(
      data && data.confirmPassword,
      `1001 data 缺少 confirmPassword（实际 keys=${JSON.stringify(Object.keys(data || {}))}）`,
    );
  });

  t.test('[F-01] 回归：password 为空但 confirmPassword 有值 → 仍报「两次输入的密码不一致」', async () => {
    // 防新的「先判空」分支把 password 空 + confirm 有值 这种组合吞掉
    const res = await api('POST', '/api/auth/register', {
      body: { ...S.member, username: `校验d${S.stamp}`, password: '', confirmPassword: 'qa123456' },
    });
    const data = expectFail(res, 1001, 'password 空 + confirm 有值');
    assert.ok(data && data.password, '1001 data 应含 password');
    assert.ok(data && data.confirmPassword, '1001 data 应含 confirmPassword');
    assert.ok(
      String(data.confirmPassword).includes('不一致'),
      `confirmPassword 提示应为「两次输入的密码不一致」，实际「${data.confirmPassword}」`,
    );
  });

  /* ---------------- F-04 当前会员 ---------------- */
  t.test('[F-04] GET /api/auth/me 返回当前会员且不含 passwordHash', async () => {
    const data = expectOk(await api('GET', '/api/auth/me', { token: S.newMemberToken }), 'auth/me');
    assert.equal(data.member.id, S.newMemberId, `me 返回的会员 id 不符：${data.member.id}`);
    assert.equal(data.member.username, S.member.username, 'me 返回的会员名不符');
    assert.ok(!('passwordHash' in data.member), 'me 泄露 passwordHash');
    assert.equal(typeof data.member.favoriteCount, 'number', 'me 应带 favoriteCount');
  });

  t.test('[F-04] 无 token 访问 /api/auth/me → 401 + 2001', async () => {
    const res = await api('GET', '/api/auth/me');
    expectStatus(res, 401, 'me 无 token');
    expectFail(res, 2001, 'me 无 token');
  });

  /* ---------------- 鉴权边界：伪造/篡改/过期 ---------------- */
  t.test('[鉴权] 签名错误（用错误密钥伪造）→ 2002', async () => {
    const token = forgeToken('a-wrong-secret-for-qa', {
      sub: state.ids.memberId,
      role: 'member',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const res = await api('GET', '/api/favorites', { token });
    expectStatus(res, 401, '签名错误 token');
    expectFail(res, 2002, '签名错误 token');
  });

  t.test('[鉴权] payload 被篡改（签名不变）→ 2002', async () => {
    const valid = state.memberToken.split('.');
    const payload = JSON.parse(Buffer.from(valid[0], 'base64url').toString('utf8'));
    const tampered = Buffer.from(JSON.stringify({ ...payload, sub: payload.sub + 999 }), 'utf8').toString('base64url');
    const res = await api('GET', '/api/favorites', { token: `${tampered}.${valid[1]}` });
    expectStatus(res, 401, '篡改 token');
    expectFail(res, 2002, '篡改 token');
  });

  t.test('[鉴权] 过期 token（真实密钥签名、exp 已过去）→ 2002', async () => {
    assert.ok(state.secret, '未取到服务端签名密钥，无法构造过期 token');
    const token = forgeToken(state.secret, {
      sub: state.ids.memberId,
      role: 'member',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await api('GET', '/api/favorites', { token });
    expectStatus(res, 401, '过期 token');
    expectFail(res, 2002, '过期 token');
  });

  t.test('[鉴权] 角色不在枚举内（superuser）→ 2002', async () => {
    const token = forgeToken(state.secret, {
      sub: state.ids.memberId,
      role: 'superuser',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const res = await api('GET', '/api/favorites', { token });
    expectFail(res, 2002, '非法角色 token');
  });

  t.test('[鉴权] 签名有效但会员已被删除（sub 不存在）→ 2002', async () => {
    const token = forgeToken(state.secret, {
      sub: 987654,
      role: 'member',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const res = await api('GET', '/api/favorites', { token });
    expectFail(res, 2002, '不存在的会员 sub');
  });

  t.test('[鉴权] 结构非法 token（abc / a.b.c / 空 Bearer）→ 2002 或 2001，不能 500', async () => {
    const cases = [
      { token: 'abc', expect: 2002 },
      { token: 'a.b.c', expect: 2002 },
      { token: 'onlyone.', expect: 2002 },
    ];
    for (const item of cases) {
      const res = await api('GET', '/api/favorites', { token: item.token });
      assert.notEqual(res.status, 500, `token=${item.token} 触发了 500`);
      expectFail(res, item.expect, `token=${item.token}`);
    }
    const empty = await api('GET', '/api/favorites', { headers: { Authorization: 'Bearer ' } });
    assert.notEqual(empty.status, 500, '空 Bearer 触发了 500');
    expectFail(empty, 2001, '空 Bearer');
  });

  /* ---------------- F-11 / F-12 / F-16 收藏 ---------------- */
  t.test('[F-11] 新增收藏 → created:true，景区 favoriteCount +1，详情 isFavorited 变 true', async () => {
    const res = await api('POST', '/api/favorites', { token: S.newMemberToken, body: { scenicId: S.favoriteScenicId } });
    const data = expectOk(res, '新增收藏');
    assert.equal(data.created, true, '首次收藏 created 应为 true');
    assert.equal(data.favorited, true, 'favorited 应为 true');
    assert.equal(
      data.favoriteCount,
      S.favoriteCountBefore + 1,
      `favoriteCount 应从 ${S.favoriteCountBefore} 增到 ${S.favoriteCountBefore + 1}，实际 ${data.favoriteCount}`,
    );

    const detail = expectOk(await api('GET', `/api/scenics/${S.favoriteScenicId}`, { token: S.newMemberToken }), '收藏后景区详情');
    assert.equal(detail.scenic.isFavorited, true, '带 token 访问详情 isFavorited 应为 true');
    const guest = expectOk(await api('GET', `/api/scenics/${S.favoriteScenicId}`), '游客访问景区详情');
    assert.equal(guest.scenic.isFavorited, false, '游客访问详情 isFavorited 必须为 false');
  });

  t.test('[F-11] 重复收藏幂等：created:false 且 total 只加 1', async () => {
    const before = expectOk(await api('GET', '/api/favorites?pageSize=100', { token: S.newMemberToken }), '重复收藏前列表');
    const res = await api('POST', '/api/favorites', { token: S.newMemberToken, body: { scenicId: S.favoriteScenicId } });
    const data = expectOk(res, '重复收藏');
    assert.equal(data.created, false, '重复收藏 created 应为 false');
    assert.equal(data.favorited, true, '重复收藏 favorited 仍应为 true');
    const after = expectOk(await api('GET', '/api/favorites?pageSize=100', { token: S.newMemberToken }), '重复收藏后列表');
    assert.equal(after.total, before.total, `重复收藏不应新增记录：${before.total} → ${after.total}`);
    const occurrences = after.list.filter((item) => item.id === S.favoriteScenicId).length;
    assert.equal(occurrences, 1, `收藏列表出现 ${occurrences} 条同一景区，幂等失效`);
  });

  t.test('[F-16] 收藏列表含景区完整字段 + favoriteId/favoritedAt，total 与 me.favoriteCount 一致', async () => {
    const data = expectOk(await api('GET', '/api/favorites', { token: S.newMemberToken }), '收藏列表');
    for (const field of ['total', 'page', 'pageSize', 'totalPages']) {
      assert.ok(field in data, `收藏列表缺少分页字段 ${field}`);
    }
    assert.equal(data.total, 1, `新会员应只有 1 条收藏，实际 ${data.total}`);
    const item = data.list[0];
    for (const field of ['id', 'name', 'coverImage', 'regionName', 'favoriteId', 'favoritedAt']) {
      assert.ok(field in item, `收藏项缺少景区字段 ${field}`);
    }
    assert.equal(item.id, S.favoriteScenicId, '收藏项景区 id 不符');
    assert.ok(!Number.isNaN(Date.parse(item.favoritedAt)), `favoritedAt 不是合法时间：${item.favoritedAt}`);

    const me = expectOk(await api('GET', '/api/auth/me', { token: S.newMemberToken }), 'me（收藏后）');
    assert.equal(me.member.favoriteCount, data.total, `me.favoriteCount(${me.member.favoriteCount}) 与列表 total(${data.total}) 不一致`);
  });

  t.test('[F-12] 取消收藏 → removed:true、favoriteCount 回落；再取消幂等 removed:false', async () => {
    const first = await api('DELETE', `/api/favorites/${S.favoriteScenicId}`, { token: S.newMemberToken });
    const data1 = expectOk(first, '取消收藏');
    assert.equal(data1.favorited, false, '取消后 favorited 应为 false');
    assert.equal(data1.removed, true, '首次取消 removed 应为 true');
    assert.equal(data1.favoriteCount, S.favoriteCountBefore, `favoriteCount 应回落到 ${S.favoriteCountBefore}，实际 ${data1.favoriteCount}`);

    const second = await api('DELETE', `/api/favorites/${S.favoriteScenicId}`, { token: S.newMemberToken });
    const data2 = expectOk(second, '重复取消收藏');
    assert.equal(data2.favorited, false, '重复取消 favorited 仍为 false');
    assert.equal(data2.removed, false, '重复取消应为幂等 removed:false');

    const list = expectOk(await api('GET', '/api/favorites', { token: S.newMemberToken }), '取消后收藏列表');
    assert.equal(list.total, 0, `取消后应为 0 条，实际 ${list.total}`);
  });

  t.test('[F-11] 非法收藏入参：scenicId 缺失 1001 / 非数字 1001 / 景区不存在 1002', async () => {
    const missing = await api('POST', '/api/favorites', { token: S.newMemberToken, body: {} });
    const d1 = expectFail(missing, 1001, '缺 scenicId');
    assert.ok(d1 && d1.scenicId, '1001 data 应定位 scenicId');

    const bad = await api('POST', '/api/favorites', { token: S.newMemberToken, body: { scenicId: 'abc' } });
    expectFail(bad, 1001, 'scenicId=abc');

    const notFound = await api('POST', '/api/favorites', { token: S.newMemberToken, body: { scenicId: 999999 } });
    expectStatus(notFound, 404, '收藏不存在景区');
    expectFail(notFound, 1002, '收藏不存在景区');
  });

  t.test('[F-11] 收藏接口全部需登录：无 token 的 GET/POST/DELETE 一律 2001', async () => {
    const list = await api('GET', '/api/favorites');
    expectStatus(list, 401, '无 token 收藏列表');
    expectFail(list, 2001, '无 token 收藏列表');

    const add = await api('POST', '/api/favorites', { body: { scenicId: S.favoriteScenicId } });
    expectFail(add, 2001, '无 token 新增收藏');

    const del = await api('DELETE', `/api/favorites/${S.favoriteScenicId}`);
    expectFail(del, 2001, '无 token 取消收藏');
  });

  /* ---------------- F-03 / F-45 ---------------- */
  t.test('[F-03] POST /api/auth/logout 正常返回（无状态 token，服务端不销毁）', async () => {
    const res = await api('POST', '/api/auth/logout', { token: S.newMemberToken });
    expectStatus(res, 200, '会员 logout');
    expectOk(res, '会员 logout');
  });

  t.test('[F-45] 会员登录日志：成功与失败都被记录且可按会员名检索', async () => {
    const data = expectOk(
      await api('GET', `/api/admin/logs/member-logins?keyword=${encodeURIComponent(CREDS.member.username)}&pageSize=100`, {
        token: state.adminToken,
      }),
      '会员登录日志',
    );
    assert.ok(data.total >= 2, `「${CREDS.member.username}」应有成功+失败至少 2 条日志，实际 ${data.total}`);
    assert.ok(
      data.list.some((item) => item.result === 'success'),
      '缺少成功登录日志',
    );
    assert.ok(
      data.list.some((item) => item.result === 'fail'),
      '缺少失败登录日志（PRD F-45 要求失败也记录）',
    );
    const sample = data.list[0];
    for (const field of ['username', 'ip', 'result', 'createdAt']) {
      assert.ok(field in sample, `会员登录日志缺少字段 ${field}`);
    }
  });

  /* ---------------- 越权（核心：断言 code 而非仅状态码） ---------------- */
  t.test('[越权] 会员 token 打后台三接口 → HTTP 403 + code 2004（不是 500/2001）', async () => {
    for (const path of ['/api/admin/members', '/api/admin/regions', '/api/admin/dashboard', '/api/admin/scenics']) {
      const res = await api('GET', path, { token: state.memberToken });
      assert.equal(res.status, 403, `${path}：会员 token 应 403，实际 HTTP ${res.status}`);
      expectFail(res, 2004, `${path} 会员越权`);
    }
  });

  t.test('[越权] 会员 token 尝试后台写操作 → 2004 且数据不被修改', async () => {
    const before = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '地区基线');
    const res = await api('POST', '/api/admin/regions', {
      token: state.memberToken,
      body: { name: `越权地区${S.stamp}`, coverImage: '/images/about.jpg', description: '', sortOrder: 1 },
    });
    expectFail(res, 2004, '会员越权新增地区');
    const after = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '地区基线（复测）');
    assert.equal(after.total, before.total, '越权请求竟然写入了地区数据');
  });

  t.test('[越权] 管理员 token 打会员接口 → HTTP 403 + code 2004', async () => {
    const list = await api('GET', '/api/favorites', { token: state.adminToken });
    assert.equal(list.status, 403, `admin token 访问 /api/favorites 应 403，实际 ${list.status}`);
    expectFail(list, 2004, 'admin 访问收藏');

    const me = await api('GET', '/api/auth/me', { token: state.adminToken });
    assert.equal(me.status, 403, `admin token 访问 /api/auth/me 应 403，实际 ${me.status}`);
    expectFail(me, 2004, 'admin 访问 me');
  });

  t.test('[越权][补充] 会员 token 打三类日志接口 → 403 + code 2004；无 token → 401 + 2001', async () => {
    const logPaths = ['/api/admin/logs/operations', '/api/admin/logs/admins', '/api/admin/logs/member-logins'];
    for (const path of logPaths) {
      const res = await api('GET', path, { token: state.memberToken });
      assert.equal(res.status, 403, `${path}：会员 token 应 HTTP 403，实际 ${res.status}`);
      expectFail(res, 2004, `${path} 会员越权`);
      assert.ok(!res.json.data, `${path}：越权响应不应带出任何日志数据`);
    }
    for (const path of logPaths) {
      const res = await api('GET', path);
      assert.equal(res.status, 401, `${path}：无 token 应 HTTP 401，实际 ${res.status}`);
      expectFail(res, 2001, `${path} 无 token`);
    }
    // 后台写操作类日志接口同样不能只靠状态码兜底
    const write = await api('POST', '/api/admin/regions', {
      token: state.memberToken,
      body: { name: `日志越权${S.stamp}`, coverImage: '/images/about.jpg', description: '', sortOrder: 1 },
    });
    expectFail(write, 2004, '会员越权写地区（顺带确认日志无脏数据）');
  });

  t.test('[越权] 后台无 token 一律 2001（含写操作）', async () => {
    for (const path of ['/api/admin/members', '/api/admin/regions', '/api/admin/logs/operations']) {
      const res = await api('GET', path);
      expectStatus(res, 401, `${path} 无 token`);
      expectFail(res, 2001, `${path} 无 token`);
    }
    const write = await api('DELETE', '/api/admin/regions/1');
    expectFail(write, 2001, '无 token 删除地区');
  });
});
