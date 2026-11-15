---
name: record-terminal-demo
description: Record a terminal demo GIF automatically with vhs, including TUI apps. Use when the user asks to 录屏 / record a CLI demo / generate an animated terminal GIF.
---

# Record Terminal Demo

用 [vhs](https://github.com/charmbracelet/vhs) 把一串终端命令录成 GIF。适合任何语言写的
CLI 工具、TUI（Python Textual、Go Bubble Tea、Node Ink 等）的使用演示——vhs 只是把命令
打字进终端再录屏，不关心命令背后是什么运行时。核心不是手写 tape，而是维护一个 JSON
步骤清单，由 `scripts/record.py` 生成 tape、渲染 GIF，并抽取关键帧供检查。

## 何时使用

- 用户要求「录屏」「录制终端动画」「做一个使用演示 GIF」
- 需要把 CLI 的 help / 下载 / 校验等流程展示在 README 或文档中
- 需要在 CI 或本机可重复地重新生成同一个 GIF
- 手头只有 CLI 的使用说明（`--help` 输出、README、命令文档），要据此编排演示

## 前置条件

三个平台通用：`vhs`、`ffmpeg`（含 ffprobe）、`ttyd`。`ffmpeg` 用于抽帧检查；
`ttyd` 由 vhs 自动拉起，不要手动启动。

- **Windows**：还需要 Git Bash。脚本会自动探测其位置（PATH 上的 `git` 反推安装
  根、PATH 上现成的 bash.exe、Program Files / x86 / 用户级 LOCALAPPDATA / scoop
  等常见安装路径），并排除 System32 与 WindowsApps 里的 WSL bash 别名，然后把
  Git Bash 注入 PATH 最前。便携版或装在特殊位置时，设 `RECORD_GIT_BASH` 指向
  bash.exe 或其目录。`uv` 仅 Python CLI 需要。
- **macOS**：`brew install vhs ffmpeg ttyd`（或各装各的）。
- **Linux**：发行版包管理器装 `ffmpeg`，`vhs`/`ttyd` 可用 brew on Linux 或参考
  各自 README 的安装方式。

字体各平台默认不同（Windows: Cascadia Mono + Microsoft YaHei；macOS: Menlo +
PingFang SC；Linux: DejaVu Sans Mono + Noto Sans CJK SC），需要覆盖时在 spec 里
显式设置 `font_family`。macOS/Linux 上脚本不会改动 PATH，环境保持原样。

## 编排步骤清单（spec 由谁写、从哪来）

spec 不是让用户手写的：由执行本 skill 的 AI 负责编排，用户只做确认。按下面四步走。

### 1. 收集素材——命令从哪里来

按可靠性从高到低取材，**禁止凭记忆编命令**：

- **实测 help（最可靠）**：实际运行 `<cli> --help` 和各子命令的 `--help`，拿到
  真实的命令拼写、子命令、flag 和输出长度。
- **用户提供的文档**：README、命令文档、使用说明。文档可能过时，只要 CLI 能跑，
  就用实测 help 校对一遍再采用。
- **仓库源码**：输入是整个仓库时，先定位 CLI 入口，再从命令定义处读——
  Python 的 argparse / typer / click，Go 的 cobra / urfave-cli，
  TS 的 commander / clipanion / yargs。

### 2. 选择录制范围——要不要选

- **命令面小**（核心命令 4 个以内）：不需要专门选，按典型顺序直接编：
  总览 help → 子命令 help → dry-run / 校验类 → 真正执行并展示产物，3–5 步
  讲完一个完整故事。
- **命令面大 / 用户明确说只录一部分 / 文档很长**：需要选择。把候选步骤列成
  清单（每步的命令、目的、预估 wait），用宿主的问答工具发起交互确认——
  Claude Code 里调用 `AskUserQuestion`（`multiSelect: true`，每个选项的
  `description` 放目的和预估 wait，`preview` 放该步的 spec JSON 片段）；
  其他宿主用等价的结构化问答工具，不要只输出一段文字等用户回复。
  用户勾选、增删或调序后确认再继续；用户取消时降级为按典型顺序全录。
- 用户直接给了命令列表时，跳过选择，直接进入下一步。

### 3. 实测耗时

每条入选命令先在本机真跑一次计时；`wait` 取实测值的 1.5 倍以上，
API / 网络步骤留更多余量。

### 4. 写 spec

落到项目根目录或 `docs/` 下（例如 `docs/demo.json`），格式（Python CLI）：

```json
{
  "output": "docs/demo.gif",
  "cleanup": "rm -rf ct-demo",
  "width": 1700,
  "height": 680,
  "font_size": 16,
  "steps": [
    {"command": "uv run cn-textbook --help < /dev/null", "wait": 3},
    {"command": "uv run cn-textbook download --help < /dev/null", "wait": 4},
    {"command": "uv run cn-textbook download --dry-run --include README.md < /dev/null", "wait": 14},
    {"command": "uv run cn-textbook download --dest ct-demo --include README.md", "wait": 15}
  ]
}
```

Go / TypeScript CLI 同理，只是换掉 command 本身：

```json
{
  "output": "docs/demo.gif",
  "cleanup": "rm -rf demo-tmp",
  "steps": [
    {"command": "go run ./cmd/tool --help < /dev/null", "wait": 4},
    {"command": "go run ./cmd/tool fetch --dest demo-tmp < /dev/null", "wait": 12},
    {"command": "npx tsx src/cli.ts --help < /dev/null", "wait": 6}
  ]
}
```

只有当某个 step 的命令里出现 `uv`（或 spec 显式设 `"require_uv": true`）时，生成的
tape 才会带 `Require uv`，因此纯 Go/Node 环境没有装 uv 也能录。

## 录制与检查

1. 运行录制并按时间点抽帧。脚本固定在本 skill 目录的 `scripts/record.py`，但 skill
   本身可能装在 `innate-skills/record-terminal-demo/`、项目
   `.claude/skills/record-terminal-demo/` 或全局
   `~/.claude/skills/record-terminal-demo/`——调用时用本 skill 实际所在的路径，
   不要假设某个固定前缀：

```bash
python <本 skill 所在目录>/scripts/record.py docs/demo.json --verify 2,14,23,29

# 例：全局安装时
python ~/.claude/skills/record-terminal-demo/scripts/record.py docs/demo.json --verify 2,14,23,29
```

`record.py` 可从任意目录调用：spec 里 `output`、`cleanup` 等相对路径基于 `--cwd`
解析（默认为当前目录），`--cwd` 也可以显式指定为项目根目录。

2. 用 Read 工具查看 `docs/frames/` 下抽出的 PNG，确认：
   - 中文没有乱码
   - 长命令没有折行
   - TUI 进度条 / 完成状态真的出现在画面里
   - 下载产物已被 cleanup 删除

   自己拿不准（比如怀疑乱码但不确定）时，把帧作为图片附给用户确认，
   不要替用户放过有问题的画面。

3. 在 README / 文档中引用 GIF。

也可以直接维护 tape：

```bash
vhs docs/demo.tape -o docs/demo.gif
```

`record.py` 会同时把生成的 tape 写到 `output` 同目录（默认文件名 `demo.tape`），便于手工微调。

## 必须遵守的坑（Windows + vhs）

1. **CursorBlink 必须开**：`Set CursorBlink true`。否则 vhs 会丢掉静止画面，
   `Sleep 30s` 在 GIF 里只剩几秒，演示看起来被快进。
2. **强制 Git Bash（仅 Windows）**：vhs 通过 ttyd 启动 shell，默认可能落到 WSL bash；
   WSL 下运行 Windows 程序后输入会卡住。`record.py` 会自动生成
   `Env PATH "...Git/usr/bin;..."` 把 Git Bash 放到最前，并保留原 PATH；
   macOS / Linux 不注入 `Env PATH`。
3. **区分 TUI / 非 TUI 命令**：
   - 非 TUI 命令加 `< /dev/null`，否则任何读取 stdin 的 CLI（Python、Go 的
     `bufio.Scanner`、Node 的 `readline` 都一样）会吞掉后续键入的字符；
   - TUI 命令**不要**加重定向，Textual / Bubble Tea / Ink 都需要 stdin 才能渲染。
4. **UTF-8**：被重定向时 Windows Python 可能回退到 GBK，中文变成乱码。
   在程序入口 `sys.stdout.reconfigure(encoding="utf-8")`，并在 tape 里
   `export PYTHONUTF8=1`。Go / Node 默认输出 UTF-8，通常无需处理。
5. **语气要留余量**：API / 网络步骤的 `wait` 至少是实测耗时的 1.5 倍；
   TUI 完成后建议在程序里停留约 1 秒再退出，否则 100% 进度条一闪而过。
6. **收尾清理**：在 spec 里设置 `cleanup`，脚本会在录制前和录制后各执行一次，
   避免演示下载的文件留在仓库里。

## 验证要点

- `ffprobe -show_entries format=duration` 的总时长应接近各 step 的 `wait` 之和；
  明显偏短通常说明 CursorBlink 没生效。
- 抽帧后检查中文、表格边框、命令是否折行。
- 若 GIF 中缺少某一步，通常是该命令的输入被上一条命令吞掉：给非 TUI 命令加
  `< /dev/null`，或在程序里关闭 bracketed paste。

## 相关文件

- `scripts/record.py` — tape 生成、渲染、抽帧
- `examples/template.json` — spec 模板
