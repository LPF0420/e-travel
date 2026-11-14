/**
 * A 组：公开接口（F-05 / F-06 / F-09 / F-10 / F-13 / F-14 / F-15 / F-17）+ 异常路径。
 *
 * 口径：docs/DESIGN.md §3.2（C 端 16 个接口）+ §3.4 错误码表；验收标准取自 docs/PRD.md 第四章。
 * 只读为主，本组不创建任何数据（除登录无关操作），保证后续组的基线干净。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { PATHS, api, defineSuite, expectFail, expectOk, expectSorted, expectStatus, state } from '../lib/harness.mjs';

export default defineSuite('A. 公开接口 + 异常路径', (t) => {
  /* ---------------- 基线：先量出种子数据规模，后续断言不写死数字 ---------------- */
  t.beforeAll(async () => {
    const all = expectOk(await api('GET', '/api/scenics?pageSize=100'), '基线 景区全量');
    const travels = expectOk(await api('GET', '/api/travels?pageSize=100'), '基线 游记全量');
    const regions = expectOk(await api('GET', '/api/regions'), '基线 地区全量');
    state.totals.scenic = all.total;
    state.totals.travel = travels.total;
    state.totals.region = regions.total;
    state.totals.recommended = all.list.filter((item) => item.isRecommended).length;
  });

  /* ---------------- F-05 首页推荐景区 ---------------- */
  t.test('[F-05] GET /api/scenics?isRecommended=true&limit=6 返回 6 条且全部为推荐', async () => {
    const data = expectOk(await api('GET', '/api/scenics?isRecommended=true&limit=6'), '推荐景区 limit=6');
    assert.equal(data.list.length, 6, `期望 6 条推荐景区，实际 ${data.list.length} 条（种子推荐数=${state.totals.recommended}）`);
    assert.equal(data.total, state.totals.recommended, `total 应等于推荐景区总数 ${state.totals.recommended}`);
    for (const item of data.list) {
      assert.equal(item.isRecommended, true, `推荐列表混入非推荐景区：${item.name}`);
    }
  });

  t.test('[F-05] limit 生效且 total/pagination 字段完整（limit=3）', async () => {
    const data = expectOk(await api('GET', '/api/scenics?isRecommended=true&limit=3'), '推荐景区 limit=3');
    assert.equal(data.list.length, 3, `期望 3 条，实际 ${data.list.length}`);
    assert.equal(data.page, 1, `limit 模式页码应固定为 1，实际 ${data.page}`);
    assert.equal(data.pageSize, 3, `limit 应回写为 pageSize=3，实际 ${data.pageSize}`);
    assert.equal(data.total, state.totals.recommended, 'limit 不应改变 total');
  });

  t.test('[F-05] 非推荐过滤 isRecommended=false 只返回非推荐景区', async () => {
    const data = expectOk(await api('GET', '/api/scenics?isRecommended=false&pageSize=100'), '非推荐景区');
    assert.equal(data.total, state.totals.scenic - state.totals.recommended, '与「全量 - 推荐数」不符');
    for (const item of data.list) {
      assert.notEqual(item.isRecommended, true, `非推荐列表混入推荐景区：${item.name}`);
    }
  });

  /* ---------------- F-09 分页 ---------------- */
  t.test('[F-09] 分页数学正确：page/pageSize/total/totalPages 自洽', async () => {
    const p1 = expectOk(await api('GET', '/api/scenics?page=1&pageSize=3'), '分页 第1页');
    const expectedPages = Math.max(1, Math.ceil(state.totals.scenic / 3));
    assert.equal(p1.total, state.totals.scenic, `total 应为 ${state.totals.scenic}，实际 ${p1.total}`);
    assert.equal(p1.pageSize, 3, `pageSize 应为 3，实际 ${p1.pageSize}`);
    assert.equal(p1.page, 1, `page 应为 1，实际 ${p1.page}`);
    assert.equal(p1.totalPages, expectedPages, `totalPages 应为 ${expectedPages}，实际 ${p1.totalPages}`);
    assert.equal(p1.list.length, Math.min(3, state.totals.scenic), `首页条数不符，实际 ${p1.list.length}`);

    const p2 = expectOk(await api('GET', `/api/scenics?page=2&pageSize=3`), '分页 第2页');
    assert.equal(p2.page, 2, `page 应为 2，实际 ${p2.page}`);
    assert.equal(p2.total, p1.total, '翻页不应改变 total');
    assert.notEqual(p2.list[0] && p2.list[0].id, p1.list[0] && p1.list[0].id, '第 2 页首项与第 1 页首项重复，分页未真正偏移');
  });

  t.test('[F-09] 兜底：pageSize=999 被夹到上限 100，pageSize=abc 回落默认 9', async () => {
    const big = expectOk(await api('GET', '/api/scenics?pageSize=999'), 'pageSize=999');
    assert.equal(big.pageSize, 100, `pageSize 上限应为 100，实际 ${big.pageSize}`);
    assert.equal(big.list.length, state.totals.scenic, '上限钳制后应返回全部景区');

    const bad = expectOk(await api('GET', '/api/scenics?pageSize=abc'), 'pageSize=abc');
    assert.equal(bad.pageSize, 9, `pageSize=abc 应回落默认 9，实际 ${bad.pageSize}`);
  });

  t.test('[F-09] 兜底：page=0 / page=-3 / page=abc 一律钳到第 1 页', async () => {
    const baseline = expectOk(await api('GET', '/api/scenics?page=1&pageSize=3'), 'page=1 基线');
    for (const raw of ['0', '-3', 'abc']) {
      const data = expectOk(await api('GET', `/api/scenics?page=${raw}&pageSize=3`), `page=${raw}`);
      assert.equal(data.page, 1, `page=${raw} 应钳到 1，实际 ${data.page}`);
      assert.deepEqual(
        data.list.map((item) => item.id),
        baseline.list.map((item) => item.id),
        `page=${raw} 的首屏内容应与 page=1 一致`,
      );
    }
  });

  t.test('[F-09] 超界页码返回空列表但 total/totalPages 不变', async () => {
    const data = expectOk(await api('GET', '/api/scenics?page=999&pageSize=3'), 'page=999');
    assert.equal(data.list.length, 0, `超界页应返回空 list，实际 ${data.list.length} 条`);
    assert.equal(data.total, state.totals.scenic, '超界页不应影响 total');
    assert.equal(data.totalPages, Math.max(1, Math.ceil(state.totals.scenic / 3)), '超界页不应影响 totalPages');
  });

  /* ---------------- F-09 关键词 / 地区筛选 ---------------- */
  t.test('[F-09] keyword=九寨 命中且结果与关键词相关', async () => {
    const data = expectOk(await api('GET', '/api/scenics?keyword=九寨&pageSize=100'), 'keyword=九寨');
    assert.ok(data.total >= 1, `keyword=九寨 应有命中，实际 total=${data.total}`);
    const hit = data.list.some((item) => {
      const haystack = `${item.name} ${item.description || ''} ${(item.highlights || []).join(' ')}`;
      return haystack.includes('九寨');
    });
    assert.ok(hit, `命中项中没有一条文本包含「九寨」：${data.list.map((item) => item.name).join(',')}`);
  });

  t.test('[F-09] keyword 无命中时 total=0、list 为空且 totalPages 兜底为 1', async () => {
    const data = expectOk(await api('GET', '/api/scenics?keyword=不存在的景区xyz'), 'keyword 无命中');
    assert.equal(data.total, 0, `应 0 条，实际 ${data.total}`);
    assert.deepEqual(data.list, [], '应返回空数组');
    assert.equal(data.totalPages, 1, `空结果 totalPages 兜底应为 1，实际 ${data.totalPages}`);
  });

  t.test('[F-09] keyword 含特殊字符（SQL/引号/尖括号）不 500 也不返回 HTML', async () => {
    // 用 String.fromCharCode(92) 生成反斜杠，避免源码里出现转义序列
    const cases = ["' OR 1=1 --", '%27%22%3E%3Cscript%3E"', `九寨${String.fromCharCode(92)}`, '????', '<img src=x onerror=alert(1)>'];
    for (const raw of cases) {
      const res = await api('GET', `/api/scenics?keyword=${encodeURIComponent(raw)}`);
      assert.equal(res.status, 200, `keyword=${raw} 期望 HTTP 200，实际 ${res.status}`);
      assert.ok(res.json !== null, `keyword=${raw} 响应应为 JSON，实际 content-type=${res.contentType}`);
      assert.equal(res.json.code, 0, `keyword=${raw} 期望 code=0，实际 ${res.json.code}`);
      assert.ok(!res.text.trimStart().startsWith('<'), `keyword=${raw} 返回了 HTML，说明掉进了 SPA 回落`);
    }
  });

  t.test('[F-09] keyword 超长（500 字符 / 20000 字符）不 500 也不返回 HTML', async () => {
    // 500 字符仍在 Node 默认 16KB 请求头上限内 → 必须正常返回 200
    const long = '九'.repeat(500);
    const res = await api('GET', `/api/scenics?keyword=${encodeURIComponent(long)}`);
    assert.equal(res.status, 200, `500 字符 keyword 期望 200，实际 ${res.status}`);
    assert.equal(res.json && res.json.code, 0, `500 字符 keyword 期望 code=0，实际 ${res.json && res.json.code}`);

    // 20000 字符会超出 Node 默认 maxHeaderSize，由 http 层直接 431（应用层看不到），关键是不能 500
    const huge = await api('GET', `/api/scenics?keyword=${'a'.repeat(20000)}`);
    assert.notEqual(huge.status, 500, '超长 URL 不应返回 500');
    assert.ok([200, 414, 431].includes(huge.status), `超长 URL 期望 200/414/431，实际 ${huge.status}`);
  });

  t.test('[F-09] regionId 过滤：结果全属该地区，与地区详情下的景区数一致', async () => {
    const filtered = expectOk(await api('GET', '/api/scenics?regionId=1&pageSize=100'), 'regionId=1');
    assert.ok(filtered.total >= 1, `regionId=1 应有景区，实际 ${filtered.total}`);
    for (const item of filtered.list) {
      assert.equal(item.regionId, 1, `${item.name} 的 regionId=${item.regionId}，不该出现在 regionId=1 的结果里`);
    }
    const detail = expectOk(await api('GET', '/api/regions/1'), '地区 1 详情');
    assert.equal(
      filtered.total,
      detail.region.scenicCount,
      `列表 total(${filtered.total}) 与地区 scenicCount(${detail.region.scenicCount}) 不一致`,
    );
    assert.equal(detail.scenics.length, detail.region.scenicCount, '地区详情 scenics 长度与 scenicCount 不一致');
  });

  t.test('[F-09] regionId=9999（不存在）返回空列表；regionId=abc 返回 1001', async () => {
    const empty = expectOk(await api('GET', '/api/scenics?regionId=9999'), 'regionId=9999');
    assert.equal(empty.total, 0, `不存在的地区应 0 条，实际 ${empty.total}`);
    const bad = await api('GET', '/api/scenics?regionId=abc');
    expectFail(bad, 1001, 'regionId=abc');
    assert.ok(bad.json.data && bad.json.data.regionId, '1001 的 data 应能定位到 regionId 字段');
  });

  /* ---------------- F-47 排序（相邻项真比较，不只看首项） ---------------- */
  t.test('[F-47] sort=default 按 id 倒序', async () => {
    const data = expectOk(await api('GET', '/api/scenics?sort=default&pageSize=100'), 'sort=default');
    expectSorted(data.list, (a, b) => b.id - a.id, 'sort=default');
  });

  t.test('[F-47] sort=latest 按 createdAt 倒序（同刻回落 id 倒序）', async () => {
    const data = expectOk(await api('GET', '/api/scenics?sort=latest&pageSize=100'), 'sort=latest');
    expectSorted(
      data.list,
      (a, b) => {
        const left = Date.parse(a.createdAt || '') || 0;
        const right = Date.parse(b.createdAt || '') || 0;
        return right - left || b.id - a.id;
      },
      'sort=latest',
    );
  });

  t.test('[F-47] sort=popular 按 favoriteCount 倒序', async () => {
    const data = expectOk(await api('GET', '/api/scenics?sort=popular&pageSize=100'), 'sort=popular');
    for (const item of data.list) {
      assert.equal(typeof item.favoriteCount, 'number', `${item.name} 缺少 favoriteCount，popular 排序会取到 undefined`);
    }
    expectSorted(data.list, (a, b) => b.favoriteCount - a.favoriteCount || b.id - a.id, 'sort=popular');
  });

  t.test('[F-47] sort=recommend 推荐项聚在前缀且段内按 updatedAt 倒序', async () => {
    const data = expectOk(await api('GET', '/api/scenics?sort=recommend&pageSize=100'), 'sort=recommend');
    const flags = data.list.map((item) => item.isRecommended === true);
    const firstNonRecommended = flags.indexOf(false);
    const recommendedBlock = firstNonRecommended === -1 ? flags.length : firstNonRecommended;
    for (let i = 0; i < recommendedBlock; i += 1) {
      assert.ok(flags[i], `第 ${i + 1} 项不是推荐景区，推荐项未聚在前缀`);
    }
    for (let i = recommendedBlock; i < flags.length; i += 1) {
      assert.ok(!flags[i], `第 ${i + 1} 项是推荐景区，却排在非推荐区之后`);
    }
    const prefix = data.list.slice(0, recommendedBlock);
    expectSorted(
      prefix,
      (a, b) => {
        const left = Date.parse(a.updatedAt || '') || 0;
        const right = Date.parse(b.updatedAt || '') || 0;
        return right - left || b.id - a.id;
      },
      'sort=recommend 推荐段',
    );
  });

  t.test('[F-47] 非法 sort（rating/乱写）返回 1001 并定位字段', async () => {
    for (const bad of ['rating', 'favorites', 'drop-table']) {
      const res = await api('GET', `/api/scenics?sort=${bad}`);
      expectFail(res, 1001, `sort=${bad}`);
      assert.ok(res.json.data && res.json.data.sort, `sort=${bad} 的 1001 data 应含 sort 字段`);
    }
  });

  /* ---------------- F-10 景区详情 ---------------- */
  t.test('[F-10] GET /api/scenics/1 返回 scenic + region 且派生字段齐全', async () => {
    const data = expectOk(await api('GET', '/api/scenics/1'), '景区 1 详情');
    assert.equal(data.scenic.id, 1, `scenic.id 应为 1，实际 ${data.scenic.id}`);
    assert.ok(data.region && data.region.id === data.scenic.regionId, 'region 应与 scenic.regionId 对应');
    assert.equal(typeof data.scenic.regionName, 'string', 'scenic 缺少 regionName');
    assert.equal(typeof data.scenic.favoriteCount, 'number', 'scenic 缺少 favoriteCount');
    assert.equal(typeof data.scenic.travelCount, 'number', 'scenic 缺少 travelCount');
    assert.equal(typeof data.scenic.isFavorited, 'boolean', '游客访问时 isFavorited 应为 false 而不是缺失');
    assert.equal(data.scenic.isFavorited, false, '无 token 时 isFavorited 必须为 false');
    for (const field of ['adminName', 'passwordHash']) {
      assert.ok(!(field in data.scenic), `景区详情泄露了 ${field}`);
    }
  });

  t.test('[F-10] 不存在的景区 id → HTTP 404 且 code=1002', async () => {
    const res = await api('GET', '/api/scenics/999999');
    expectStatus(res, 404, '景区 999999');
    expectFail(res, 1002, '景区 999999');
  });

  t.test('[F-10] 非法景区 id（abc / 0 / -1）一律 1002 而非 500', async () => {
    for (const raw of ['abc', '0', '-1', '1.5']) {
      const res = await api('GET', `/api/scenics/${raw}`);
      assert.equal(res.status, 404, `id=${raw} 期望 404，实际 ${res.status}`);
      expectFail(res, 1002, `id=${raw}`);
    }
  });

  /* ---------------- F-13 景区关联游记 ---------------- */
  t.test('[F-13] GET /api/scenics/1/travels 返回本景区游记、publishedAt 倒序、默认最多 5 条', async () => {
    const data = expectOk(await api('GET', '/api/scenics/1/travels'), '景区 1 游记');
    assert.ok(Array.isArray(data.list), 'list 应为数组');
    assert.equal(typeof data.total, 'number', 'total 应为数字');
    assert.ok(data.list.length <= 5, `默认最多 5 条，实际 ${data.list.length}`);
    for (const item of data.list) {
      assert.equal(item.scenicId, 1, `游记 ${item.id} 不属于景区 1`);
    }
    expectSorted(data.list, (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0), '景区游记');
  });

  t.test('[F-13] 景区游记 limit 生效；不存在景区 → 1002', async () => {
    const limited = expectOk(await api('GET', '/api/scenics/1/travels?limit=1'), '景区 1 游记 limit=1');
    assert.ok(limited.list.length <= 1, `limit=1 时最多 1 条，实际 ${limited.list.length}`);
    const missing = await api('GET', '/api/scenics/999999/travels');
    expectStatus(missing, 404, '不存在景区的游记');
    expectFail(missing, 1002, '不存在景区的游记');
  });

  /* ---------------- F-06 地区列表 ---------------- */
  t.test('[F-06] GET /api/regions 按 sortOrder 倒序且 scenicCount 与实际一致', async () => {
    const data = expectOk(await api('GET', '/api/regions'), '地区列表');
    assert.equal(data.total, state.totals.region, `地区数应为 ${state.totals.region}，实际 ${data.total}`);
    expectSorted(data.list, (a, b) => (b.sortOrder || 0) - (a.sortOrder || 0) || a.id - b.id, '地区列表');
    for (const region of data.list) {
      const detail = expectOk(await api('GET', `/api/regions/${region.id}`), `地区 ${region.id} 详情`);
      assert.equal(
        region.scenicCount,
        detail.scenics.length,
        `地区「${region.name}」scenicCount=${region.scenicCount} 与实际景区数 ${detail.scenics.length} 不一致`,
      );
    }
  });

  t.test('[F-06] GET /api/regions?limit=6 与不带 limit 的前 6 项（顺序）一致', async () => {
    const all = expectOk(await api('GET', '/api/regions'), '地区全量');
    const six = expectOk(await api('GET', '/api/regions?limit=6'), '地区 limit=6');
    assert.equal(six.list.length, Math.min(6, all.total), `应返回 ${Math.min(6, all.total)} 条，实际 ${six.list.length}`);
    assert.deepEqual(
      six.list.map((item) => item.id),
      all.list.slice(0, 6).map((item) => item.id),
      'limit=6 的顺序与全量前 6 不一致',
    );
    assert.equal(six.total, all.total, 'limit 不应改变 total');
  });

  t.test('[F-10] GET /api/regions/1 返回 region + 精简景区列表；不存在 → 1002', async () => {
    const data = expectOk(await api('GET', '/api/regions/1'), '地区 1 详情');
    assert.ok(Array.isArray(data.scenics), 'scenics 应为数组');
    for (const scenic of data.scenics) {
      assert.equal(scenic.regionId, 1, `景区 ${scenic.id} 不属于地区 1`);
      assert.equal(typeof scenic.name, 'string', '精简景区缺少 name');
      assert.equal(typeof scenic.coverImage, 'string', '精简景区缺少 coverImage');
    }
    const missing = await api('GET', '/api/regions/999999');
    expectStatus(missing, 404, '地区 999999');
    expectFail(missing, 1002, '地区 999999');
  });

  /* ---------------- F-14 / F-15 游记 ---------------- */
  t.test('[F-14] GET /api/travels 默认 pageSize=6、publishedAt 倒序、含 scenicName', async () => {
    const data = expectOk(await api('GET', '/api/travels'), '游记列表');
    assert.equal(data.pageSize, 6, `游记默认 pageSize 应为 6，实际 ${data.pageSize}`);
    assert.equal(data.total, state.totals.travel, `total 应为 ${state.totals.travel}，实际 ${data.total}`);
    assert.ok(data.list.length <= 6, `首页最多 6 条，实际 ${data.list.length}`);
    expectSorted(data.list, (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0), '游记列表');
    for (const item of data.list) {
      assert.equal(typeof item.scenicName, 'string', `游记 ${item.id} 缺少 scenicName`);
      assert.ok(item.scenicName.length > 0, `游记 ${item.id} 的 scenicName 为空`);
    }
  });

  t.test('[F-14] ?scenicId=1 只返回该景区游记；scenicId=abc → 1001', async () => {
    const data = expectOk(await api('GET', '/api/travels?scenicId=1&pageSize=100'), '游记 scenicId=1');
    for (const item of data.list) {
      assert.equal(item.scenicId, 1, `游记 ${item.id} 不属于景区 1`);
    }
    const bad = await api('GET', '/api/travels?scenicId=abc');
    expectFail(bad, 1001, 'travels scenicId=abc');
    assert.ok(bad.json.data && bad.json.data.scenicId, '1001 的 data 应定位到 scenicId');
  });

  t.test('[F-15] GET /api/travels/1 返回 travel + scenic + related（≤3 且不含自身）', async () => {
    const data = expectOk(await api('GET', '/api/travels/1'), '游记 1 详情');
    assert.equal(data.travel.id, 1, `travel.id 应为 1，实际 ${data.travel.id}`);
    assert.ok(data.scenic && typeof data.scenic.name === 'string', 'scenic 应存在且含 name');
    assert.ok(Array.isArray(data.related), 'related 应为数组');
    assert.ok(data.related.length <= 3, `related 最多 3 篇，实际 ${data.related.length}`);
    for (const item of data.related) {
      assert.notEqual(item.id, data.travel.id, 'related 不应包含自身');
    }
  });

  t.test('[F-15] 不存在的游记 id → 1002', async () => {
    const res = await api('GET', '/api/travels/999999');
    expectStatus(res, 404, '游记 999999');
    expectFail(res, 1002, '游记 999999');
  });

  /* ---------------- F-17 公开统计 ---------------- */
  t.test('[F-17] GET /api/stats/public 与三个列表 total 完全一致', async () => {
    const stats = expectOk(await api('GET', '/api/stats/public'), 'stats/public');
    const scenics = expectOk(await api('GET', '/api/scenics?pageSize=1'), 'scenics total');
    const travels = expectOk(await api('GET', '/api/travels?pageSize=1'), 'travels total');
    const regions = expectOk(await api('GET', '/api/regions'), 'regions total');
    assert.equal(stats.regionCount, regions.total, `regionCount=${stats.regionCount}，列表 total=${regions.total}`);
    assert.equal(stats.scenicCount, scenics.total, `scenicCount=${stats.scenicCount}，列表 total=${scenics.total}`);
    assert.equal(stats.travelCount, travels.total, `travelCount=${stats.travelCount}，列表 total=${travels.total}`);
  });

  /* ---------------- 异常路径 ---------------- */
  t.test('[异常] /api/not-exist 返回 JSON 1002，不是 HTML', async () => {
    const res = await api('GET', '/api/not-exist');
    expectStatus(res, 404, '/api/not-exist');
    assert.ok(res.contentType.includes('application/json'), `Content-Type 应为 JSON，实际 ${res.contentType}`);
    expectFail(res, 1002, '/api/not-exist');
  });

  t.test('[异常] /api/admin/not-exist 返回 JSON 1002（不掉进前台通配/SPA）', async () => {
    const res = await api('GET', '/api/admin/not-exist');
    assert.ok(res.contentType.includes('application/json'), `Content-Type 应为 JSON，实际 ${res.contentType}`);
    expectFail(res, 1002, '/api/admin/not-exist');
  });

  t.test('[异常] 非 /api 路径模式自适应：已构建→SPA 回落 index.html；未构建→JSON 1002', async () => {
    // 行为随 dist/ 是否存在而变（server/index.js:48-60），断言必须自适应，否则构建产物一出现就假红。
    const hasDist = fs.existsSync(path.join(PATHS.root, 'dist', 'index.html'));
    const page = await api('GET', '/some-random-page');
    if (hasDist) {
      expectStatus(page, 200, '/some-random-page（dist 已构建）');
      assert.ok(
        page.contentType.includes('text/html'),
        `已构建时应回落到 index.html（text/html），实际 ${page.contentType}`,
      );
      assert.ok(
        page.text.includes('id="root"'),
        'SPA 回落内容不像 index.html：未找到 <div id="root"> 挂载点',
      );
    } else {
      assert.ok(
        page.contentType.includes('application/json'),
        `未构建时应返回 JSON 1002，实际 ${page.contentType}`,
      );
      expectFail(page, 1002, '/some-random-page（未构建）');
    }

    // 无论是否构建，/api/* 都绝不能掉进 SPA 回落（前端 res.json() 会抛 SyntaxError）
    const apiMiss = await api('GET', '/api/not-exist');
    expectStatus(apiMiss, 404, '/api/not-exist（构建前后一致）');
    assert.ok(
      apiMiss.contentType.includes('application/json'),
      `/api 未命中必须返回 JSON，实际 ${apiMiss.contentType}`,
    );
    expectFail(apiMiss, 1002, '/api/not-exist（构建前后一致）');
  });

  /* ---------------- 静态图片资产（F-05/F-10/F-31 破图回归） ---------------- */
  t.test('[资产] /images/jiuzhaigou.jpg 可访问且 Content-Type=image/jpeg', async () => {
    const res = await api('GET', '/images/jiuzhaigou.jpg');
    expectStatus(res, 200, 'jiuzhaigou.jpg');
    assert.ok(
      res.contentType.startsWith('image/jpeg'),
      `期望 image/jpeg，实际 ${res.contentType}（若返回 text/html 说明被 SPA 回落吞了）`,
    );
  });

  t.test('[资产] 已下线的 /images/jiuzhaigou.png 应 404，不能被 SPA 回落成 200 HTML', async () => {
    const res = await api('GET', '/images/jiuzhaigou.png');
    assert.equal(
      res.status,
      404,
      `缺失图片应 404，实际 HTTP ${res.status} + ${res.contentType}` +
        '（SPA 回落把缺失静态资源包成了 index.html：server/index.js 的 app.get("*") 未排除带扩展名的路径）',
    );
  });

  t.test('[F-05/F-10] 接口返回的封面图路径必须能取到真实图片（防 .png/.jpg 漂移导致全站破图）', async () => {
    const scenics = expectOk(await api('GET', '/api/scenics?pageSize=100'), '景区全量（图片校验）');
    const regions = expectOk(await api('GET', '/api/regions'), '地区全量（图片校验）');
    const paths = [
      ...new Set([...scenics.list.map((item) => item.coverImage), ...regions.list.map((item) => item.coverImage)]),
    ];
    assert.ok(paths.length > 0, '没有取到任何 coverImage，无法校验');

    const broken = [];
    for (const imagePath of paths) {
      const res = await api('GET', imagePath);
      if (res.status !== 200 || !res.contentType.startsWith('image/')) {
        broken.push(`${imagePath} → HTTP ${res.status} ${res.contentType}`);
      }
    }
    assert.deepEqual(
      broken,
      [],
      `以下封面图取不到图片（前端会显示占位块）：${broken.join('；')}。` +
        '若 seed.js 已改为 .jpg 而 db.json 仍是 .png，需删除 server/data/db.json 后重启才会按新种子重建',
    );
  });

  t.test('[异常] 非法 JSON 请求体 → 400 + code 1004，且响应带 X-Request-Id', async () => {
    const res = await api('POST', '/api/auth/login', { raw: '{"username": "x", ', headers: { 'Content-Type': 'application/json' } });
    expectStatus(res, 400, '非法 JSON');
    expectFail(res, 1004, '非法 JSON');
    assert.ok(
      res.headers.get('x-request-id'),
      '1004 响应缺少 X-Request-Id（requestId 中间件必须挂在 express.json 之前，否则解析失败时排错无法串联）',
    );
  });

  t.test('[异常] 超大请求体（>1MB）→ 413 + code 1001，不能误报成 500/5000', async () => {
    const huge = 'x'.repeat(1024 * 1024 + 2048);
    const res = await api('POST', '/api/feedbacks', { body: { nickname: 'xx', contact: 'yy', content: huge } });
    assert.ok(res.json !== null, `超大 body 的响应应为 JSON，实际 ${res.contentType}`);
    assert.equal(res.status, 413, `超大 body 期望 HTTP 413，实际 ${res.status}`);
    expectFail(res, 1001, '超大 body');
    assert.ok(res.json.message.length > 0, '413 应带中文提示，不能是空白 message');
    assert.ok(res.headers.get('x-request-id'), '413 响应缺少 X-Request-Id，超限请求无法按 reqId 追日志');
  });

  t.test('[异常] GET /api/health 返回 code=0 且带 X-Request-Id 便于排错串联', async () => {
    const res = await api('GET', '/api/health');
    expectStatus(res, 200, 'health');
    const data = expectOk(res, 'health');
    assert.equal(data.status, 'ok', `health.status 应为 ok，实际 ${data.status}`);
    assert.ok(res.headers.get('x-request-id'), '缺少 X-Request-Id 响应头');
  });
});
