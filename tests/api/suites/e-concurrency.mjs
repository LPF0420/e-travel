/**
 * E 组：并发与数据一致性。
 *
 * 目的：验证「内存单源 + 串行写队列 + 原子落盘」在并发下不丢写、不重复、不产生半截 JSON。
 * 对应 DESIGN §2 数据层铁律与 §7.5 写队列约定。
 */

import assert from 'node:assert/strict';

import { api, auditDbShape, defineSuite, expectOk, readDb, state } from '../lib/harness.mjs';

const S = {
  stamp: Date.now().toString().slice(-8),
  scenicId: null,
  regionIds: [],
  favoriteBaseline: 0,
};

export default defineSuite('E. 并发与数据一致性', (t) => {
  t.beforeAll(async () => {
    if (!state.memberToken) {
      const login = expectOk(await api('POST', '/api/auth/login', {
        body: { username: '林小满', password: process.env.ETRAVEL_MEMBER_PASSWORD || '123456' },
      }), '会员登录（E 组 beforeAll）');
      state.memberToken = login.token;
    }
    if (!state.adminToken) {
      const login = expectOk(await api('POST', '/api/admin/auth/login', {
        body: { username: 'admin', password: process.env.ETRAVEL_ADMIN_PASSWORD || 'admin123' },
      }), '管理员登录（E 组 beforeAll）');
      state.adminToken = login.token;
    }
    // 找一个当前会员未收藏的景区，保证「并发新增」有确定语义
    const mine = expectOk(await api('GET', '/api/favorites?pageSize=100', { token: state.memberToken }), '收藏基线');
    const favorited = new Set(mine.list.map((item) => item.id));
    const scenics = expectOk(await api('GET', '/api/scenics?pageSize=100'), '景区全量（E 组）');
    const candidate = scenics.list.find((item) => !favorited.has(item.id));
    assert.ok(candidate, '没有可用的未收藏景区，无法做并发收藏用例');
    S.scenicId = candidate.id;
    S.favoriteBaseline = mine.total;
  });

  t.test('[并发] 10 次同时收藏同一景区 → 仅 1 条记录、无 500', async () => {
    const requests = Array.from({ length: 10 }, () =>
      api('POST', '/api/favorites', { token: state.memberToken, body: { scenicId: S.scenicId } }),
    );
    const responses = await Promise.all(requests);

    for (const [index, res] of responses.entries()) {
      assert.equal(res.status, 200, `第 ${index + 1} 个并发收藏返回 HTTP ${res.status}（${res.text.slice(0, 120)}）`);
      assert.equal(res.json && res.json.code, 0, `第 ${index + 1} 个并发收藏 code=${res.json && res.json.code}`);
    }
    const createdCount = responses.filter((res) => res.json.data.created === true).length;
    assert.equal(createdCount, 1, `并发收藏应恰好 1 个 created:true，实际 ${createdCount} 个`);

    const list = expectOk(await api('GET', '/api/favorites?pageSize=100', { token: state.memberToken }), '并发后收藏列表');
    const occurrences = list.list.filter((item) => item.id === S.scenicId).length;
    assert.equal(occurrences, 1, `收藏列表出现 ${occurrences} 条同一景区，唯一约束失效`);
    assert.equal(list.total, S.favoriteBaseline + 1, `收藏总数应只 +1，实际 ${S.favoriteBaseline} → ${list.total}`);

    const db = readDb();
    const memberId = state.ids.memberId || 1;
    const duplicates = db.favorites.filter((item) => item.memberId === memberId && item.scenicId === S.scenicId).length;
    assert.equal(duplicates, 1, `db.json 中同一 (memberId, scenicId) 出现 ${duplicates} 条`);
  });

  t.test('[并发] 5 次同时取消收藏 → 全部成功、仅 1 次 removed:true', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => api('DELETE', `/api/favorites/${S.scenicId}`, { token: state.memberToken })),
    );
    for (const [index, res] of responses.entries()) {
      assert.equal(res.json && res.json.code, 0, `第 ${index + 1} 个并发取消 code=${res.json && res.json.code}`);
      assert.equal(res.json.data.favorited, false, '取消后 favorited 应为 false');
    }
    const removedCount = responses.filter((res) => res.json.data.removed === true).length;
    assert.equal(removedCount, 1, `并发取消应恰好 1 次 removed:true，实际 ${removedCount} 次`);
  });

  t.test('[并发] 8 次同时新增地区 → 全部落盘、id 唯一、db.json 仍可解析', async () => {
    const before = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '地区基线');
    const names = Array.from({ length: 8 }, (_, i) => `并发区${S.stamp}${i}`);
    const responses = await Promise.all(
      names.map((name) =>
        api('POST', '/api/admin/regions', {
          token: state.adminToken,
          body: { name, coverImage: '/images/about.jpg', description: '并发验收', sortOrder: 1 },
        }),
      ),
    );

    for (const [index, res] of responses.entries()) {
      assert.equal(res.status, 201, `第 ${index + 1} 个并发新增返回 HTTP ${res.status}（${res.text.slice(0, 140)}）`);
      assert.equal(res.json && res.json.code, 0, `第 ${index + 1} 个并发新增 code=${res.json && res.json.code}`);
      S.regionIds.push(res.json.data.region.id);
    }
    const uniqueIds = new Set(S.regionIds);
    assert.equal(uniqueIds.size, 8, `8 次并发新增的 id 不唯一：${S.regionIds.join(',')}`);

    const after = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '地区复测');
    assert.equal(after.total, before.total + 8, `地区总数应 +8，实际 ${before.total} → ${after.total}`);

    const searched = expectOk(
      await api('GET', `/api/admin/regions?keyword=${encodeURIComponent(`并发区${S.stamp}`)}&pageSize=100`, { token: state.adminToken }),
      '并发地区检索',
    );
    assert.equal(searched.total, 8, `并发新建的地区应全部可查，实际 ${searched.total}`);

    // 落盘文件必须仍是完整 JSON（半截 JSON 会让下次启动丢全库）
    const db = readDb();
    const persisted = db.regions.filter((item) => S.regionIds.includes(item.id));
    assert.equal(persisted.length, 8, `db.json 只落盘了 ${persisted.length}/8 条并发新增地区`);
  });

  t.test('[一致性] db.json 结构自洽：集合无重复 id、计数器 ≥ 最大 id', async () => {
    const db = readDb();
    const problems = auditDbShape(db);
    assert.deepEqual(problems, [], `db.json 结构问题：${problems.join('；')}`);
  });

  t.test('[并发] 读写混合（5 个查询 + 3 个写入）不互相干扰、无 500', async () => {
    const reads = Array.from({ length: 5 }, () => api('GET', '/api/scenics?pageSize=100'));
    const writes = Array.from({ length: 3 }, (_, i) =>
      api('POST', '/api/admin/regions', {
        token: state.adminToken,
        body: { name: `混合区${S.stamp}${i}`, coverImage: '/images/about.jpg', description: '读写混合', sortOrder: 1 },
      }),
    );
    const results = await Promise.all([...reads, ...writes]);
    for (const [index, res] of results.entries()) {
      assert.equal(res.json && res.json.code, 0, `第 ${index + 1} 个混合请求 code=${res.json && res.json.code}（HTTP ${res.status}）`);
    }
    for (const res of results.slice(5)) {
      S.regionIds.push(res.json.data.region.id);
    }
    const db = readDb();
    const problems = auditDbShape(db);
    assert.deepEqual(problems, [], `混合并发后 db.json 结构问题：${problems.join('；')}`);
  });

  t.test('[清理] 并发新建的地区可正常删除，删完总数回到基线', async () => {
    const baseline = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '删除前基线');
    const responses = await Promise.all(
      S.regionIds.map((id) => api('DELETE', `/api/admin/regions/${id}`, { token: state.adminToken })),
    );
    for (const [index, res] of responses.entries()) {
      assert.equal(res.json && res.json.code, 0, `删除地区 ${S.regionIds[index]} 失败：${res.json && res.json.message}`);
    }
    const after = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '删除后基线');
    assert.equal(after.total, baseline.total - S.regionIds.length, `删除后总数不符：${baseline.total} → ${after.total}`);
    S.regionIds = [];
  });

  t.test('[一致性] 结算：db.json 可 JSON.parse 且集合数量与 API total 一致', async () => {
    const db = readDb();
    const regions = expectOk(await api('GET', '/api/admin/regions?pageSize=1', { token: state.adminToken }), '地区 total');
    const scenics = expectOk(await api('GET', '/api/scenics?pageSize=1'), '景区 total');
    const travels = expectOk(await api('GET', '/api/travels?pageSize=1'), '游记 total');
    const stats = expectOk(await api('GET', '/api/stats/public'), 'stats');
    assert.equal(regions.total, db.regions.length, `地区：API ${regions.total} vs 文件 ${db.regions.length}`);
    assert.equal(scenics.total, db.scenics.length, `景区：API ${scenics.total} vs 文件 ${db.scenics.length}`);
    assert.equal(travels.total, db.travels.length, `游记：API ${travels.total} vs 文件 ${db.travels.length}`);
    assert.equal(stats.regionCount, db.regions.length, 'stats.regionCount 与文件不一致');
    assert.equal(stats.scenicCount, db.scenics.length, 'stats.scenicCount 与文件不一致');
    assert.equal(stats.travelCount, db.travels.length, 'stats.travelCount 与文件不一致');
  });
});
