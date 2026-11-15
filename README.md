# README



这是一个SKILL使用评测的目录，会根据不同的Topic来评测不同SKILL使用情况. 基本原则：

1.  SKILL 目录是放到references里面
2.  docs目录按照topic分类，比如ui-ux的就在ui-ux 目录
3. 在每一个topic目录中每一个SKILL的使用都在对应的SKILL名称的目录中，保留测试的目录，结果内容，还有分析这个SKILL的内容，都在一个目录中
4. 所有的SKILL使用，安装都统一在这个目录

## 目录结构（2026-11 现状）

```text
innate-skills/
├── personal/               # 个人 skill 与内容（自有，入库）
│   ├── content/            #   内容清单（x-list 等）
│   ├── rules/              #   规则类 skill（skill-eval）
│   └── tools/              #   工具类 skill（innate-daily、record-terminal-demo、spark-cli 副本）
├── references/             # 三分层参考仓 + registry（见下节）
├── docs/                   # 按 topic 的试用记录与研究笔记（edu / research / skills / ideas.md）
├── registry_references.yaml
└── README.md
```

- `personal/` 里的 skill 都从仓库根目录 / innate-apps 迁入；其中**整仓搬入的独立
  git 仓**（fire-skills、devops-skill、figures-skill、fin-skills、presentation-skills、
  wip-skills）**不入库**——它们的 `.git` 是唯一本地历史（原件已从 innate-apps 移除），
  整目录在 `.gitignore` 里忽略，上游在各自 GitHub 仓。
- 原 `wip/` 已并入 `references/skills/agent/anti-hallucination-gates/`，不再有 wip 目录。
- `personal/tools/spark-cli/` 是 [spark-cli 仓](https://github.com/variableway/spark-cli)
  skill 的副本，SKILL.md 内含与源仓同步的维护规则。

## references 三分层结构与 registry（spark repo scan + pre-commit）

`references/` 按**三分层**组织：分类与子分类目录入库，项目本体（开源 clone）**不入库**：

```text
references/
├── skills/                 # 一级 = 分类（入库）
│   ├── agent/              # 二级 = 子分类（入库，.gitkeep 标记）
│   │   └── foshuo/         # 三级 = 开源项目（gitignore 忽略，不入库）
│   └── others/             # 没有子分类的项目放这里（每个分类恒有 others）
├── products/others/        # 二级分类：products
└── plugins/others/         # 二级分类：plugins
```

- **刻意不用 submodule / 不建 `.gitmodules`，项目也不以 gitlink 记录**——参考仓数量多、
  内容体量大，登记与同步开销都过高。来源统一记在根目录
  [`registry_references.yaml`](./registry_references.yaml)（**version 2 分类格式**：
  `categories → subcategories → projects`，每条 `name / repo / path`；没有子分类的
  项目归 `others`；完全没有一级分类目录的普通目录仍写旧扁平 `projects:` 格式）。
- 恢复：`spark repo clone -f registry_references.yaml` 全量还原（按 `path`，先父项目
  后嵌套仓）；**只补缺失**用 `spark repo clone-registry registry_references.yaml`
  （v0.4.0+，registry 文件是位置参数，目标目录由文件位置推导，`--dry-run` 先看计划）。
- 新增项目由 pre-commit 钩子自动扫描并**随同一次提交**更新该 registry；删除条目
  不自动化——spark v0.3.4 起 scan 是**合并非替换**，本地未 clone 的条目原样保留
  （registry 兼作恢复记录），要移除某仓只能手工编辑 registry 文件。

用 pre-commit 钩子自动生成并**随同一次提交一起入库**（一次性启用）：

```bash
git config core.hooksPath .githooks     # 启用 .githooks/pre-commit
spark repo scan references              # 手动生成/校验 registry
```

- 触发条件：本次提交涉及 `references/**`（增/删/改名）或 registry 缺失；约 0.4s，
  幂等；重扫合并非替换——本地缺失的条目保留，删除条目需手工编辑。
- `spark` 未安装或扫描失败时**告警但不阻断提交**（registry 事后可补）。
- 局限：registry 只收录**带 origin remote 的 git 仓**；无 origin 的普通目录不入册
  ——本仓自有内容（`references/skills/dev-tool/clone-website`、
  `references/skills/agent/anti-hallucination-gates`）用 `git add -f` 保持入库，
  新放入的普通目录默认被忽略；`core.hooksPath` 是本地配置，
  每个 clone 需自己执行一次上面那条命令。

## 统一落点

按以上原则归档试用记录的全局 skill：[personal/rules/skill-eval/](personal/rules/skill-eval/)
（2026-11 从仓库根目录 `rules/` 迁入 `personal/`）。
装到任意项目的 skills 目录后，`init` 一键生成 `references/<skill>/` 与
`docs/<topic>/<skill>/`（tests/ + results/ + analysis.md），不同项目、不同 Agent
写入同一个 skill-management 目录。
