---
name: skill-eval
description: 把 SKILL 试用记录写入统一的 skill-management 目录（references/ + docs/<topic>/<skill-name>/），不同项目、不同 Agent 共用同一个落点。Use when the user asks to 试用/评测一个 SKILL、记录 skill 使用情况、归档 skill 测试结果 / record a skill trial / log skill usage.
---

# Skill Eval

按 skill-management 仓库 README 的三条基本原则，把一次 SKILL 试用完整归档到同一个地方：

1. 被试 SKILL 的目录放到 `references/<skill-name>/`
2. `docs/` 按 topic 分类（如 ui-ux）
3. 每个 topic 下每个 SKILL 的试用放在 `docs/<topic>/<skill-name>/` 一个目录里，测试的目录、
   结果内容、分析都在其中

核心不是替用户评测 skill，而是**落点统一**：不管在哪个项目、用哪个 Agent 试用，记录都
写进同一个 skill-management 目录，事后可横向对比。

## 何时使用

- 用户要试用 / 评测一个 SKILL，并保留测试过程、结果与分析
- 用户要把 skill 测试结果归档到统一位置 / 同一个地方
- 多个项目、多个 Agent 试用 skill，需要共用一套可比较的记录目录

## 前置条件

- Python 3.8+（脚本只用标准库，无第三方依赖）
- 一个 skill-management 仓库的本地 clone（共享落点）。没有现成的就先 clone 或 `git init`
  一个，README 里带上「SKILL使用评测」字样即可被自动识别

## 定位共享目录（所有命令的第一步）

`scripts/skill_eval.py` 按以下顺序解析共享目录，找不到就报错退出：

1. 命令行 `--root`
2. 环境变量 `SKILL_EVAL_ROOT`
3. `~/.skill-eval-root` 文件（一行目录路径）
4. 从当前目录向上自动探测（README 含「SKILL使用评测」，或存在 `docs/` + `references/`）

跨项目、跨 Agent 稳定复用的推荐做法——**一次性持久化**：

```bash
python <本 skill 所在目录>/scripts/skill_eval.py root --set /path/to/skill-management
```

之后所有项目、所有 Agent 不用再传 `--root`。skill 本身装在项目 `.claude/skills/`、全局
`~/.claude/skills/`、还是别的 skills 目录都行——脚本固定在本 skill 目录的
`scripts/skill_eval.py`，调用时用实际路径，不要假设某个固定前缀。

## 工作流程

### 1. 确认三要素

- **topic**：试用归到哪个主题（`ui-ux`、`research`、`cli`…），小写 slug
- **skill name**：被试 SKILL 的目录名（其 SKILL.md 的 `name`），小写 slug
- **skill 源目录**：本机哪里拿得到这个 skill（用户全局 skills、项目 skills、或 git 仓库
  clone）。拿不到源目录也可以继续，之后手工补进 `references/<skill>/`

用户已明确给出的不要重复问；缺的用宿主的问答工具确认——Claude Code 里调用
`AskUserQuestion`（`multiSelect: false`），其他宿主用等价的结构化问答工具，不要只输出
一段文字等用户回复。

### 2. 脚手架

```bash
python <本 skill 所在目录>/scripts/skill_eval.py init \
  --topic ui-ux --skill some-skill --skill-src ~/.claude/skills/some-skill
```

- `--skill-src` 把被试 skill 目录复制进 `references/<skill>/`（自动排除 `.git`、
  `__pycache__`、`.venv`、`node_modules`）；已存在时不覆盖，`--force` 才刷新
- 生成 `docs/<topic>/<skill-name>/`，内含 `tests/`、`results/`、`analysis.md`
  （analysis.md 由 `examples/analysis-template.md` 填好 skill/topic/日期生成）
- **幂等**：重复跑 init 不破坏已有内容，analysis.md 已存在则保留

### 3. 执行试用

按被试 skill 自己的 SKILL.md 正常试用。试用过程产生的脚本、输入、中间产物放
`tests/`，最终结果放 `results/`。相对路径以 `docs/<topic>/<skill-name>/` 为基准。

### 4. 写分析

按 `analysis.md` 的四个小节补全（`<...>` 占位提示全部落实）：

- **试了什么**：场景、输入、步骤，可复现材料指向 `tests/`
- **结果**：结论性输出摘录，完整产物指向 `results/`
- **分析**：skill 本身的质量——指令是否清晰、脚本是否好用、边界和坑、适用场景
- **结论**：`adopt` / `adapt` / `skip` 一句话理由

### 5. 验证收尾

```bash
python <本 skill 所在目录>/scripts/skill_eval.py check --topic ui-ux --skill some-skill
```

输出 `0 missing piece(s)` 才算完成。不带参数的 `check` 会全量巡检所有试用记录。

## 跨 Agent 使用

- SKILL.md 是通用技能格式：Claude Code、Codex、Cursor 等只要识别 skills 就能加载本 skill；
  不识别 skill 的宿主可直接读 SKILL.md 按步骤执行
- 脚本是纯标准库 Python，Windows / macOS / Linux 通吃，任一 Agent 用 `python` 直接调
- 共享目录用 `~/.skill-eval-root` 持久化后，各 Agent 读到的是同一个落点，无需重复配置
- 交互确认用宿主的等价工具（见工作流程第 1 步），不要绑定某个宿主的专有工具名

## 必须遵守的坑

1. **slug 约束**：topic 与 skill 名只允许字母、数字、`. _ -`，且以字母数字开头。中文名
   报错是故意的——目录名要跨平台、跨 Agent 稳定；中文标题写进 analysis.md。
2. **analysis.md 不覆盖**：init 幂等保护已有分析。重做同一 skill 的试用属于一次新记录，
   应换 topic 或先与用户确认怎么处理旧目录，不要 `--force` 硬刷新用户写过的内容。
3. **大文件**：`results/` 放代表性产物（截图、GIF、日志节录）；大二进制、构建产物留在原
   项目，analysis.md 里记路径即可，别往仓库里搬。
4. **UTF-8**：脚本入口已 `reconfigure(encoding="utf-8")`；自己另写文件到本目录时也统一
   UTF-8，避免 Windows 下 GBK 乱码。
5. **不要替用户下结论**：分析里区分「结果是什么」和「我认为怎样」，结论一栏留给用户拍板。

## 验证要点

- `python .../scripts/skill_eval.py root` 打印出预期的 skill-management 目录
- `check --topic T --skill S` 输出 `0 missing piece(s)`，退出码 0
- `docs/<topic>/<skill-name>/` 三件套齐整：`tests/`、`results/`、`analysis.md`
- `references/<skill-name>/` 里能看到被试 skill 的 SKILL.md

## 相关文件

- `scripts/skill_eval.py` — root / init / check 三个子命令
- `examples/analysis-template.md` — analysis.md 模板（init 自动生成用）
