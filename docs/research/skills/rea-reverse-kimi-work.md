# 用 REA (Reverse Engineering Assistant) 逆向分析 Kimi Work 桌面客户端 — 研究方案

> 位置: `docs/research/skills/rea-reverse-kimi-work.md`
> 日期: 2026-10-13
> 状态: 方案稿(未执行)
> 性质: 个人学习 / 互操作性与架构研究

---

## 1. 背景与研究对象

### 1.1 工具: REA

"rea.tool" 即 GitHub trending 项目 **[mytechnotalent/rea](https://github.com/mytechnotalent/rea)**(Reverse Engineering Assistant,当前 v4.0.0)。
注意: `rea.tool` / `rea.tools` 域名目前均无法解析,**权威文档来源就是 GitHub 仓库的 README**。

- 纯 Rust 编写,`#![forbid(unsafe_code)]`,MIT 协议
- **零外部依赖**: 不需要 Ghidra / Java / Python;非 x86 反汇编用内嵌 SLEIGH 规格的纯 Rust 引擎
- 一条命令 `rea <file>` → 在目标旁生成 GitHub 风味 Markdown 报告 `re-<name>.md` + 排版 PDF `re-<name>.pdf`
- 可选接入 LLM(OpenRouter)进入"propose-review-adjudicate"多智能体自主分析模式;无 Key 时退化为纯离线确定性模式(零网络请求)
- 可作为 **MCP server**(`rea serve`)接入 Claude Code / Claude Desktop / Cursor / Windsurf / OpenCode,提供 12 个交互式分析工具

### 1.2 目标: Kimi Work

**Kimi Work** 是月之暗面(Moonshot AI)面向知识工作者的通用型本地 Agent 产品,2026-06 开启公测,随 Kimi 测试版 **Mac / Windows 桌面客户端**分发,内核为 **Kimi Code**(可对标 Claude Code 一类的本地 Agent 运行时)。

关键事实(决定逆向路线):

| 事实 | 推论 |
|---|---|
| 桌面客户端,Mac + Windows 双端 | Windows 上大概率是 PE(EXE/DLL),Mac 上是 Mach-O |
| 内核是 Kimi Code(Agent 运行时) | 可能是 Node.js/Electron 打包,或内嵌 JS bundle(cli.js 类),或 Rust/Tauri 壳 |
| 公开资料中无人写过 Kimi Work 逆向分析 | 需要先做"打包形态指纹识别",再分支处理 |

## 2. 合规与安全边界(先读,再动手)

本方案只覆盖**对本地已安装副本的静态分析与架构学习**。明确不做、也不应做:

1. **不绕过授权/许可校验**: 不分析、不修补任何 license / 会员 / 付费墙逻辑。
2. **不滥用提取到的凭据**: REA 会提取"hardcoded secrets"与 IOC(URL/IP 等)。这些端点与密钥属于月之暗面机密,**只用于理解架构,绝不用于绕过鉴权调用服务、重分发或转售**。
3. **不重分发专有代码**: 分析产物(报告)可留档,解包出的源码/资源不得公开传播。
4. **遵守 ToS 与当地法律**: 逆向仅为个人研究与互操作目的;若发现安全漏洞,走负责任披露,不公开利用细节。
5. **隔离环境**: 分析机建议用一次性虚拟机;REA 本身内存安全,但报告中的字符串/URL 属于不可信输入,不要在宿主机上直接执行。

## 3. REA 使用文档(速查)

### 3.1 安装与构建(Windows x64)

REA 对 Windows/Linux **不提供预编译产物**,必须源码构建:

```powershell
# 前置: rustup 安装 stable Rust 工具链
git clone https://github.com/mytechnotalent/rea.git
cd rea
rustup target add x86_64-pc-windows-msvc
cargo build --release -p rea --target x86_64-pc-windows-msvc
# 产物: target\x86_64-pc-windows-msvc\release\rea.exe
# 或安装到 PATH: cargo install --path crates/rea
```

macOS Apple Silicon 在仓库 `releases/` 目录有预编译二进制。

### 3.2 CLI 用法

```powershell
.\rea.exe .\<suspect>          # 分析任意文件
# 产物: 目标旁的 re-<suspect>.md 与 re-<suspect>.pdf
```

### 3.3 LLM 增强(可选)

```dotenv
# .env(当前目录或任意祖先目录),或环境变量
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free   # 默认免费档模型,可覆盖
```

有 Key → 自主多智能体分析(执行摘要/架构分析/经复核的漏洞/建议);无 Key → 纯确定性离线报告。

### 3.4 MCP 模式(接入编码代理)

```bash
rea mcp --setup      # 一步配置
rea mcp --config     # 配置向导
rea serve            # stdio MCP server
claude mcp add rea rea serve   # Claude Code 接入示例
```

支持目标: Claude Code CLI、OpenCode(`mcp_config.json`)、Claude Desktop、Cursor、Windsurf。

12 个 MCP 工具:

`open_binary` · `binary_session` · `list_functions` · `decompile_function` · `find_xrefs` · `search_strings` · `analyze_firmware` · `analyze_javascript` · `generate_dossier` · `inspect_go` · `inspect_dotnet` · `inspect_android`

### 3.5 格式支持矩阵(与本项目相关部分)

| 格式 | 支持程度 | 对 Kimi Work 的意义 |
|---|---|---|
| PE(EXE/DLL/SYS)、ELF、Mach-O、universal | 完整解析 | 主程序、原生模块(.node 即 DLL)、Mac 端二进制 |
| Electron `.asar` | In-memory: 解包、**IPC 通道提取**、**硬编码机密提取** | 若是 Electron 应用,这是主入口 |
| Go 可执行(pclntab) | 函数表/modinfo/工具链版本 | 若内核是 Go 编译产物 |
| .NET CIL 程序集 | ECMA-335 元数据、TypeDef/MethodDef | 小概率场景 |
| 未知文件 | 哈希、熵、字符串、IOC | 安装包、资源文件兜底分析 |

分析能力: MD5/SHA-1/SHA-256/imphash、香农熵、节表、导入导出、缓解措施(ASLR/DEP/NX/CFG/PIE/RELROL/stack canary)、递归下降反汇编 + 调用图、沙箱化 P-Code 仿真(还原运行时字符串/解密载荷)、壳/保护器识别、IOC 提取(URL/IP/邮箱/注册表键/路径/命令)。

## 4. 逆向方案与步骤

总路线: **先指纹识别打包形态 → REA 全自动基线报告 → MCP 交互式定向深挖 → 按研究问题归档**。

### Phase 0 — 环境准备

1. Windows 分析机(建议一次性 VM),安装 Rust stable(rustup)。
2. 按上文 3.1 构建 `rea.exe`。
3. 可选: 配置 `OPENROUTER_API_KEY`(LLM 多智能体模式对大型 JS bundle 的归纳帮助很大)。
4. 建立工作目录,例如 `D:\re-kimi\`,后续所有样本与报告集中于此。

### Phase 1 — 样本获取与指纹识别

1. 正常安装 Kimi 桌面客户端(测试版),**不登录也行,静态分析不需要凭据**。
2. 定位安装目录(常见: `%LOCALAPPDATA%\Programs\Kimi*` 或 `Program Files\`;Mac 为 `/Applications/Kimi*.app`)。
3. 记录目录树,先跑一轮"未知文件"基线:

```powershell
.\rea.exe "D:\re-kimi\install-dir\Kimi.exe"
.\rea.exe "D:\re-kimi\install-dir\Kimi-installer.exe"   # 安装包本身(NSIS/Squirrel/msi)也过一遍
```

4. **形态判定决策树**:

| 观察到的特征 | 判定 | 走哪条分支 |
|---|---|---|
| `resources\app.asar`(+ 可选 `app.asar.unpacked`) | Electron | Phase 2-A(主路线) |
| 只有主 EXE + 前端资源目录,EXE 体积大、Rust 特征字符串 | Tauri/原生壳 | Phase 2-B |
| `*.node` 原生模块、`node_modules`、`cli.js`/大体积单 JS | 内嵌 Node 运行时 | Phase 2-C |
| `.jsc`/`.bin` 字节码、asar 打不开或内容异常 | bytenode / asar 加密 | Phase 5 兜底 |

> REA 对 Electron .asar 是自动识别的,直接把 asar 丢给 `rea` 即可同时完成"识别 + 解包 + IPC/机密提取"。

### Phase 2-A — Electron 路线(主路线,若命中)

```powershell
.\rea.exe "D:\re-kimi\install-dir\resources\app.asar"
# 产出: asar 解包清单、IPC 通道清单(channel 名即主进程↔渲染进程 API 面)、硬编码机密位置
```

关注点:
- **IPC 通道清单** = 客户端暴露给渲染层的原生能力面(文件读写、窗口、托盘、自动更新、协议拉起等),是理解"本地 Agent 权限边界"的第一手材料。
- 主进程入口(通常 `main.js` / `dist/main.js`)中的启动参数、远程 URL / 内嵌页面加载策略。

### Phase 2-B — 原生壳路线(若命中)

对主 EXE 与所有原生 DLL 跑 `rea`,读报告里的: 导入表(网络栈?本地推理库?)、缓解措施、字符串与 IOC(内嵌端点)、壳检测。重点找内嵌资源/子包(很多原生壳把前端资源压在 PE 资源段或单独 pack 文件里),再对提取出的文件继续跑 `rea`。

### Phase 2-C — JS bundle 路线

对超大单文件 JS(如 `cli.js`、`kimi-code` 内核 bundle)直接:

```powershell
.\rea.exe "D:\re-kimi\...\cli.js"
```

JS 分析在 MCP 模式下由 `analyze_javascript` 工具承接(见 Phase 3)。

### Phase 3 — MCP 交互式深挖(核心研究阶段)

把 REA 作为 MCP server 接入你惯用的编码代理(本仓库工作流即在 ZCode/Claude Code 类代理中):

```bash
claude mcp add rea rea serve
```

然后按研究问题(RQ)组织会话:

| 研究问题 | 用到的 MCP 工具 | 方法 |
|---|---|---|
| RQ1 Agent 循环如何实现(计划/工具调用/审批) | `analyze_javascript`、`search_strings` | 在 JS bundle 中定位 tool 定义、system prompt 模板、工具白名单 |
| RQ2 本地能力面(文件系统、shell、剪贴板、屏幕) | `search_strings` + asar 的 IPC 清单 | IPC channel ↔ 渲染层调用点 ↔ 权限门控逻辑三方对照 |
| RQ3 模型接入层(端点、鉴权、流式协议) | `search_strings`(IOC: URL/域名) | 只记录端点拓扑与协议形态;**密钥只标记不使用** |
| RQ4 原生加速/系统集成模块 | `open_binary` + `list_functions` + `decompile_function` + `find_xrefs` | 对每个 `.node` 原生模块做函数级反编译 |
| RQ5 自动更新与分发安全 | `search_strings` + PE 报告 | 更新源 URL、签名校验、下载校验逻辑 |
| RQ6 反调试/加固对抗(仅识别,不绕过) | PE 报告的壳检测 | 记录保护类型,评估其有效性,不写绕过代码 |

### Phase 4 — 交叉验证

- REA 报告是静态结论;对"运行时行为"类问题(实际网络流量、实际文件写入)用**观察自己流量**的方式旁证: mitmproxy/Charles 只看本机发起的请求,与 RQ3 的静态端点表互相印证。
- Mac 端(Mach-O)重复 Phase 1-3,对比双端实现差异。

### Phase 5 — 兜底与产出

- 若 asar 被加密/打包为 V8 字节码(bytenode),REA 的 asar 支持是 in-memory 级别,此时退回社区工具链(`@electron/asar`、字节码反编译工具)做提取,把提取产物再丢回 REA/MCP 分析。
- 用 `generate_dossier` 汇总成档案,归档回本目录: `docs/research/` 下按 `kimi-work-<主题>.md` 拆分(IPC 面、Agent 循环、更新机制…)。

## 5. 已知限制

1. **REA 的 Electron/APK/SquashFS 支持标注为 "In-memory"**(非完整解析),asar 加密、bytenode 场景需外部工具接力。
2. REA **没有动态调试能力**(不能 attach 调试器、不能下断点),运行时问题只能靠流量观察旁证。
3. Windows/Linux 需自行编译;`cargo xtask check` 是其质量门,构建失败先查 Rust 版本。
4. LLM 模式依赖第三方 OpenRouter Key,样本内容会出网 —— **涉密/含个人数据的样本必须用无 Key 的离线模式**。

## 6. 参考资料

- REA 仓库与文档: <https://github.com/mytechnotalent/rea>
- ReVa(另一同名缩写项目,注意区分): <https://github.com/cyberkaida/reverse-engineering-assistant>
- Kimi 官网: <https://www.kimi.com> · 月之暗面: <https://www.moonshot.cn>
- Kimi Work 公测报道: [新浪财经](https://finance.sina.com.cn/tech/roll/2026-06-03/doc-iniacxkk4015954.shtml) / [Yahoo 财经](https://hk.finance.yahoo.com/news/月之暗面-kimi-開啟公測-001826261.html)
- Electron asar 通用逆向参考: [Electron 官方 ASAR 文档](https://electronjs.org/zh/docs/latest/tutorial/asar-archives) · [asar 解包入门(CC11001100)](https://www.cnblogs.com/cc11001100/p/14290584.html) · [asar 加密与动态解压解析](https://my.oschina.net/u/7997782/blog/19659294)
