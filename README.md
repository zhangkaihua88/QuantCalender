# WQ Meeting Calendar

面向中国大陆与香港成员的非官方会议日历。前端部署在 GitHub Pages，私密会议、成员名单和审批数据由 Cloudflare Worker + D1 保存。

完整生产上线步骤请阅读：[DEPLOYMENT.md](DEPLOYMENT.md)。

## 项目结构

- `web/`：Vue 3、TypeScript、Vite 前端
- `worker/`：Cloudflare Worker API、D1 迁移和 iCalendar 输出
- `packages/shared/`：前后端共用的 Zod 校验和 TypeScript 类型

## 本地开发

本项目使用 pnpm workspace。

1. 安装依赖：`pnpm install`
2. 复制 `worker/.dev.vars.example` 为 `worker/.dev.vars`，替换所有示例密钥。
3. 初始化本地数据库：`pnpm --filter @wq-calendar/worker exec wrangler d1 migrations apply wq-meeting-calendar --local`
4. 分别启动 API 与前端：`pnpm dev:worker`、`pnpm dev`
5. 浏览 `http://localhost:5173`

开发环境会跳过 Turnstile 的服务端验证。示例 CSV 只含虚构 ID，不应把真实成员 CSV 提交到 Git。

## 管理员密码与密钥

运行：

```text
node worker/scripts/hash-admin-password.mjs
```

脚本会输出管理员密码的 SHA-256 验证值，以及两个独立的随机密钥建议。管理员密码必须是至少 20 位的高熵随机值。

生产环境通过 `wrangler secret put` 配置：

- `ADMIN_WQ_ID`
- `ADMIN_PASSWORD_HASH`
- `WQ_ID_HMAC_SECRET`
- `TURNSTILE_SECRET`
- `SESSION_SECRET`

会话令牌以带密钥的 HMAC-SHA-256 形式保存。轮换 `SESSION_SECRET` 会立即使全部旧会话失效；更新 `ADMIN_PASSWORD_HASH` 会立即使全部旧管理员会话失效。

## Cloudflare 部署

创建 D1、Cloudflare API Token、Worker Secrets 和 API 自定义域名的逐步说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。

30 天登录依赖同一主域名下的两个子域：前端 `calendar.<域名>`，API `api.calendar.<域名>`。API Cookie 使用 `HttpOnly + Secure + SameSite=Strict`，并额外校验 CSRF 和精确 Origin。

## GitHub Pages 部署

GitHub Variables、Secrets、Pages 自定义域名和首次发布顺序见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 成员导入

管理员后台接受：

```csv
wq_id,country,record_date
EXAMPLE_001,CN,2026-07-23
EXAMPLE_002,HK,2026-07-23
```

导入采用“整体替换”：CSV 中缺失的旧成员会停用，其现有登录会话和私密日历订阅立即失效。导入前会检查表头、地区、日期和重复 ID。

## 验证

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm check`

## 安全边界

WQ_ID 登录仅是名单门禁，不能证明当前使用者真正拥有该 ID。不要在会议记录中保存密码、个人专属入会链接、内部文件或参与者名单。本项目不代表 WorldQuant 官方立场。
