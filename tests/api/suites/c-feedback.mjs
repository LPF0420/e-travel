/**
 * C 组：意见反馈（F-19）。
 *
 * 口径：DESIGN §3.2 #15（可选会员）、§3.4；PRD F-19（三项必填、内容 5–300 字、后台可见、不做审核）。
 */

import assert from 'node:assert/strict';

import { api, defineSuite, expectFail, expectOk, expectStatus, state } from '../lib/harness.mjs';

const S = {
  stamp: Date.now().toString().slice(-8),
  feedbackId: null,
  content: '',
};

export default defineSuite('C. 意见反馈', (t) => {
  t.beforeAll(async () => {
    if (!state.adminToken) {
      const login = expectOk(await api('POST', '/api/admin/auth/login', {
        body: { username: 'admin', password: process.env.ETRAVEL_ADMIN_PASSWORD || 'admin123' },
      }), '管理员登录（C 组 beforeAll）');
      state.adminToken = login.token;
    }
  });

  t.test('[F-19] 游客（无 token）可提交反馈 → 201 且返回 id/createdAt', async () => {
    S.content = `验收留言-游客${S.stamp}：页面加载很快，希望增加行程规划功能。`;
    const res = await api('POST', '/api/feedbacks', {
      body: { nickname: `游客${S.stamp}`, contact: '13800001111', content: S.content },
    });
    expectStatus(res, 201, '游客提交反馈');
    const data = expectOk(res, '游客提交反馈');
    assert.ok(Number.isInteger(data.id) && data.id > 0, `返回 id 非法：${data.id}`);
    assert.ok(!Number.isNaN(Date.parse(data.createdAt)), `createdAt 非法：${data.createdAt}`);
    S.feedbackId = data.id;
    state.ids.feedbackId = data.id;
  });

  t.test('[F-19] 内容少于 5 字 → 1001 且 data.content 命中', async () => {
    const res = await api('POST', '/api/feedbacks', {
      body: { nickname: `游客${S.stamp}`, contact: '13800001111', content: '太短' },
    });
    expectStatus(res, 400, '内容过短');
    const data = expectFail(res, 1001, '内容过短');
    assert.ok(data && data.content, `1001 data 应含 content，实际 ${JSON.stringify(data)}`);
  });

  t.test('[F-19] 内容超过 300 字 → 1001', async () => {
    const res = await api('POST', '/api/feedbacks', {
      body: { nickname: `游客${S.stamp}`, contact: '13800001111', content: '长'.repeat(301) },
    });
    const data = expectFail(res, 1001, '内容过长');
    assert.ok(data && data.content, '1001 data 应含 content');
  });

  t.test('[F-19] 三项必填缺失 → 1001 一次性返回 nickname/contact/content', async () => {
    const data = expectFail(await api('POST', '/api/feedbacks', { body: {} }), 1001, '空反馈');
    for (const field of ['nickname', 'contact', 'content']) {
      assert.ok(data && data[field], `1001 data 缺少 ${field}，实际 ${JSON.stringify(data)}`);
    }
  });

  t.test('[F-19] 昵称超长（21 字）→ 1001', async () => {
    const res = await api('POST', '/api/feedbacks', {
      body: { nickname: '昵'.repeat(21), contact: '13800001111', content: '这是一条足够长的留言内容。' },
    });
    const data = expectFail(res, 1001, '昵称超长');
    assert.ok(data && data.nickname, '1001 data 应含 nickname');
  });

  t.test('[F-19] 带无效 token 提交按游客处理（不 500、不 2002）', async () => {
    const res = await api('POST', '/api/feedbacks', {
      token: 'garbage.token',
      body: { nickname: `游客b${S.stamp}`, contact: 'someone@example.com', content: '带着坏 token 提交的留言，应被当游客处理。' },
    });
    assert.notEqual(res.status, 500, '坏 token 提交反馈触发了 500');
    expectStatus(res, 201, '坏 token 提交反馈');
    expectOk(res, '坏 token 提交反馈');
  });

  t.test('[F-19] 后台意见建议列表可查到该条（10 秒内可见假设成立）', async () => {
    const data = expectOk(await api('GET', '/api/admin/feedbacks?pageSize=100', { token: state.adminToken }), '后台反馈列表');
    const found = data.list.find((item) => item.id === S.feedbackId);
    assert.ok(found, `后台列表未查到刚提交的反馈 id=${S.feedbackId}（共 ${data.total} 条）`);
    assert.equal(found.status, 'pending', `新反馈初始状态应为 pending，实际 ${found.status}`);
    assert.equal(found.content, S.content, '后台看到的留言内容与提交内容不一致');
    assert.equal(found.memberId, null, '游客提交的反馈 memberId 应为 null');
    assert.ok(typeof data.pendingCount === 'number' && data.pendingCount >= 1, 'pendingCount 应 ≥1');
  });

  t.test('[F-19] 按键值搜索与状态过滤：status=pending 全部为 pending；status=非法 → 1001', async () => {
    const pending = expectOk(await api('GET', '/api/admin/feedbacks?status=pending&pageSize=100', { token: state.adminToken }), 'pending 过滤');
    for (const item of pending.list) {
      assert.equal(item.status, 'pending', `status=pending 结果混入 ${item.status}`);
    }
    assert.equal(pending.pendingCount, pending.total, `status=pending 时 total(${pending.total}) 应等于 pendingCount(${pending.pendingCount})`);
    const bad = await api('GET', '/api/admin/feedbacks?status=unknown', { token: state.adminToken });
    expectFail(bad, 1001, 'status 非法');
  });
});
