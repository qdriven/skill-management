# Archify 分析

使用 [archify](https://github.com/tt-a1i/archify) skill 对 archify 仓库本身做的架构分析，聚焦其发布包 `archify/` 与图表生成流水线。

- [交互式架构图](./.archify/architecture-archify-20261102-144010/archify-architecture.html)
- [候选 JSON](./.archify/architecture-archify-20261102-144010/candidate.json)

## 结论

Archify 不是让模型直接画图的工具。它把图定义收敛为受 JSON Schema 约束的 JSON-IR，再由确定性渲染器、Git 证据校验和交付门禁生成可独立打开的交互式 HTML。

## 技术栈

- Node.js ≥18 ESM，渲染与校验运行时零第三方依赖
- JSON Schema 定义 10 种图的 IR，构建期生成独立校验器
- SVG 由类型渲染器生成，HTML 内嵌原生 JS/CSS Viewer
- Headless Chrome 做多视口、双主题的自动检查

## 核心模块

- `bin/`：命令路由与 `finalize` 编排
- `renderers/`：10 个类型渲染器 + 共享布局/路由/几何
- `schemas/` 与 `references/`：IR 契约与代理写作规范
- `explainer/`、`locales/`、`brand-marks/`：一页解释、国际化、品牌

## 生成要点

- LLM 只产出候选 JSON；路由、标签与几何由确定性渲染器计算
- 仓库事实绑定到固定 commit 的 `path/line`，逐条校验
- `finalize` 四道门：validate → deliver → check → browser-check
- 原子写入与回执，失败不覆盖已交付产物
