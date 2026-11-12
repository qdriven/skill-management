# 平台包分发完整方案：Verdaccio 本地源 + GitHub Packages 双链路

日期：2026-10-15（修正版：GitHub owner 为 `variableway`，不是 `innate`）
前置验证：[innate-wip-registry-feasibility](./innate-wip-registry-feasibility.md)

## 0. 先读这一段：两套方案是什么、怎么选

| | 方案一：Verdaccio 本地私有源 | 方案二：GitHub Packages |
| --- | --- | --- |
| 包存哪 | 你自己机器的 `127.0.0.1:4873` | GitHub 账号 `variableway` 名下 |
| 适合 | 本地快速迭代、调试、单机开发 | 团队共享、CI 自动构建、GitHub Pages 部署 |
| 费用 | 免费（本地软件） | 免费额度内够用（公共包免费；私有包 500MB 存储，Actions 内下载不计流量） |
| CLI 支持 | ✅ 已实现：`registry start / publish / init` | 📝 规划中：`registry publish --to github`（本文档给出纯手工替代步骤） |
| 消费方要不要 token | 不要（本机匿名读） | 要（读私有包也需 PAT） |

**两套方案不互斥**，推荐组合：日常改平台包 → 方案一就地验证；稳定后 → 方案二发正式版给消费仓用。

**一个关键事实（已修正）**：本仓 GitHub 远程是 `github.com/variableway/innate-fe-templates`。GitHub Packages 硬性要求 **npm 包的 scope 必须等于 GitHub owner 名**，所以方案二里包名是 `@variableway/*`，**不是 `@innate/*`**。源码里的 `@innate/*` 不用改——发布时只改 `package.json` 的 `name` 字段即可（当前两个可发布包 `@innate/ui`、`@innate/web-domain` 内部全部是相对 import，改 name 不影响代码）。

## 1. 方案一：Verdaccio 本地私有源（CLI 已实现，今天就能用）

### 1.1 平台仓：三步

```bash
# 第 1 步：启动私有 registry（首次会下载 Verdaccio，等 1-2 分钟属正常）
innate-fe-cli registry start
# 预期输出：✔ 已启动: http://127.0.0.1:4873

# 第 2 步：发布平台包（自动按依赖拓扑排序；registry 没起会自己拉起）
innate-fe-cli registry publish
# 预期输出：发布顺序: @innate/ui@0.1.0 → @innate/web-domain@0.1.0 ... ✔ 已发布
# 版本已存在会跳过；要发新版加：--bump patch

# 第 3 步：完事收工
innate-fe-cli registry stop
```

已发布的包存在 `.verdaccio/storage`，重启 registry 后仍在。

### 1.2 消费方：两步

```bash
# 第 1 步：在消费项目目录写入路由（只需做一次）
innate-fe-cli registry init <你的项目目录>
# 效果：项目下生成 .npmrc，内容就一行 @innate:registry=http://127.0.0.1:4873/

# 第 2 步：正常装、正常用
cd <你的项目目录>
npm install        # @innate/* 走私有源，其余包仍走 npmjs
```

✅ 此链路已端到端验证：样例项目 `research/innate-wip/` 的 `vite build` 与 `tsc --noEmit` 均通过。

## 2. 方案二：GitHub Packages（团队共享 / CI / Pages）

### 2.1 一次性准备：拿 token（两条路，推荐 gh）

**路线 A：用 gh CLI（推荐，不用手工建 PAT）**

本机已装 gh（`C:\Program Files\GitHub CLI\gh.exe`）且已登录（当前活动账号 `qdriven`）。但现有 token 的 scope 只有 `repo / workflow / gist / project / read:org`，**缺 `write:packages`**，要先补 scope：

```bash
# 第 1 步：补 scope（会弹出浏览器授权一次）
gh auth refresh --scopes write:packages,read:packages

# 第 2 步：把 gh 的 token 直接写进用户级 ~/.npmrc（替代 npm login，不进仓库）
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
```

⚠ **账号注意**：包要发到 `@variableway` 名下，但 gh 当前活动账号是 `qdriven`。只要 `qdriven` 对 `variableway/innate-fe-templates` 有 write 权限就能发（首次发布即验证，403 再说）；如果 403，执行 `gh auth switch` 切到 variableway 账号或走路线 B。

**路线 B：手工建 PAT（gh 不可用时的保底）**

1. 打开 GitHub → 头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
2. 勾选 `write:packages`（会自动带上 `read:packages`）和 `repo`
3. 生成后复制保存（只显示一次）。下文称它为 `<PAT>`，同样写进 `~/.npmrc`：
   `//npm.pkg.github.com/:_authToken=<PAT>`

### 2.2 平台仓：手工发布 step by step（CLI 的 `--to github` 实现前的正式路径）

```bash
# 第 1 步：改包名（scope 必须等于 owner）
#   packages/ui/package.json:         "name": "@innate/ui"        → "@variableway/ui"
#   packages/web-domain/package.json: "name": "@innate/web-domain" → "@variableway/web-domain"

# 第 2 步：逐个发布（必须 pnpm，它能转换 workspace:*；按依赖顺序，ui 在前）
cd packages/ui && pnpm publish --registry https://npm.pkg.github.com --access public --no-git-checks && cd ../..
cd packages/web-domain && pnpm publish --registry https://npm.pkg.github.com --access public --no-git-checks && cd ../..
# 预期输出：+ @variableway/ui@0.1.0
# 版本撞了：npm version patch --no-git-tag-version 后重发
# 认证走 §2.1 写好的 ~/.npmrc，无需 npm login
```

发布后在 `github.com/variableway?tab=packages` 能看到包。建议把包关联到仓库：包页面 → Settings → Link repository → 选 `innate-fe-templates`（权限跟随仓库，有 repo read 的人就能装）。

### 2.3 把 innate-fe-cli 本身也发到 GitHub Packages

目标：消费方机器上 `npm i -g @variableway/innate-fe-cli` 后就能用 `innate-fe-cli` 命令，不用克隆平台仓。

当前障碍（动手发布前必须处理）：

- [ ] `tools/innate-fe-cli/package.json` 是 `private: true` → 去掉
- [ ] `name` 改为 `@variableway/innate-fe-cli`
- [ ] `bin` 现在指向包外的 `../../bin/index.js`，npm 打包不会包含 → 把构建产物收回包内：先 `bun run --cwd tools/innate-fe-cli build` 生成 `bin/index.js`，再把 package.json 的 `bin` 改为 `./bin/index.js` 并加 `"files": ["bin"]`
- [ ] 运行时依赖 bun（bin 是 bun 目标构建）→ 文档注明消费方需先 `npm i -g bun`；后续可改为 Node 目标构建消除此依赖

处理后发布：

```bash
cd tools/innate-fe-cli
pnpm publish --registry https://npm.pkg.github.com --access public --no-git-checks
```

### 2.4 消费方：安装与组合 step by step

```bash
# 第 1 步：项目 .npmrc 写 scope 路由（这行可以提交，不含密钥）
echo "@variableway:registry=https://npm.pkg.github.com/" > .npmrc   # Windows 手建文件写这一行也行

# 第 2 步：token 放用户级 ~/.npmrc（不要提交到仓库）
#   在 C:\Users\<你>\.npmrc 里加一行：
#   //npm.pkg.github.com/:_authToken=<PAT>

# 第 3 步：组合安装——需要什么装什么，L1 打底、L2 按需叠加
npm install @variableway/ui @variableway/web-domain react react-dom
```

组合原则不变：平台包只被消费方组合，不反向依赖；React 由 `@variableway/ui` 的 peerDependencies 保证单副本（已验证）。

### 2.5 消费方 CI + GitHub Pages

跨仓读私有包时 `GITHUB_TOKEN` 不够（只能读与本仓关联的包），把 `<PAT>` 存进消费仓：仓库 → Settings → Secrets and variables → Actions → 新建 `PACKAGES_READ_PAT`。

```yaml
# 消费仓 .github/workflows/pages.yml
name: pages
on: [push]
permissions:
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: |
          echo "@variableway:registry=https://npm.pkg.github.com/" >> .npmrc
          echo "//npm.pkg.github.com/:_authToken=${{ secrets.PACKAGES_READ_PAT }}" >> .npmrc
      - run: npm ci && npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

Actions 内下载包不计流量；Free 计划 Actions 2000 分钟/月，这个量级随便用。

## 3. 两条链路的 CLI 统一（规划，未实现）

目标是小白只需要记一套命令，CLI 内部区分 target：

```bash
innate-fe-cli registry publish                 # 方案一：发本地 Verdaccio（已实现 ✅）
innate-fe-cli registry publish --to github     # 方案二：发 GitHub Packages（待实现 📝）
innate-fe-cli registry init <dir> [--to github]  # 消费方写 .npmrc（github 版待实现 📝）
```

`--to github` 的实现要点（改动面小，逻辑全部复用）：

1. registry URL 换成 `https://npm.pkg.github.com`，跳过 Verdaccio 启动/账号注册
2. token 获取优先级：`NODE_AUTH_TOKEN` 环境变量 → `gh auth token`（gh 已登录时零配置）→ 提示走 §2.1；写入独立 userconfig（复用 `writePublisherNpmrc`）
3. 发布前自动把 `name` 从 `@innate/*` 重写为 `@variableway/*`（owner 从 `git remote get-url origin` 解析），发布后还原源码
4. 拓扑排序、`--only`、`--bump`、"已存在跳过" 原样复用
5. 覆盖 `tools/innate-fe-cli` 自身（§2.3 的障碍清单在实现时一并处理）

## 4. 小白完整手册（照抄即可）

### 场景 A：我就想本地改平台、本地验证

```bash
innate-fe-cli registry start
innate-fe-cli registry publish
innate-fe-cli registry init <消费项目目录>
cd <消费项目目录> && npm install && npm run build
innate-fe-cli registry stop
```

### 场景 B：我要发正式版给 CI / GitHub Pages 用

```bash
# 平台仓（一次性：npm login，见 §2.1 / §2.2 第 1 步）
# 平台仓（每次发版）：
cd packages/ui && npm version patch --no-git-tag-version && pnpm publish --registry https://npm.pkg.github.com --access public --no-git-checks && cd ../..
cd packages/web-domain && npm version patch --no-git-tag-version && pnpm publish --registry https://npm.pkg.github.com --access public --no-git-checks && cd ../..

# 消费仓（一次性：.npmrc + PAT，见 §2.4）
# 消费仓（每次升级）：
npm update @variableway/ui @variableway/web-domain
npm run build   # 本地或交给 Actions（§2.5）
```

### 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| publish 报 `workspace:*` 错误 | 用了 npm 而不是 pnpm；换 pnpm publish |
| publish 报 403 / permission | PAT 没勾 `write:packages`，或包名 scope 不是 `@variableway` |
| 安装报 401 | ~/.npmrc 没配 `//npm.pkg.github.com/:_authToken`，或 PAT 缺 `read:packages` |
| install 报 404 | 包没发布成功 / scope 路由行没写 / 包名打错 |
| Actions 里 401 | 消费仓 secrets 里的 `PACKAGES_READ_PAT` 没配或过期 |
| 版本已存在 | 先 `npm version patch --no-git-tag-version` 再发 |

## 5. 回退保底

任何情况下方案一（本地 Verdaccio）不依赖 GitHub，始终可用；`.verdaccio/storage` 里已发布的包重启后仍在。
