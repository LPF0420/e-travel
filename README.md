# e起去旅行（e-travel）

「e 键出发，风景在前」— 旅游景区介绍与旅游攻略站点。前台浏览景区 / 游记、注册会员收藏；后台管理地区 / 景区 / 游记、意见建议与三类日志。

- 需求文档：`docs/PRD.md`
- 系统设计：`docs/DESIGN.md`（数据模型、45 个 API 契约、错误码、种子规格）
- 界面截图：`docs/screenshots/`（前台首页 / 景区列表 / 景区详情 / 游记详情 / 登录 / 联系我们，后台仪表盘 / 景区管理，移动端首页）
- 后端测试：`scripts/smoke-api.mjs`（90 项冒烟）+ `tests/api/`（123 项独立验收，含并发与越权）

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | Vite 5 + React 18 + react-router-dom 6，纯手写 CSS（JSX，不用 TypeScript，无 UI 组件库） |
| 后端 | Node.js 22 + Express 4，ESM（`"type": "module"`），**唯一 runtime 依赖 `express`** |
| 持久化 | 单文件 `server/data/db.json`（内存缓存为唯一读源 + 串行写队列 + tmp→rename 原子落盘） |
| 认证 | `node:crypto` scrypt 加盐密码哈希 + HMAC-SHA256 无状态 token（7 天，重启不掉线） |

> 不引入 axios / dayjs / concurrently / multer / jsonwebtoken / bcrypt，也没有数据库与 ORM。

## 快速开始

```bash
npm install          # 依赖已锁定版本，直接装即可

npm run dev          # 开发：API :3001 + Vite :5173（前端未就绪时只启动 API）
npm run dev:api      # 只启动后端 API（:3001）
npm run smoke        # 后端冒烟测试（需 API 已启动，默认打到 127.0.0.1:3001）

npm run build        # 构建前端到 dist/
npm start            # 生产：单端口 3001 托管 dist/ + /api（SPA 回落已排除 /api）
```

- API 端口固定 **3001**（可用 `PORT` 覆盖）；Vite 开发端口 **5173**，`/api` 由 `frontend/vite.config.js` 的 proxy 转发到 3001。
- `server/data/db.json` **不入库**，首次启动自动按种子数据生成（8 地区 / 8 景区 / 8 游记 / 2 会员 / 1 管理员 / 6 收藏 / 3 反馈 / 18 条日志）。
- 想重置数据：停服务 → 删除 `server/data/db.json` → 重新启动即可。

## 默认账号

| 角色 | 账号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 会员 1 | **林小满** | `123456` | 手机 `13800138000`，邮箱 `user@example.com`，预置 4 条收藏 |
| 会员 2 | **周叙白** | `123456` | 手机 `13900139000`，邮箱 `zhou@example.com`，预置 2 条收藏 |
| 管理员 | **admin** | `admin123` | displayName = 站点管理员，后台入口 `/admin/login` |

> 会员登录用**会员名**（不是邮箱）；`email` 字段仅作资料展示。

## 目录导览

```
e-travel/
├── package.json            # 单一工程：type=module、scripts、依赖
├── scripts/
│   ├── dev.mjs             # spawn API + Vite createServer，SIGINT 双杀
│   └── smoke-api.mjs       # 后端冒烟脚本（90 项断言，可重复运行）
├── server/
│   ├── index.js            # Express 装配 + 错误兜底 + 生产 static/SPA 回落
│   ├── constants.js        # 角色/分页尺寸/日志枚举/保留上限
│   ├── utils.js            # ok/fail/AppError/asyncHandler/分页/校验器/日期区间
│   ├── db.js               # 内存缓存 + nextId + 串行写队列 + 原子落盘 + 自举
│   ├── auth.js             # scrypt 哈希 / HMAC token / requireMember / requireAdmin / optionalMember
│   ├── logs.js             # 操作日志 / 管理员日志 / 会员登录日志（1000 条上限裁剪）
│   ├── seed.js             # 种子数据（运行时生成密码哈希）
│   ├── data/db.json        # 运行时生成（不入库）
│   └── routes/
│       ├── index.js        # /api 聚合 + /api 通配 JSON 404
│       ├── shared.js       # 出参投影（派生字段 regionName/favoriteCount/...）
│       ├── auth.js favorites.js feedbacks.js regions.js scenics.js travels.js stats.js
│       └── admin/
│           ├── auth.js dashboard.js options.js members.js feedbacks.js
│           └── logs.js regions.js scenics.js travels.js
└── frontend/
    ├── index.html / vite.config.js
    ├── public/images/      # 9 张景区图（已压缩为 jpg，共约 1.9 MB）
    └── src/
        ├── main.jsx App.jsx routes.jsx    # 入口 + 全局 Toast + 27 条路由（双守卫）
        ├── styles/         # tokens → base → components → site/admin 页级样式
        ├── lib/            # api（fetch 封装/token/ApiError）、format、validate、constants
        ├── context/        # 会员登录态 / 管理员登录态 / 全局提示
        ├── components/     # ui(16) + site(16) + admin(10)
        └── pages/          # site(11) + admin(13)
```

## API 约定（前端对接必读）

- 统一响应包：`{ code, message, data }`，`code === 0` 为成功；失败时 `data` 通常为 `null`，**多字段校验失败时 `data` 是 `{ 字段名: 错误提示 }`**。
- 分页包：`{ list, total, page, pageSize, totalPages }`；请求参数 `page`（默认 1）、`pageSize`。
- 鉴权：`Authorization: Bearer <token>`；会员 token 与管理员 token **互不通用**（会员 token 打 `/api/admin/*` 返回 403 / 2004）。
- 错误码：`0` 成功 / `1001` 参数校验 / `1002` 资源不存在 / `1003` 唯一性冲突 / `1004` JSON 非法 / `2001` 未登录 / `2002` token 失效 / `2003` 账号或密码错误 / `2004` 权限不足 / `2005` 原密码不正确 / `3001` 存在关联数据 / `3002` 外键不存在 / `5000` 服务器错误。
- `/api` 下未命中路径返回 **JSON** 404（`code: 1002`），不会落到前端 HTML。

### 接口清单（45 个 + 健康检查）

| 分组 | 接口 |
| --- | --- |
| 健康 | `GET /api/health` |
| 会员 | `POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout` |
| 收藏 | `GET/POST /api/favorites`、`DELETE /api/favorites/:scenicId`（幂等） |
| 公开内容 | `GET /api/regions`、`GET /api/regions/:id`、`GET /api/scenics`、`GET /api/scenics/:id`、`GET /api/scenics/:id/travels`、`GET /api/travels`、`GET /api/travels/:id`、`POST /api/feedbacks`、`GET /api/stats/public` |
| 后台账号 | `POST /api/admin/auth/login`、`POST /api/admin/auth/logout`、`GET /api/admin/auth/me`、`PUT /api/admin/auth/password` |
| 后台管理 | `GET /api/admin/dashboard`、`GET /api/admin/options`、`GET /api/admin/members`、`GET /api/admin/members/:id`、`GET /api/admin/feedbacks`、`PATCH /api/admin/feedbacks/:id` |
| 后台日志 | `GET /api/admin/logs/operations`、`/api/admin/logs/admins`、`/api/admin/logs/member-logins` |
| 后台地区 | `GET /api/admin/regions`、`GET/POST/PUT/DELETE /api/admin/regions/:id` |
| 后台景区 | `GET/POST /api/admin/scenics`、`GET/PUT/DELETE /api/admin/scenics/:id`、`PATCH /api/admin/scenics/:id/recommend` |
| 后台游记 | `GET/POST /api/admin/travels`、`GET/PUT/DELETE /api/admin/travels/:id` |

## 前端约定（页面 / 组件开发必读）

**样式引入顺序不可调换**（已在 `frontend/src/main.jsx` 固定）：`tokens.css`（CSS 变量）→ `base.css`（reset / 中文排版 / 布局工具类）→ `components.css`（组件类名）→ `site-pages.css` / `admin-pages.css`（页级微调）。颜色、字号、间距、圆角、阴影**只能引用 `tokens.css` 里的变量**，不得自造色值。

1. **搜索关键词必须截断到 50 字符再进 URL**：`keyword.trim().slice(0, 50)`。请求 URL（含 query）受 Node `maxHeaderSize` 限制，超长约 8 KB 会在 HTTP 解析阶段被直接拒绝并返回 `431`，且**响应体为空、浏览器控制台无业务报错**（见「已知限制」），表现为「搜索偶发空白页」。
2. **页面只允许使用 `components.css` 里已有的 class，不新增行内样式**（`style={{…}}`）。需要一次性间距时用工具类（`.stack` / `.row` / `.section` / `.grid` / `.container`）；确实要新样式就补进对应的 `site-pages.css` / `admin-pages.css`，并沿用 BEM-lite 命名（`block__element` / `block--modifier`），避免三层样式互相覆盖。
3. **图片路径只能是 `frontend/public/images/` 下真实存在的 9 个 `.jpg`**（如 `/images/jiuzhaigou.jpg`），**扩展名是 `.jpg` 不是 `.png`**；后端 `isAvailableImagePath()` 会校验磁盘真实存在性，前端 `lib/validate.js` 的 `imagePath()` 已用 `IMAGE_PATHS` 做同口径预校验，可直接给字段红字。
4. **列表的分页与筛选状态一律放 URL query**（`?keyword&regionId&sort&page`），不放进 Context；`page` 缺失视为 1，切换筛选时 `page` 重置为 1，返回列表用 `navigate(-1)` 或携带原 query。
5. **`lib/api.js` 成功时只返回已解包的 `data`**，失败抛 `ApiError`；`e.fieldErrors` 仅在 `code === 1001` 可用，`1003`（重名）/ `3002`（外键不存在）/ `3001`（地区被引用）统一用 `e.message` 展示在顶部 `.form-alert`——其中 `3001` 的 message 是完整中文，可直接显示。

## 测试

```bash
# 1) 冒烟（需 API 已在 3001 启动）
npm run dev:api      # 终端 A
npm run smoke        # 终端 B   → 90 项

# 2) 独立验收套件（自带起服/备份/恢复，默认端口 3101，勿与 3001 同时写库）
node tests/api/run.mjs        → 123 项
```

- `scripts/smoke-api.mjs`：公开接口、会员注册/登录/收藏全链路（含幂等与 401）、后台登录与越权拦截、地区/景区/游记 CRUD、占用删除拦截、三类日志、改密与新密码重登、`/api` 未命中 JSON 404、非法 JSON、空表单 5 字段、超 1MB → 413。
- `tests/api/`：按 PRD 的 F-xx 编号组织的 123 条断言（A 公开接口 37 / B 会员链路 33 / C 意见反馈 8 / D 后台链路 35 / E 并发与一致性 7），覆盖并发收藏幂等、级联删除、越权断言 `code:2004`、日志 pageSize 上限、静态资源 404 语义。运行结束会恢复 `db.json` 并删除备份。

## GitHub Pages 静态演示站

线上地址：<https://LPF0420.github.io/e-travel/>（仓库 `LPF0420/e-travel`，push 到 `main` 后由 GitHub Actions 自动构建部署）。

**静态版是只读演示站**：GitHub Pages 只能托管静态文件、无法运行 Node 后端，因此首页、景区列表 / 详情、游记列表 / 详情、关于我们、联系我们（展示部分）均可正常浏览，但登录 / 注册 / 收藏 / 意见提交 / 后台等写操作会给出中文提示，不会真的写入数据。数据来自 `server/data/db.json` 的脱敏快照（只保留地区、景区、游记与收藏计数，不含密码哈希、会员资料、管理员与日志）。

静态模式是**显式开关**，仅 Pages 构建打开，`npm run dev` 与 `npm run build && npm start` 的行为完全不变：

- `scripts/build-static.mjs` → 生成 `frontend/public/static-data.json`（构建时拷入 `dist/`）；
- `frontend/vite.config.js` 在 `VITE_STATIC_MODE=1` 时设 `base: '/e-travel/'`、注入 `__STATIC_MODE__`，并给少数硬编码 `/images/...` 补 base 前缀；
- `frontend/src/lib/api.js` 在该模式下从快照内存投影出与后端同构的响应；`main.jsx` 改用 `HashRouter` 以避免子路径深链 404。

本地复现静态构建：

```bash
VITE_STATIC_MODE=1 npm run build:pages     # Windows PowerShell: $env:VITE_STATIC_MODE=1; npm run build:pages
# 产物在 dist/；用任意静态服务器以 /e-travel/ 为前缀托管即可预览
```

只更新快照数据（不重新构建）时执行 `node scripts/build-static.mjs`。重新部署：提交并 push 到 `main`，或在 Actions 页手动触发 `Deploy to GitHub Pages`；还需在仓库 Settings → Pages → Build and deployment 中把 Source 选为 **GitHub Actions**（首次启用由主理人完成）。

## 已知限制

- **图片路径白名单**：后台表单的 `coverImage` / `gallery` 必须是 `frontend/public/images/`（构建后为 `dist/images/`）下**真实存在**的文件，否则返回 `400` + `code: 1001` + `data.coverImage` 提示。当前 9 张素材均为 **`.jpg`**（如 `/images/jiuzhaigou.jpg`），填 `.png` 会被拒——这样能避免"存进去了但前台破图"。
  - 编辑存量数据时有豁免：**值未被改动就跳过存在性校验**，所以历史记录里遗留的旧路径不会把「打开即保存」卡死；一旦改动就必须是真实存在的文件。新增（POST）始终严格校验。
- **单次请求体上限 1 MB（1048576 字节）**，超限返回 `HTTP 413` + `{ code: 1001, message: '提交内容过长，请精简后重试' }`（值由 `server/index.js` 的 `BODY_LIMIT_BYTES` 控制，非默认值）。
- 请求 URL（含 query）受 Node 的 `maxHeaderSize` 限制，超长（约 8 KB 以上）会在 HTTP 解析阶段被直接拒绝，返回 `431` 且响应体为空（非 JSON）——**前端需自行限制关键词长度（建议 ≤ 50 字符）**。
- token 有效期 7 天，无状态签名无黑名单：改密后旧 token 仍在有效期内可用，靠前端清 `localStorage` + 强制重登实现「改密即下线」。
- 会员/管理员账号与日志均无删除接口（PRD Q-01：会员只读，日志只读）。
- 景区图集：**前端限制 5 张**（`ScenicForm` 的 `GALLERY_MAX` 与 `GalleryPathInput` 的 `max` 默认值，对齐 PRD）；后端 `normalizeStringList({ maxItems: 6 })` 更宽松，超出会**静默截断**而不报错——直接调 API 时注意这一点。
- 图片路径必须是 `frontend/public/images/` 下真实存在的文件（后端三层校验：`/images/` 前缀 + 扩展名白名单 + 目录扫描；`PUT` 时若字段值未改动则跳过存在性校验，历史失效路径不会卡住编辑）。
- **数据文件可隔离**：默认 `server/data/db.json`；设置环境变量 `ETRAVEL_DB_FILE` 可指向其他文件，用来让自动化用例与联调各用一份库、互不覆盖。例：`ETRAVEL_DB_FILE=/tmp/smoke.json node server/index.js` 后再跑 `node scripts/smoke-api.mjs`，全程不会改动正在联调的那份 `db.json`。

## 图片素材（唯一 9 张，勿新增）

`frontend/public/images/`：`jiuzhaigou.jpg`（九寨沟/四川）、`zhangjiajie.jpg`（张家界/湖南）、`westlake.jpg`（西湖/浙江）、`potala.jpg`（布达拉宫/西藏）、`huangshan.jpg`（黄山/安徽）、`sanya.jpg`（三亚/海南）、`guilin.jpg`（漓江/广西）、`lijiang.jpg`（丽江/云南）、`about.jpg`（关于我们页）。

- 已统一压缩为 **1600px 宽 / JPEG q82**，总体积 **19.0 MB → 1.9 MB**（首屏头图由 2.4 MB 降到 277 KB），肉眼看不出差异。
- 图片路径集中在 `frontend/src/lib/constants.js` 的 `IMAGES` 与 `server/seed.js`，**改扩展名只需改这两处**；`dist/images/` 由 `publicDir` 自动同步。
- 地区封面复用本地区景区图，游记封面复用所属景区图，会员头像不用图片（前端按名字首字生成色块）。
