# WQ Meeting Calendar 部署指南

本文对应当前仓库中的 GitHub Actions 配置，推荐架构为：

- 前端：GitHub Pages，域名 `wqcalendar.hualabtech.com`
- API：Cloudflare Worker，域名 `api.wqcalendar.hualabtech.com`
- 数据库：Cloudflare D1
- 登录防护：Cloudflare Turnstile

请把全文中的 `hualabtech.com`、`QuantCalender` 和其他示例值替换为自己的信息。

> 必须使用同一主域名下的两个子域名。正式 Cookie 设置了 `SameSite=Strict`；如果前端继续使用 `github.io`、API 使用另一个域名，浏览器不会按预期携带登录 Cookie。

## 一、部署前准备

需要准备：

1. 一个 GitHub 账号和一个新的 GitHub 仓库。
2. 一个 Cloudflare 账号。
3. 一个已经接入 Cloudflare DNS 的自有域名。
4. Windows 本机安装 Git 和 Node.js 22，或者使用 Codex 当前任务自带的 Node/pnpm 运行环境。
5. 一个指定的管理员 WQ_ID，以及至少 20 位的随机管理员密码。
6. 正式 CN/HK 成员 CSV；它只在上线后由管理员导入，不提交到 GitHub。

### 方案 A：当前 Codex 任务的 PowerShell（已经实测）

当前 Codex PowerShell 能直接找到 Git 和 pnpm，但 Node 没有公开在默认 PATH 中，而且没有 `corepack` 命令。请使用以下完整命令：

```powershell
cd "D:\CALL\Desktop\Supervisor\杂项\号池\wq-meeting-calendar"
$env:PATH="C:\Users\Kaihua\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\Kaihua\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;$env:PATH"
$env:XDG_CONFIG_HOME=(Join-Path (Get-Location) '.wrangler-home')
node --version
git --version
pnpm --version
pnpm install --frozen-lockfile
pnpm check
```

当前实测版本为 Node `v24.14.0`、Git `2.47.1.windows.2`、pnpm `11.9.0`，安装、测试和构建均能通过。这里不需要运行 `corepack enable`。

### 方案 B：普通 Windows Terminal / PowerShell

如果希望在 Codex 之外执行，请先安装 Node.js 22，然后运行：

```powershell
cd "D:\CALL\Desktop\Supervisor\杂项\号池\wq-meeting-calendar"
node --version
git --version
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm --version
pnpm install --frozen-lockfile
pnpm check
```

若系统提示 `node` 或 `corepack` 不是命令，说明普通 PowerShell 尚未正确安装 Node.js，或者安装后没有重新打开终端。

只有 `pnpm check` 全部通过后再部署。

## 二、确定正式域名

下面以 `hualabtech.com` 为例：

| 用途 | 正式值 |
| --- | --- |
| 前端来源 | `https://wqcalendar.hualabtech.com` |
| API 地址 | `https://api.wqcalendar.hualabtech.com` |
| GitHub Pages 自定义域名 | `wqcalendar.hualabtech.com` |
| Worker Custom Domain | `api.wqcalendar.hualabtech.com` |

注意：

- `CALENDAR_ORIGIN` 必须是精确来源，不带末尾 `/`。
- API 地址必须使用 HTTPS。
- 不要提前为 `api.wqcalendar.hualabtech.com` 创建 CNAME；Cloudflare 添加 Worker Custom Domain 时会自动创建 DNS 和证书。

## 三、生成管理员密码验证值和密钥

运行：

```powershell
node worker/scripts/hash-admin-password.mjs
```

输入至少 20 位随机管理员密码。脚本会输出：

1. 第一行：`ADMIN_PASSWORD_HASH`
2. `建议的会话密钥`：`SESSION_SECRET`
3. `建议的 WQ_ID HMAC 密钥`：`WQ_ID_HMAC_SECRET`

把管理员原始密码保存到密码管理器。不要把密码、哈希或密钥写入 README、CSV、代码、截图或聊天记录。

其他值：

- `ADMIN_WQ_ID`：唯一管理员的真实 WQ_ID，建议使用规范化的大写形式。
- `TURNSTILE_SECRET`：下一步创建 Turnstile 后获得。

密钥轮换影响：

- 更新 `ADMIN_PASSWORD_HASH` 会立即注销全部管理员会话。
- 更新 `SESSION_SECRET` 会立即注销全部成员和管理员会话。
- 更新 `WQ_ID_HMAC_SECRET` 后，旧成员哈希无法继续匹配；必须立即重新导入完整成员 CSV。

## 四、创建 Cloudflare Turnstile

1. 进入 Cloudflare Dashboard → **Turnstile**。
2. 创建名为 `WQ Meeting Calendar Login` 的 Widget。
3. 模式选择 **Managed**。
4. 允许的 hostname 添加 `wqcalendar.hualabtech.com`。
5. 保存并复制：
   - Sitekey：之后填入 GitHub Variable `VITE_TURNSTILE_SITE_KEY`。
   - Secret key：之后填入 GitHub Secret `TURNSTILE_SECRET`。

Sitekey 可以公开；Secret key 只能放在 Worker Secret/GitHub Secret。Turnstile token 只有短暂有效期且只能验证一次，生产环境不要使用测试密钥。

官方参考：[Turnstile 快速开始](https://developers.cloudflare.com/turnstile/get-started/)。

## 五、创建 D1 数据库

### 普通 Windows PowerShell：使用浏览器 OAuth

请在 Codex 之外的 Windows Terminal / PowerShell 中运行。Wrangler 在 Codex、容器或其他隔离环境中运行时，浏览器可能无法访问临时的 `localhost:8976` 回调服务器，表现为浏览器已经授权但命令一直等待。

在项目根目录运行：

```powershell
pnpm --filter @wq-calendar/worker exec wrangler login
pnpm --filter @wq-calendar/worker exec wrangler d1 create wq-meeting-calendar
```

如果默认回调仍失败，可停止命令后重新运行：

```powershell
pnpm --filter @wq-calendar/worker exec wrangler login --callback-host=127.0.0.1
```

不要公开浏览器回调 URL；其中包含与本次登录状态绑定的一次性授权码。

### 当前 Codex PowerShell：推荐使用 API Token

先按照下一节创建 Cloudflare API Token 和取得 Account ID，然后在 Codex PowerShell 中执行：

```powershell
cd "D:\CALL\Desktop\Supervisor\杂项\号池\wq-meeting-calendar"
$env:PATH="C:\Users\Kaihua\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\Kaihua\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback;$env:PATH"
$env:XDG_CONFIG_HOME=(Join-Path (Get-Location) '.wrangler-home')

$secureToken = Read-Host "粘贴 Cloudflare API Token" -AsSecureString
$env:CLOUDFLARE_API_TOKEN = [System.Net.NetworkCredential]::new('', $secureToken).Password
$env:CLOUDFLARE_ACCOUNT_ID = "b4def5add7e193d2db7479a694383440"

pnpm --filter @wq-calendar/worker exec wrangler whoami
pnpm --filter @wq-calendar/worker exec wrangler d1 create wq-meeting-calendar

Remove-Item Env:CLOUDFLARE_API_TOKEN
Remove-Item Env:CLOUDFLARE_ACCOUNT_ID
```

`Read-Host -AsSecureString` 可以避免 Token 出现在屏幕和命令历史中。不要把 Token 写入项目文件。

浏览器会要求登录 Cloudflare。创建成功后会显示一个 UUID 格式的 `database_id`，保存为：

```text
CLOUDFLARE_D1_DATABASE_ID=f3f6069f-4460-4d1b-b585-6b1097e28566
```

不要创建第二个同名数据库。数据库迁移会由 GitHub Actions 自动执行。

可选检查：

```powershell
pnpm --filter @wq-calendar/worker exec wrangler d1 list
```

官方参考：[D1 Wrangler 命令](https://developers.cloudflare.com/workers/wrangler/commands/d1/)和[D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/)。

## 六、创建 Cloudflare API Token

1. Cloudflare Dashboard → **My Profile** → **API Tokens**。
2. 创建 Custom Token，范围仅限制到部署所用的 Cloudflare Account。
3. 至少授予：
   - Account / Workers Scripts / Write（如果界面仍显示 Edit，选择对应的可写权限）
   - Account / D1 / Edit
4. 如 Wrangler 报告缺少账户读取权限，再加入 Account Settings / Read。
5. 保存生成的 Token；离开页面后通常无法再次查看完整值。
6. 从 Cloudflare Dashboard 复制 Account ID。

对应 GitHub Secrets：

- Token → `CLOUDFLARE_API_TOKEN`
- Account ID → `CLOUDFLARE_ACCOUNT_ID`

不要使用 Global API Key。

## 七、创建 GitHub 仓库

在 GitHub 新建一个空仓库，例如 `wq-meeting-calendar`。不要勾选自动创建 README、`.gitignore` 或 License，因为本地仓库已经存在这些文件。

暂时不要推送。先在空仓库中配置下一节的 Variables 和 Secrets；这样第一次推送就能直接运行部署工作流。

如果 GitHub 在空仓库阶段不显示完整设置，也可以先推送；第一次 Actions 失败没有关系，补齐配置后在 Actions 页面点击 **Re-run all jobs**。

## 八、配置 GitHub Variables 与 Secrets

进入 GitHub 仓库：**Settings → Secrets and variables → Actions**。

### Repository variables

| 名称 | 示例值 | 说明 |
| --- | --- | --- |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 返回的 UUID | D1 数据库 ID |
| `VITE_API_BASE_URL` | `https://api.wqcalendar.hualabtech.com` | 前端调用 API、Worker 生成订阅链接使用 |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile Sitekey | 可以公开 |
| `CALENDAR_ORIGIN` | `https://wqcalendar.hualabtech.com` | Worker CORS/CSRF 精确来源，不带 `/` |

不要创建 `VITE_BASE_PATH`；自定义域名部署时应保持为空。只有临时使用 `https://QuantCalender.github.io/wq-meeting-calendar/` 时才设为 `/wq-meeting-calendar/`，但该地址不适合作为正式登录站点。

### Repository secrets

| 名称 | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Custom API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `ADMIN_WQ_ID` | 指定管理员 WQ_ID |
| `ADMIN_PASSWORD_HASH` | 密码脚本输出的第一行 |
| `WQ_ID_HMAC_SECRET` | 密码脚本输出的 WQ_ID HMAC 密钥 |
| `TURNSTILE_SECRET` | Turnstile Secret key |
| `SESSION_SECRET` | 密码脚本输出的会话密钥 |

GitHub Secrets 会加密保存，不能改用普通 Variables。官方参考：[GitHub Actions Secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)。

## 九、推送代码并运行自动部署

先确认真实 CSV、本地密钥和构建目录未被纳入提交：

```powershell
git status --short --ignored
```

`worker/.dev.vars`、`members.csv`、`node_modules/`、`dist/` 应显示为 ignored，不能进入待提交列表。

然后提交并推送：

```powershell
git add .
git status
git commit -m "Initial WQ Meeting Calendar deployment"
git remote add origin https://github.com/QuantCalender/wq-meeting-calendar.git
git push -u origin main
```

推送后进入 GitHub → **Actions**，应看到：

1. `CI`
2. `Deploy GitHub Pages`
3. `Deploy Cloudflare Worker`

三项都应为绿色。Worker 工作流会：

1. 安装锁定依赖。
2. 将 D1 ID 写入临时构建配置。
3. 执行远程 D1 migration。
4. 将五项 Worker Secrets 与代码一次性上传。
5. 使用生产环境变量部署 Worker。

若变量是在第一次推送后才配置，进入失败的工作流并选择 **Re-run all jobs**。

## 十、启用 GitHub Pages 和前端域名

1. GitHub 仓库 → **Settings → Pages**。
2. Source 选择 **GitHub Actions**。
3. 如果 Pages 工作流此前失败，回到 Actions 重新运行 `Deploy GitHub Pages`。
4. 在 **Custom domain** 中填写 `wqcalendar.hualabtech.com`。
5. 根据 GitHub 提示在 Cloudflare DNS 添加：

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| CNAME | `calendar` | `QuantCalender.github.io` | DNS only |

6. 等 GitHub 的 DNS check 成功并签发证书后，启用 **Enforce HTTPS**。
7. 建议按 GitHub 页面提示完成域名验证，降低自定义域名被其他仓库占用的风险。

Cloudflare DNS 初次配置时保持 **DNS only**。官方参考：[GitHub Pages 自定义域名](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)和[GitHub Pages Actions 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 十一、给 Worker 添加 API 自定义域名

Worker 首次部署成功后：

1. Cloudflare Dashboard → **Workers & Pages**。
2. 选择 `wq-meeting-calendar-api`。
3. **Settings → Domains & Routes → Add → Custom Domain**。
4. 输入 `api.wqcalendar.hualabtech.com`。
5. 确认添加。

Cloudflare 会自动创建 DNS 记录并签发证书。该 hostname 不能已有冲突的 CNAME。

测试：

```powershell
Invoke-RestMethod https://api.wqcalendar.hualabtech.com/health
```

预期结果包含：

```json
{
  "status": "ok",
  "service": "wq-meeting-calendar-api"
}
```

官方参考：[Cloudflare Worker Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## 十二、首次上线初始化

打开：

```text
https://wqcalendar.hualabtech.com
```

按照以下顺序操作：

1. 切换到管理员登录。
2. 使用 `ADMIN_WQ_ID` 和原始管理员密码登录。
3. 进入“成员导入”。
4. 上传完整正式 CSV：

```csv
wq_id,country,record_date
EXAMPLE_001,CN,2026-07-24
EXAMPLE_002,HK,2026-07-24
```

5. 浏览器预览无误后确认整体替换。
6. 使用一个 CSV 内的测试成员 WQ_ID 登录。
7. 创建一条测试投稿并由管理员审批。
8. 生成私密日历地址，并在日历客户端测试订阅。
9. 完成验证后删除或取消测试会议。

真实 CSV 不应放在项目目录内，尤其不能执行 `git add`。

## 十三、上线验收清单

### 域名与网络

- [ ] `https://wqcalendar.hualabtech.com` 可以打开。
- [ ] `https://api.wqcalendar.hualabtech.com/health` 返回 `ok`。
- [ ] 页面和 API 均无证书警告。
- [ ] 浏览器请求没有 CORS 错误。

### 登录与 Cookie

- [ ] 未导入名单的成员不能登录。
- [ ] CN/HK 名单成员可以登录。
- [ ] 管理员可以登录。
- [ ] Cookie 名称为 `__Host-wq_session`。
- [ ] Cookie 具有 `HttpOnly`、`Secure`、`SameSite=Strict`。
- [ ] 登录过期时间约为 30 天，且不会无限自动续期。
- [ ] 退出当前设备后旧 Cookie 无法继续访问。

### 权限与业务

- [ ] 普通成员不能访问管理后台/API。
- [ ] 投稿审批前不会出现在公开会议列表。
- [ ] 审批后会议正常显示北京时间。
- [ ] 取消/改期能同步到 ICS。
- [ ] 私密订阅地址旋转后旧地址立即返回失效。
- [ ] CSV 整体替换后，被移除成员的会话和订阅失效。

### Turnstile

- [ ] 正式页面显示 Turnstile。
- [ ] Turnstile Dashboard hostname 是 `wqcalendar.hualabtech.com`。
- [ ] Sitekey 与 Secret 属于同一个 Widget。
- [ ] 登录失败后 Widget 可以刷新并重新验证。

## 十四、常见故障

### Pages 页面资源 404

- 自定义域名部署时不要设置 `VITE_BASE_PATH`。
- 仓库子路径预览才设置 `/wq-meeting-calendar/`。
- 修改 Variable 后需要重新运行 `Deploy GitHub Pages`。

### 页面能打开，但一直无法保持登录

- 检查前端和 API 是否分别为 `wqcalendar.hualabtech.com` 与 `api.wqcalendar.hualabtech.com`。
- 两者必须 HTTPS 且属于同一主域名。
- 检查 Worker 的 `APP_ENV` 是否由工作流设为 `production`。
- 检查浏览器中是否生成了 `__Host-wq_session`。

### 出现 CORS 或 `CSRF_FAILED`

- `CALENDAR_ORIGIN` 必须与地址栏来源完全一致。
- 正确值类似 `https://wqcalendar.hualabtech.com`，不能有末尾 `/`。
- `VITE_API_BASE_URL` 必须是 `https://api.wqcalendar.hualabtech.com`。
- 修改变量后同时重新运行 Pages 和 Worker 部署。

### Worker 工作流提示 D1 不存在

- 检查 `CLOUDFLARE_D1_DATABASE_ID` 是否为 UUID，而不是数据库名称。
- 检查 D1 与 API Token 是否属于同一个 Cloudflare Account。
- 检查 API Token 是否有 D1 Edit 权限。

### Turnstile 总是失败

- 检查生产域名是否加入 Widget hostname。
- 检查 GitHub Variable 使用 Sitekey，GitHub Secret 使用 Secret key。
- 不要把测试 Sitekey 与正式 Secret 混用。
- 修改后重新运行两个部署工作流。

### 管理员能登录但成员不能登录

- 首先确认已完成成员 CSV 导入。
- CSV 只接受 `CN` 或 `HK`。
- WQ_ID 会转换为大写，但空格、错误字符或旧名单仍可能导致不匹配。
- 如果轮换过 `WQ_ID_HMAC_SECRET`，必须重新导入完整 CSV。

### Actions 中 Worker 部署返回 403

- 检查 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
- 检查 Token 资源范围是否包含正确 Account。
- 检查 Workers Scripts Write（或界面中的 Edit）与 D1 Edit 权限。

### `wrangler login` 授权后一直等待

- 按 `Ctrl+C` 停止当前命令，不要重复使用或公开旧回调 URL。
- 这是浏览器无法访问隔离环境中 `localhost:8976` 回调监听器造成的。
- 推荐按第五节改用 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。
- 或者在 Codex 之外的普通 Windows PowerShell 中重新运行登录。

## 十五、后续更新与回滚

每次更新前运行：

```powershell
pnpm check
git add .
git commit -m "Describe the calendar update"
git push
```

推送到 `main` 会按修改路径自动运行 Pages 或 Worker 部署。建议在 GitHub 为 `main` 启用分支保护，要求 `CI / check` 成功后才允许合并。

代码回滚使用：

```powershell
git revert <需要撤销的提交SHA>
git push
```

不要对已在生产执行的 D1 migration 使用删除文件或强行回退。数据库结构变化应新增向前迁移；涉及删除字段或表时，先导出备份并单独制定迁移方案。

Cloudflare Dashboard 的 Worker Deployments 页面也可以紧急切换回旧版本，但 Git 仓库仍应随后执行 `git revert`，保持代码与线上版本一致。

## 十六、不要提交的内容

以下内容不得进入 GitHub：

- 正式成员 CSV
- `worker/.dev.vars`
- 管理员原始密码或密码哈希
- Turnstile Secret
- Cloudflare API Token
- `SESSION_SECRET`
- `WQ_ID_HMAC_SECRET`
- 私密日历订阅地址
- 会议密码、个人专属入会链接或内部文件

上线前后都可以用 `git status --short --ignored` 检查忽略状态。
