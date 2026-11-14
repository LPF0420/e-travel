# 后端 API 独立验收（QA）

面向 `server/**` 的黑盒 HTTP 验收套件，验收口径为 `docs/PRD.md` 第四章 P0 需求（F-xx）与 `docs/DESIGN.md` §3 API 契约 / §3.4 错误码表。

与工程师的 `scripts/smoke-api.mjs` **互不复用**：用例、断言、并发场景、异常路径均为 QA 侧独立编写，用于交叉验证。
当前规模：**125 条用例（A 40 / B 33 / C 8 / D 37 / E 7）+ 8 条编辑豁免定向回归 + 4 条静态资产只读回归**。

## 怎么跑

```bash
# 1) 全量套件（推荐）：默认用「隔离库」，不碰 server/data/db.json
node tests/api/run.mjs

# 2) 换端口（默认 3101，避开前端联调占用的 3001）
QA_PORT=3199 node tests/api/run.mjs

# 3) 老口径：备份/还原共享 db.json（需要对共享库做端到端验证时用）
QA_SHARED_DB=1 node tests/api/run.mjs

# 4) 编辑豁免定向回归（自建脏种子、独立端口 3198）
node tests/api/legacy-images.mjs

# 5) 静态资产只读回归（不启服务、不写库，指向已在跑的服务）
API_BASE=http://127.0.0.1:3001 node tests/api/static-assets.mjs
```

退出码：`0` 全部通过、`1` 有用例失败、`2` 环境异常（端口占用 / 服务起不来）。**端口被占时直接退出，绝不杀别人的进程。**

## 默认模式（隔离库）会自动做什么

1. 在 `tests/api/.tmp/` 下建临时数据文件，通过 `ETRAVEL_DB_FILE` 让服务指向它（缺文件时 `bootstrap()` 自动按 `server/seed.js` 生成种子）；
2. 以 `PORT=3101 node server/index.js` 启动服务并等待 `/api/health` 就绪；
3. 顺序执行 A~E 五组用例；
4. **无条件**（含失败 / Ctrl-C）关停服务、删除 `tests/api/.tmp/`；
5. 打印共享 `server/data/db.json` 的 sha256 前后对比——**两个值必须相同**，这就是「没动共享数据」的证据。

`QA_SHARED_DB=1` 才会走旧的「备份 → 重置 → 跑 → 恢复 → 删备份」流程；该模式下若上一次异常中断残留 `db.test-backup.json`，会沿用旧备份而不是覆盖它。

### 两个与运行环境有关的自适应点

1. **SPA 回落**：`dist/index.html` 存在时，非 `/api` 路径返回 `index.html`（200 / text/html，含 `<div id="root">`）；不存在时返回 JSON `1002`。用例按模式自适应，构建前后都能跑。两种模式下 `/api/not-exist` 都必须是 JSON `1002`（该断言不放宽）。
2. **图片资产**：用例会校验接口返回的 `coverImage` 能否取到真实图片（`.jpg` → 200 / `image/jpeg`，已下线的 `.png` → 404）。若 `seed.js` 改过图片路径而 `server/data/db.json` 还是旧的，这条会红——因为 `db.bootstrap()` 只在文件缺失时才按 `seed.js` 生成。修复：停服务 → 备份后重建 `server/data/db.json` → 重启。

## 用例分组

| 组 | 文件 | 覆盖 |
| --- | --- | --- |
| A | `suites/a-public.mjs` | 景区列表分页/关键词/地区过滤/三种排序（相邻项真比较）、推荐位 limit、景区详情与关联游记、地区列表与详情、游记列表与详情、`/api/stats/public`、`/api/*` 未命中 JSON 404、非法 JSON 1004、413 超限、超长/特殊字符 keyword、SPA 回落、图片资产 |
| B | `suites/b-member.mjs` | 注册（重复 1003、两次口令不一致等逐字段 1001）/登录（错误口令与不存在账号均 2003）/`me`/退出、收藏新增幂等/列表/取消幂等、会员登录日志、伪造·篡改·过期·非法角色·已删账号 token（均 2002）、会员↔管理员双向越权（断言 `code:2004`，并验证数据未被改动）、三类日志接口拒绝会员 token |
| C | `suites/c-feedback.mjs` | 游客提交、5–300 字校验、必填逐项定位、坏 token 降级游客、后台可见、状态过滤 |
| D | `suites/d-admin.mjs` | 管理员登录/`me`/改密（含改回原口令）、地区 CRUD（1003/3001/3002）、景区 CRUD + 推荐开关 + 级联删除游记与收藏、游记 CRUD、三类日志（含 `pageSize` 上限截断与日期范围）、仪表盘数字与库内一致、下拉选项、退出日志、图片白名单拒绝非法路径 |
| E | `suites/e-concurrency.mjs` | 10 并发收藏只落 1 条、5 并发取消只 removed 一次、8 并发建地区全落盘且 id 唯一、读写混合无 500、结束后 `db.json` 仍可 `JSON.parse` 且 id/计数器自洽 |
| — | `legacy-images.mjs` | 旧库脏图片路径的「编辑豁免」：PUT 未改动 → 放行、改动 → 严格校验、POST → 始终严格 |
| — | `static-assets.mjs` | 图片与 SPA 回落的只读复核（`.jpg` 200 / `.png` 404 / 无扩展名页面 200 / `/api/*` 404 均为 JSON） |

## 测试账号

| 角色 | 账号 | 口令 | 来源 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin123` | `README.md`、`DESIGN.md` §7、`server/seed.js` |
| 会员 | `林小满` / `周叙白` | `123456` | 同上 |

可用 `ETRAVEL_ADMIN_PASSWORD` / `ETRAVEL_MEMBER_PASSWORD` 覆盖（改过种子口令时）。

## 约定

- 只读 `server/**`，发现 Bug 只写报告，**不改业务代码**；
- 所有用例自建数据并在同组内清理；默认隔离库模式下共享 `db.json` 全程零写入；
- 断言业务 `code` 而非仅 HTTP 状态码（越权必须断言 `2004`，不能只看 403）；
- 不启停、不干扰非本套件占用端口的服务（如 3001 联调服务）。
