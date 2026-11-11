# 产物规范：工件集与模板

每个克隆 app（`apps/<slug>/`）携带同一套工件骨架——`init-clone.mjs` 创建，工作流填充。

## 目录布局

```
apps/<slug>/
├── NOTES.md                 # 源信息、许可结论、预判、评分（必须有）
├── docs/
│   ├── RUNSHEET.md          # 每步 checkbox + 证据（抗压缩契约）
│   ├── research/
│   │   ├── page-brief.md    # section 顺序、排版、测量、资产映射
│   │   ├── BEHAVIORS.md     # 触发器 → 可见结果，逐交互
│   │   └── components/<name>.spec.md   # 每个委派 section 一份 spec（≤150 行）
│   └── qa/                  # 每轮迭代的对比截图
├── RECON/                   # 工具输出，作为证据保留
│   ├── original-recon.json / clone-recon.json / *-summary.md
│   ├── screenshots/  routes/  interactions/  network/  sourcemaps/  assets/
│   └── diff.json / diff.png # visual-diff 输出
├── site/                    # 镜像产物（仅镜像路径）
├── CLONE_REPORT.md          # compare-recon 输出 + 人工批注
└── CLONE_AUDIT.md           # audit-clone 输出（交付前残留检查）
```

## RUNSHEET.md 模板

```markdown
# RUNSHEET — <slug>
| # | 步骤 | 完成 | 证据（路径 / 命令 / 分数） |
|---|------|------|----------------------------|
| 1 | init + 许可结论 | [ ] | |
| 2 | 侦察原站 | [ ] | RECON/original-recon.json |
| 3 | 定级 L? + 模式 | [ ] | NOTES.md 预判 |
| ... |
```
每个工作流步骤一行，证据必填。上下文压缩后重读；不要凭记忆相信未勾的框。

## 组件 spec 模板（docs/research/components/<name>.spec.md）

```markdown
# <Section 名>
## DOM 结构        （嵌套大纲，真实 class 提示）
## Computed styles （精确值：font、color、bg、gap、padding、radius、transform…）
## States & behaviors（触发器 → 前值/后值 → transition；hover/focus/active/scroll）
## 内容            （逐字文案）
## 资产            （源 URL → 本地路径、尺寸、裁剪）
## 断点            （每个宽度变什么）
```
超 ~150 行必须拆分。spec 是 builder 的唯一事实源；builder 的问题从 spec 找答案，不靠记忆。

## CLONE_REPORT.md

由 `compare-recon.mjs` 自动生成；人工追加一节：验证了什么、没验证什么、剩余差距、法务备注。绝不删工具的数字——只能批注。
