# README



这是一个SKILL使用评测的目录，会根据不同的Topic来评测不同SKILL使用情况. 基本原则：

1.  SKILL 目录是放到references里面
2.  docs目录按照topic分类，比如ui-ux的就在ui-ux 目录
3. 在每一个topic目录中每一个SKILL的使用都在对应的SKILL名称的目录中，保留测试的目录，结果内容，还有分析这个SKILL的内容，都在一个目录中
4. 所有的SKILL使用，安装都统一在这个目录

## references 三分层结构与 registry（spark repo scan + pre-commit）

`references/` 按**三分层**组织：分类与子分类目录入库，项目本体（开源 clone）**不入库**：

```text
references/
├── skills/                 # 一级 = 分类（入库）
│   ├── agent/              # 二级 = 子分类（入库，.gitkeep 标记）
│   │   └── taste-skill/    # 三级 = 开源项目（gitignore 忽略，不入库）
│   └── others/             # 没有子分类的项目放这里（每个分类恒有 others）
├── products/others/        # 二级分类：products
└── plugins/others/         # 二级分类：plugins
```

- **刻意不用 submodule / 不建 `.gitmodules`，项目也不以 gitlink 记录**——参考仓数量多、
  内容体量大，登记与同步开销都过高。来源统一记在根目录
  [`registry_references.yaml`](./registry_references.yaml)（**version 2 分类格式**：
  `categories → subcategories → projects`，每条 `name / repo / path`；没有子分类的
  项目归 `others`；完全没有一级分类目录的普通目录仍写旧扁平 `projects:` 格式）。
- 恢复：`spark repo clone -f registry_references.yaml`——按 `path` 还原，
  先克隆父项目、再克隆其内部的嵌套仓。
- 新增/删除项目由 pre-commit 钩子自动扫描并**随同一次提交**更新该 registry。

用 pre-commit 钩子自动生成并**随同一次提交一起入库**（一次性启用）：

```bash
git config core.hooksPath .githooks     # 启用 .githooks/pre-commit
spark repo scan references              # 手动生成/校验 registry
```

- 触发条件：本次提交涉及 `references/**`（增/删/改名）或 registry 缺失；约 0.4s，
  幂等，重扫会同步删除已移除的仓。
- `spark` 未安装或扫描失败时**告警但不阻断提交**（registry 事后可补）。
- 局限：registry 只收录**带 origin remote 的 git 仓**；无 origin 的普通目录不入册
  ——历史已入库的本仓自有内容（`references/skills/dev-tool/clone-website`）用
  `git add -f` 保持入库，新放入的普通目录默认被忽略；`core.hooksPath` 是本地配置，
  每个 clone 需自己执行一次上面那条命令。

## 统一落点

按以上原则归档试用记录的全局 skill：[rules/skill-eval/](rules/skill-eval/)。
装到任意项目的 skills 目录后，`init` 一键生成 `references/<skill>/` 与
`docs/<topic>/<skill>/`（tests/ + results/ + analysis.md），不同项目、不同 Agent
写入同一个 skill-management 目录。
