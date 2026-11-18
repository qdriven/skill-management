# Agent Skill 协议要点抽取

## 概述与核心结论

Agent Skill 是一种"用文件夹承载能力"的开放格式：一个 skill 就是一个目录，目录里至少有一个 `SKILL.md`，该文件由 YAML frontmatter（元数据）加 Markdown 正文（指令）组成。它的核心目的是给 AI agent 补充"它本来不具备的程序性知识与上下文"，把公司、团队、项目层面的专有经验（法务审查流程、数据分析管道、文档排版规范等）打包成可移植、可版本控制、按需加载的文件夹，从而让 agent 在跨产品环境下重复、稳定地完成一类任务。它解决的根本问题是 agent"能力足够但缺少上下文"，导致真实工作时不够可靠。

Agent Skill 工作在**渐进披露（progressive disclosure）**机制上，分三阶段加载：启动时只读 `name` 和 `description`（Discovery，约 100 token）判断是否相关；任务匹配时读入完整 `SKILL.md` 正文（Activation，建议 <5000 token / <500 行）；执行时才按需加载 `scripts/`、`references/`、`assets/` 里的资源（Execution）。因此格式规范的重点并非"写多少内容"，而是**让元数据精准、让正文精简、让重材料下沉到被引用的文件**。格式本身由 Anthropic 最初提出并开放，现已被大量 agent 客户端采用，`docs/specification.mdx` 是格式要求的唯一权威来源，其余文档、示例、实现不新增格式要求。

## 一、什么是 SKILL，目的与解决的问题

**SKILL 的定义。** *"Agent Skills are a lightweight, open format for extending AI agent capabilities with specialized knowledge and workflows. At its core, a skill is a folder containing a `SKILL.md` file. This file includes metadata (`name` and `description`, at minimum) and instructions that tell an agent how to perform a specific task."* 它同时是一个载体：skill 还可以打包脚本、参考资料、模板等其他资源（`refenerencs/agentskills/README.md`）。

**SKILL 的目的。** 把"专有知识 + 工作流"变成可复用资产。原文归纳为三点收益：**领域专长**（把从法务审查流程到数据分析管道、演示排版这类专门知识，固化为可复用的指令与资源）；**可重复工作流**（把多步骤任务变成一致、可审计的流程）；**跨产品复用**（一次构建，任何兼容 skill 的 agent 都能用）。

**SKILL 解决的问题。** *"Agents are increasingly capable, but often don't have the context they need to do real work reliably. Skills solve this by packaging procedural knowledge and company-, team-, and user-specific context into portable, version-controlled folders that agents load on demand."* 即 agent 缺的不是通用能力，而是具体的、项目相关的上下文。

**SKILL 与 Tools / MCP / Subagent 的边界（补充理解）。** skill 承载的是"知识和流程"，工具和 MCP 承载的是"能力接口"，子代理承载的是"独立执行上下文"；skill 本身不新增调用接口，而是教 agent 如何正确使用已有能力。

**生效机制（渐进披露三阶段）。**
1. **Discovery**：启动时只加载每个 skill 的 `name` 与 `description`，"just enough to know when it might be relevant"。
2. **Activation**：任务匹配描述时，agent 把完整 `SKILL.md` 正文读入上下文。
3. **Execution**：agent 按正文指令执行，必要时运行打包脚本或读取被引用文件。

设计含义：*"Full instructions load only when a task calls for them, so agents can keep many skills on hand with only a small context footprint."*

## 二、SKILL 目录结构规范

**最小结构**：一个目录 + 一个 `SKILL.md`。规范原文的目录骨架如下：

```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code
├── references/       # Optional: documentation
├── assets/           # Optional: templates, resources
└── ...               # Any additional files or directories
```

**约束与约定：**
- `SKILL.md` **必填**，是唯一强制文件，包含元数据与指令。
- 除 `SKILL.md` 外可有任意文件与目录，`scripts/`、`references/`、`assets/` 只是**约定（conventions）而非强制**。
- **目录名必须与 frontmatter 中的 `name` 一致**：*"Must match the parent directory name"*。这是硬约束，不匹配即不合法。
- `scripts/`：放可执行代码，脚本应自包含或明确记录依赖、给出友好错误信息、妥善处理边界情况；支持语言取决于实现，常见为 Python、Bash、JavaScript。
- `references/`：放按需阅读的补充文档，惯例文件名如 `REFERENCE.md`、`FORMS.md`、领域文件（`finance.md`、`legal.md`）。**每个文件要保持聚焦**：*"Agents load these on demand, so smaller files mean less use of context."*
- `assets/`：放静态资源，模板（文档模板、配置模板）、图片（示意图、示例）、数据文件（查找表、schema）。

**文件引用规则。** 在 `SKILL.md` 中引用其他文件用**相对 skill 根目录的相对路径**，且**保持一层深度**，避免深层引用链：

```markdown
See [the reference guide](references/REFERENCE.md) for details.
Run the extraction script: scripts/extract.py
```

**渐进披露的分层预算。**
1. **元数据（约 100 token）**：启动时对全部 skill 加载 `name` 与 `description`。
2. **指令（建议 <5000 token）**：skill 激活时加载完整正文。
3. **资源（按需）**：`scripts/`、`references/`、`assets/` 中的文件只在需要时加载。

规范据此要求：*"Keep your main `SKILL.md` under 500 lines. Move detailed reference material to separate files."*

## 三、SKILL.md 的 formatter 规范：必须字段与可选字段

`SKILL.md` = **YAML frontmatter + Markdown 正文**，frontmatter 之后接正文，正文**无格式限制**（*"There are no format restrictions. Write whatever helps agents perform the task effectively."*）。推荐正文包含：分步指令、输入/输出示例、常见边界情况。

**字段总表：**

| 字段 | 是否必须 | 约束 |
|-------|----------|-------------|
| `name` | 是 | 最长 64 字符；仅小写字母、数字、连字符；不得以连字符开头或结尾；不得含连续连字符；必须与父目录名一致 |
| `description` | 是 | 最长 1024 字符；非空；描述"做什么 + 何时用" |
| `license` | 否 | 许可证名称或指向随附许可证文件的引用，建议简短 |
| `compatibility` | 否 | 最长 500 字符；声明环境要求（目标产品、系统包、网络访问等）；多数 skill 不需要 |
| `metadata` | 否 | 任意键值映射，值为字符串，用于存放规范未定义的附加属性，建议键名足够独特避免冲突 |
| `allowed-tools` | 否 | 空格分隔的预批准工具列表，**实验性**，各实现支持度不同 |

**必须字段（2 个）：`name` 与 `description`。** 规范称 *"metadata (`name` and `description`, at minimum)"*，minimal example 仅含这两行：

```markdown
---
name: skill-name
description: A description of what this skill does and when to use it.
---
```

**`name` 字段细则。** 1–64 字符；只允许 unicode 小写字母数字（`a-z`、`0-9`）与连字符；不得以连字符开头/结尾；不得含连续连字符（`--`）；必须与父目录名一致。
- 合法：`pdf-processing`、`data-analysis`、`code-review`
- 非法：`PDF-Processing`（大写不允许）、`-pdf`（不能以连字符开头）、`pdf--processing`（连续连字符不允许）

**`description` 字段细则。** 1–1024 字符；**既要说明做什么、也要说明何时用**；应包含便于 agent 识别任务的具体关键词。这是 agent 决定是否激活 skill 的唯一依据，属于最关键的字段。
- 好例子：*"Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction."*
- 差例子：*"Helps with PDFs."*（只说做什么，没有触发条件，关键词不足）

**可选字段与必须字段的区别。** 必须字段是格式的**结构底线**：没有 `name` 无法标识和匹配目录，没有 `description` agent 无法判断何时激活，二者缺一 skill 即不可用；可选字段是**作者侧的扩展与声明**，不参与激活判定，各自职责为——`license` 声明授权，`compatibility` 声明运行环境前提，`metadata` 承载自定义属性，`allowed-tools` 预授权工具（实验性）。规范强调可选字段按需添加，例如 `compatibility`：*"Most skills do not need the `compatibility` field."*

**完整可选字段示例：**

```markdown
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
metadata:
  author: example-org
  version: "1.0"
---
```

**正文写作提示。** agent 激活 skill 后会把**整个文件**读入上下文，因此正文应克制；内容较长时应拆分为被引用的文件，借助渐进披露按需加载，而不是把重材料全堆在 `SKILL.md`。

**校验方式。** 使用官方参考库 `skills-ref` 校验：`skills-ref validate ./my-skill`，检查 `SKILL.md` frontmatter 合法性与命名约定。

## 四、Agent Skill 的 Best Practice 举例（3 个）

### 例子 1：最小可用型 —— `roll-dice`（来自官方 Quickstart）

**位置**：`refenerencs/agentskills/docs/skill-creation/quickstart.mdx`

**做法。** 只有一个 `SKILL.md`，正文不到 20 行，skill 目录为 `.agents/skills/roll-dice/SKILL.md`。核心是**最小化结构 + 在正文里给出具体可执行命令并说明参数替换**：

```markdown
---
name: roll-dice
description: Roll dice using a random number generator. Use when asked to roll a die (d6, d20, etc.), roll dice, or generate a random dice roll.
---

To roll a die, use the following command that generates a random number from 1
to the given number of sides:

```bash
echo $((RANDOM % <sides> + 1))
```

```powershell
Get-Random -Minimum 1 -Maximum (<sides> + 1)
```

Replace `<sides>` with the number of sides on the die (e.g., 6 for a standard
die, 20 for a d20).
```

**体现的最佳实践。**
- **description 写全"做什么 + 何时用 + 触发关键词**：列出 `d6`、`d20`、`roll dice`、`random dice roll` 等触发词，保证 Discovery 阶段能精准匹配。
- **正文直接给可执行方案**，不解释"随机数是什么"这类 agent 已知内容（对应 best-practices 的 *"Add what the agent lacks, omit what it knows"*）。
- **提供多种环境**（bash 与 PowerShell）并明确说明参数替换规则，覆盖跨平台差异。
- **结构极简**：无 `scripts/`、`references/`，证明 skill 无需重材料也能成立。

### 例子 2：流程与检查清单型 —— `commit-work`（来自 agent-toolkit）

**位置**：`refenerencs/agent-toolkit/skills/commit-work/SKILL.md`，目录含 `references/commit-message-template.md`

**做法。** 针对"高质量 git 提交"这一脆弱且要求一致性的任务，正文用 **Goal → 待确认输入 → 工作流检查清单 → 交付物** 四段式结构，把脆弱步骤写成硬性规定：

```markdown
---
name: commit-work
description: "Create high-quality git commits: review/stage intended changes, split into logical commits, and write clear commit messages (including Conventional Commits). Use when the user asks to commit, craft a commit message, stage changes, or split work into multiple commits."
---

## Goal
Make commits that are easy to review and safe to ship: ...

## Inputs to ask for (if missing)
- Single commit or multiple commits? ...
- Commit style: Conventional Commits are required.

## Workflow (checklist)
1) Inspect the working tree before staging
   - `git status` / `git diff` / `git diff --stat`
2) Decide commit boundaries (split if needed)
3) Stage only what belongs in the next commit
   - Prefer patch staging for mixed changes: `git add -p`
4) Review what will actually be committed
   - `git diff --cached`
   - Sanity checks: no secrets or tokens ...
5) Describe the staged change in 1-2 sentences ...
6) Write the commit message
   - Use Conventional Commits (required)
   - Use `references/commit-message-template.md` if helpful.
7) Run the smallest relevant verification ...
8) Repeat for the next commit until the working tree is clean

## Deliverable
Provide: the final commit message(s), a short summary per commit, the commands used ...
```

**体现的最佳实践。**
- **按任务脆弱度校准控制强度**（*"Match specificity to fragility"*）：对提交边界拆分、`git diff --cached` 复核、Conventional Commits 格式等**脆弱且要求一致性**的步骤写成**命令式硬要求**；对如何描述变更这类可变通的环节只给原则。
- **显式检查清单**（*"Checklists for multi-step workflows"*）：8 步带依赖与验证门的流程，帮助 agent 不跳步、可追踪。
- **前置收集输入**（`Inputs to ask for (if missing)`），避免信息缺失导致返工。
- **明确的交付物定义**，让输出可验收。
- **重材料下沉**：提交信息模板放进 `references/commit-message-template.md`，正文仅在需要时指引加载，符合渐进披露。

### 例子 3：强触发门 + 脚本驱动型 —— `web-to-markdown`（来自 agent-toolkit）

**位置**：`refenerencs/agent-toolkit/skills/web-to-markdown/SKILL.md`，目录仅 `SKILL.md` + `README.md`，用外部 CLI `web2md`

**做法。** 这是一个"副作用明显、必须由用户显式点名才触发"的工具型 skill，用**硬触发门**防止误激活，并用 **非目标声明 + 完整参数矩阵 + 工作流 + 默认值** 组织正文：

```markdown
---
name: web-to-markdown
description: "Use ONLY when the user explicitly says: 'use the skill web-to-markdown ...' (or 'use a skill web-to-markdown ...'). Converts webpage URLs to clean Markdown by calling the local web2md CLI (Puppeteer + Readability), suitable for JS-rendered pages."
metadata:
  version: 0.1.0
---

## Hard trigger gate (must enforce)
This skill MUST NOT be used unless the user explicitly wrote **exactly** a phrase like:
- `use the skill web-to-markdown ...`
- `use a skill web-to-markdown ...`

## Non-goals
- Do not use Playwright or other browser automation stacks; the mechanism is `web2md`.

## Inputs you should collect (ask only if missing)
- `url` ... Output preference: `--print` / `--out ./file.md` / `--out ./some-dir/`
- Optional rendering controls: `--chrome-path`, `--interactive`, `--wait-until`, `--wait-for`, ...

## Workflow
1) Confirm the user explicitly invoked the skill ...
2) Validate URL(s) start with `http://` or `https://`.
3) Ensure `web2md` is installed: `command -v web2md`
4) Convert: single URL → file / directory / interactive / stdout / batch
5) Validate output: verify they exist and are non-empty
6) Return: the saved file path(s), or the Markdown (stdout mode).

## Defaults (recommended)
- For most pages: `--wait-until networkidle2`
```

**体现的最佳实践。**
- **description 内嵌触发约束**：用 `Use ONLY when...` 把"何时不用"也写进 description，直接压制误激活（对应 *"Optimizing skill descriptions"* 的方向）。
- **正文用硬性门禁兜底**：独立 `Hard trigger gate (must enforce)` 章节明确"MUST NOT be used unless..."，在执行层再加一道防线。
- **默认值而非选项菜单**（*"Provide defaults, not menus"*）：给出 `--wait-until networkidle2` 等推荐默认，把可选参数列为"仅在需要时收集"，避免 agent 在等价选项间犹豫。
- **非目标声明**（`Non-goals`）排除 Playwright 等替代实现，防止 agent 偏离既定机制。
- **自校验闭环**（*"Validation loops"*）：第 5 步要求验证输出文件存在且非空，错误信息可直接支撑自纠。
- **使用 `metadata` 记录版本**，展示可选字段的合规用法（`metadata: { version: 0.1.0 }`）。

**三个例子的横向对比。** `roll-dice` 证明**最小结构即可成立**，价值在精准的 description 与可直接执行的命令；`commit-work` 证明**脆弱流程需要命令式清单与显式交付物**，重材料下沉 `references/`；`web-to-markdown` 证明**高副作用工具需要触发门、非目标与自校验**，并把可选字段用于版本记录。三者共同遵循同一条主线：description 决定能否被正确激活，正文只写 agent 不知道的东西，重材料交给渐进披露。

## 五、可执行的落地清单

1. **建目录**：`<skill-name>/`，目录名与 `name` 完全一致（小写字母数字 + 连字符，无首尾/连续连字符，≤64 字符）。
2. **写 `SKILL.md`**：YAML frontmatter 只保证 `name`、`description` 两个必填字段，description 写清"做什么 + 何时用 + 触发关键词"，≤1024 字符。
3. **写正文**：分步指令 + 输入/输出示例 + 边界情况；只写 agent 不知道的专有信息，跳过通用常识；控制在 500 行 / 5000 token 内。
4. **按需分组**：可执行代码放 `scripts/`，重文档放 `references/`（单文件聚焦），模板/图片/数据放 `assets/`，用一层相对路径引用。
5. **加可选字段**：有授权需求加 `license`，有环境前提加 `compatibility`（≤500 字符），需要自定义属性加 `metadata`，需要预授权工具加 `allowed-tools`（实验性）。
6. **配校验**：用 `skills-ref validate ./my-skill` 校验格式；用真实任务跑一轮执行，把纠正与踩坑补进"Gotchas"章节，迭代收敛。

## 六、skill-focus 的安装与使用

`skill-focus` 位于 `skill-lessons/refenerencs/skill-focus/`，是一个把长文档做"穷尽、保细节、保留原文引语"的两段式抽取的 skill（FOCUS 方法）。本节说明把它安装到当前目录的方法，以及安装后如何使用。

### 1. 安装到当前目录

> 说明：本节为**安装说明**，供按需执行。当前 `skill-focus` **未做实际安装**，`.agents/skills/` 下目前只有构建的 `roll-dice`。需要使用时，按下列任一方式执行即可。

Agent Skill 没有打包安装器，"安装"就是**把 skill 目录放到 agent 的发现路径上**，让 agent 启动时能读到它的 `name` + `description`。有两层路径可选：

**方式 A：项目级安装（推荐，装进当前目录）**

在项目根目录建 `.agents/skills/`，把整个 skill 目录拷进去。这是官方 Quickstart 采用的约定，VS Code / Copilot、Codex 等兼容客户端都会扫描该路径。当前项目的安装命令（PowerShell）：

```powershell
# 在当前项目根目录创建 .agents/skills，并复制 skill-focus
New-Item -ItemType Directory -Force -Path ".agents\skills" | Out-Null
Copy-Item -Recurse -Force "skill-lessons\refenerencs\skill-focus" ".agents\skills\skill-focus"
```

**方式 B：用户级安装（全局，所有项目可用）**

放到 Codex 的全局技能目录 `$CODEX_HOME/skills/`（本机为 `C:\Users\anyda\.codex\skills\`）。该目录下的每个子目录即一个 skill，也可以用软链接指向原始位置，避免复制后不同步：

```powershell
New-Item -ItemType Directory -Force -Path "$env:CODEX_HOME\skills" | Out-Null
# 方式一：直接复制
Copy-Item -Recurse -Force "skill-lessons\refenerencs\skill-focus" "$env:CODEX_HOME\skills\skill-focus"
# 方式二：软链接（改原始文件即同步，无需重装）
New-Item -ItemType SymbolicLink -Path "$env:CODEX_HOME\skills\skill-focus" `
  -Target "D:\innate-workspace\refine-factory\innate-skills\skill-lessons\refenerencs\skill-focus" | Out-Null
```

**安装后的自检（验证已生效）。** 重启 agent（或新开一个会话）后，用下面任一方式确认 skill 已被发现：

- 在支持 `/skills` 的客户端里执行 `/skills`，列表中应出现 `skill-focus`；
- 直接对 agent 说"用 focus 方法总结这段文档"，看它是否按 FOCUS 流程（先穷尽抽取、再清洗重组）执行，而不是普通摘要。

若没被识别，优先排查三点：目录名是否与 `SKILL.md` 里的 `name` 完全一致、`SKILL.md` 是否位于 skill 目录根部、是否放在了客户端实际扫描的路径上。

### 2. 如何使用 skill

安装完成后，skill 通过**渐进披露**被使用，你不需要"手动调用文件"，只需让任务匹配到 skill 的 `description`，agent 会自动完成三阶段加载：

1. **Discovery**：agent 启动时已读到 `skill-focus` 的 `name` 与 `description`，知道它"用于对论文/报告/长文档做详尽、保细节、带原文引语的摘要"。
2. **Activation**：当你的请求命中该描述（例如"用 focus 总结这篇文档""给我一个详尽的 FOCUS 摘要""把这份报告逐节要点都抽出来"），agent 读入完整的 `SKILL.md` 正文，开始执行 FOCUS 流程。
3. **Execution**：agent 按正文执行——**Step 1 穷尽抽取**（逐节把每个要点写成带具体细节、自然嵌入原文引语的编号项）→ **Step 2 清洗重组**（去除引用标记、顶部加 3–6 句概述、按逻辑分节），**只输出 Step 2 的结果**，不展示中间过程。

**使用要点（来自 skill-focus 正文的约束）：**
- **穷尽优先于精简**：文档有 N 个要点就列 N 个，不因省篇幅而跳过；每个要点必须带具体细节（数字、效应量、样本量、方法名、对比、日期），模糊改写视为不合格。
- **引语支撑而非重复**：用直接引语更精确地传达要点，但不要"引完再用自己的话复述同一观点"。
- **不写元叙述**：不写"本节中作者认为……""下面是摘要"这类话，归属是默认的、应省略。
- **结构镜像原文**：按原文分节组织、沿用原节标题；跳过参考文献、作者信息、致谢等样板内容。
- **最终只输出 Step 2**：不展示 Step 1 中间产物，不加前言或收尾评论。

**触发示例（可直接对 agent 说）：**
- "用 focus 方法总结这份技术报告，保留所有数字和原文引语。"
- "给我这篇论文的 FOCUS 摘要，逐节覆盖，别只给要点概览。"
- "把这份长文档按 FOCUS 流程抽取，输出清洗后的最终版本。"

**与其他 skill 的协作：** skill 之间可以组合。例如先让 `skill-focus` 对一份长文档做穷尽抽取，再让另一个做"报告排版/输出格式化"的 skill 对结果套用输出模板——这正是"设计可组合的工作单元"这一最佳实践的体现。

## 七、按落地清单构建 roll-dice skill 的成果

严格套用第五节"可执行的落地清单"，在当前目录构建了官方 Quickstart 示例的 `roll-dice` skill，并配好了校验脚本。全部产物已通过校验脚本自检。

**构建产物（当前目录 `.agents/skills/roll-dice/`）。**

```
.agents/skills/roll-dice/
├── SKILL.md              # 必填：元数据 + 掷骰指令
├── README.md            # 说明用途、触发词、用法、校验方式
└── scripts/
    ├── roll_dice.py      # 掷骰脚本：范围、个数、修正值
    └── validate.py       # 零依赖格式校验脚本（对齐 skills-ref 规则）
```

**落地清单逐项对照：**
1. **建目录**：`.agents/skills/roll-dice/`，目录名与 `name` 完全一致，全小写、连字符、无首尾/连续连字符、长度合规。
2. **写 `SKILL.md`**：frontmatter 含两个必填字段。`name: roll-dice`；`description` 写清"做什么（用随机源掷骰）+ 何时用（roll a die / roll dice / d6、d20 / 多骰 / 掷骰式随机数）+ 触发关键词"，长度在 1024 以内。
3. **写正文**：分步指令（`How to roll` / `Interpreting results` / `Output format` / `Edge cases`）+ 输入输出示例（骰面记号对照表、`3d6` 输出示例）+ 边界情况（未给边数默认 d6、`d1` 拒绝、大数量汇总）。正文只写 agent 不知道的专有约定，控制在 500 行内。
4. **按需分组**：可执行代码放 `scripts/`，说明文档放 `README.md`，正文用相对路径引用（`scripts/roll_dice.py`、`scripts/validate.py`），保持一层引用深度。
5. **可选字段**：`roll-dice` 保持最小化，未加 `license`/`compatibility`/`metadata`/`allowed-tools`——符合规范"多数 skill 不需要 `compatibility`"的取舍，也是最小可用型 skill 的示范。
6. **配校验**：`scripts/validate.py` 实现官方 `skills-ref validate` 的校验规则（SKILL.md 存在、frontmatter 闭合、仅允许字段、`name` 合规且与目录名一致、`description` 非空且 ≤1024、`compatibility` ≤500），**零第三方依赖**，直接 `python scripts/validate.py .` 即可运行。

**校验结果（已实测）。**
- `python scripts/validate.py .` → `Valid skill: .../roll-dice`，退出码 `0`。
- 负例验证均正确报错并退出码 `1`：目录名与 `name` 不一致、缺少 `description`、无 frontmatter。

**掷骰脚本实测。**
- `--sides 20` → `Rolled d20: 13 = 13`
- `--sides 6 --count 3` → `Rolled 3d6: 5 + 2 + 4 = 11`
- `--sides 6 --count 2 --modifier +3` → `Rolled 2d6+3: 3 + 5 = 11`
- `--sides 1` → 拒绝并提示"a die needs at least 2 sides"，退出码 `1`

**使用方式。** 安装后（重启 agent 或新开会话使其扫描到 `.agents/skills/`），直接对 agent 说"Roll a d20""掷个 3d6""roll 2d6+3"，agent 会匹配 `description` 激活 skill，读入正文，调用 `scripts/roll_dice.py` 完成随机掷骰并按 `Output format` 返回结果。

**关于 `validate.py` 与官方 `skills-ref` 的取舍。** 官方 `skills-ref` 需 `pip install`（依赖 `click`、`strictyaml`，本机未安装）；为让 skill 开箱即用，`validate.py` 用纯标准库复刻了同样的校验规则，可直接运行。如需官方 CLI 的完整能力（`read-properties`、`to-prompt`），可另行安装 `skills-ref`：

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e "skill-lessons\refenerencs\agentskills\skills-ref"
skills-ref validate .agents\skills\roll-dice
```
