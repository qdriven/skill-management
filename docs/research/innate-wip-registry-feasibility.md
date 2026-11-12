# 私有 registry 消费可行性验证（innate-wip）

日期：2026-10-14
结论：**可行**。`innate-fe-cli registry` 一条命令链路（start → publish → init）即可把平台包发到内置 Verdaccio，全新目录的消费方项目 `npm install` + `vite build` + `tsc` 全部通过，零手工配置。

## 目标

验证「平台（shell / packages / CLI）与业务项目分仓」的设想中，以私有 registry 分发 `@innate/*` 平台包这条路是否走得通：

1. 平台仓内一键启动私有 registry 并发布平台包；
2. 完全新的目录里起一个消费方项目，只通过 `.npmrc` 路由 `@innate` 作用域；
3. 消费方以 Vite + React 真实构建，验证 TS 源码形态包的可用性。

## 验证环境

- 平台仓：`innate-fe-base`（本仓），CLI 新增 `registry` 命令组（`tools/innate-fe-cli/src/commands/registry.ts`）
- registry：Verdaccio 6.10.5，`pnpm dlx` / `npx` 按需拉起，状态在 `<root>/.verdaccio/`（已 gitignore）
- 消费方：`research/innate-wip/`（全新目录，独立 package.json，非 workspace 成员）

## 验证步骤与结果

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 启动 registry | `innate-fe-cli registry start` | ✔ Verdaccio 后台启动（127.0.0.1:4873），自动注册本机账号并存 token |
| 发布平台包 | `innate-fe-cli registry publish` | ✔ 拓扑序发布 `@innate/ui@0.1.0`、`@innate/web-domain@0.1.0`；其余 8 个 packages 为 `private: true` 自动跳过 |
| 重复发布 | 同上再跑一次 | ✔ 识别"版本已存在"跳过，提示 `--bump patch` |
| 消费方接入 | `innate-fe-cli registry init research/innate-wip` | ✔ 写入 `.npmrc`：`@innate:registry=http://127.0.0.1:4873/` |
| 安装 | `npm install`（innate-wip 内） | ✔ `@innate/*` 来自私有源，其余包直连 npmjs，0 报错 |
| 构建 | `vite build` | ✔ 4015 个模块转换成功，含 `@innate/ui` 的 TS 源码入口 |
| 类型检查 | `tsc --noEmit` | ✔ 通过，`types: ./src/index.ts` 源码形态下类型解析正常 |
| React 副本 | 检查 node_modules 嵌套 | ✔ react/react-dom 顶层单一副本（`@innate/ui` 已将二者声明为 peerDependencies） |

## 关键事实（验证中确认）

1. **TS 源码直出的包可以直接发**：`@innate/ui` / `@innate/web-domain` 的 `main`/`exports` 指向 `./src/index.ts`，没有构建步骤；Vite 的 esbuild 管线对 node_modules 里的 `.ts/.tsx` 照常转换，bundler 模式下的 tsc 也能解析。**消费方是 Vite 时不需要给平台包加构建**；若未来要支持 webpack4 / Node 直跑等场景，再补 tsup 产物。
2. **React 必须且已经是 peerDependency**：`@innate/ui` 的 peer 为 `react: ^19`。独立消费方安装时 npm 提升为单一顶层副本，无双 React 风险。
3. **pnpm publish 不是摆设**：只有 pnpm 会把 `workspace:*` 转成真实版本号。当前两个可发布包恰好没有 `workspace:*` 内部依赖，所以 npm 兜底也能发；一旦 `@innate/admin-composites` 等（依赖 `@innate/ui: workspace:*`）转为可发布，必须用 pnpm，否则发布会失败。CLI 已实现 pnpm 优先、npm 兜底并给出警告。
4. **凭证隔离**：发布用 token 写在 `.verdaccio/npmrc`，通过 `--userconfig` 传入，不污染仓库与全局 `.npmrc`；消费方只需要一行作用域路由。
5. **Verdaccio 存储可复用**：`.verdaccio/storage` 持久化已发布的包，registry 重启后包仍在。

## 尚未覆盖 / 遗留风险

- **domain 进壳的双 React 问题不在本次范围**：本验证是独立 Vite 应用（等价 iframe 轨道）。若消费方开发的 domain 要编进 webshell 同一棵 React 树，仍需 shell 侧 `resolve.dedupe` 收敛 `@innate/ui` 与 react——此路径未验证，建议 domain 业务继续同仓开发，分仓只用于 iframe / 独立站。
- **`@innate/ui` 的 globals.css 未验证**：innate-wip 未引入样式 token 文件；消费方要用完整主题还需 tailwind + token 链，属另一个课题。
- **团队共用**：目前 listen 在 127.0.0.1；多人共用需 `registry start --host 0.0.0.0` 并把消费方 `.npmrc` 换成服务器 IP。
- **版本纪律**：registry 模式失去了 monorepo 内"改即生效"，平台改动要走 `publish --bump` → 消费方升级的节奏。

## 复现

```bash
# 平台仓
innate-fe-cli registry start
innate-fe-cli registry publish          # 加 --bump patch 可连发新版

# 消费方（任意新目录）
innate-fe-cli registry init <dir>
cd <dir> && npm install && npx vite build
```

消费方示例项目：`research/innate-wip/`（保留为最小可复现样例）。
