---
name: clone-website
description: 将现有网页重建为可运行的本地代码，匹配其真实内容、资产、响应式布局与交互。适用于网站克隆、复刻、逆向，包括 Framer 站点与动效页面。中文触发词：复刻网站、克隆网站、仿站、抄个站、照着这个站做一个、还原网页效果/交互、把网站搬下来。English triggers: clone, replicate, rebuild, reverse-engineer a website.
---

# 克隆一个网站（工作台版）

> English version: [SKILL.md](SKILL.md) · 修改清单：[TODO.md](TODO.md)

在 workspace 内重建目标站点。一站 = 一个 app，放在 `apps/<slug>/`（由 `init-clone` 创建）。先匹配源站，再考虑任何新的设计方向。交付可运行、可编辑的代码或忠实的静态镜像：截图、iframe、下载的生产构建包只是参考，不是实现。

**下文所有路径相对 workspace 根；所有工具都在仓库根运行。** 工具在 `packages/clone-tools/scripts/`（node >= 18，playwright 在 Windows 上自动回退本机 Chrome）。

## 0. 契约与护栏

1. **许可先行。** 提取任何东西之前，先确认站点许可（仓库 README、站点页脚、条款页）。**无许可 = 保留所有权利：仅限本地学习，不得公开部署。** 结论记入 `apps/<slug>/NOTES.md`。任何交付前跑 `audit-clone.mjs`——它会标记追踪脚本与品牌残留。
2. **真源码至上，绝不信 AI 推测的代码。** 优先找真源码（GitHub、sourcemap）而非重建；任何概念级分析，抄之前必须逐行对真源码核实。证据分级 `SOURCE`（真代码/真字节）、`PARTIAL`（有名有姓但未核实）、`GUESS`（视觉拟合）。绝不把 GUESS 当完成。
3. **RUNSHEET 契约。** 动工前建 `apps/<slug>/docs/RUNSHEET.md`：每步一个 checkbox + 证据行。上下文每次被压缩后重读；随做随更。没有证据的声明不算完成。
4. **不越界。** 不做数据库、后台、CMS、线索存储、部署，除非明确要求。本地构建通过是默认终点线。

## 1. 决策：找源码、定级、选路径

自上而下执行，不许跳到构建。

1. **先找真源码。** `gh search repos` / 网络搜索该项目；用 `sourcemap-hunt.mjs` 查线上 `.map` 文件。找到且许可兼容 → 从源码构建（保真度最高），跳过重度侦察。
2. **侦察。** 基线必跑：
   ```bash
   node packages/clone-tools/scripts/recon-site.mjs --url <url> --out apps/<slug>/RECON --label original
   ```
   按信号加跑：多页面 → `route-crawl.mjs`；交互/动画 → `interaction-probe.mjs`；SPA/API 数据 → `network-capture.mjs`；资产 → `asset-harvest.mjs`；bundle → `sourcemap-hunt.mjs`。
   对带加载遮罩或逐帧启动序列的应用，给 `recon-site` 与 `interaction-probe` 都传 `--settle-text "<加载文案>"`，等遮罩消失后再截图，而不是拍到加载画面。单页应用给 `interaction-probe` 加 `--reuse-page`，避免启动序列逐动作重放导致 changed 判定失真。
3. **定级与选模式**（L1-L6、四种模式、评分——见 [assessment](references/assessment.zh-CN.md)）。把复刻前预判（哪些可高保真、哪些近似、哪些不做）写进 NOTES.md。
4. **选路径：**

| 信号 | 路径 |
|---|---|
| 有真源码 | 在 `apps/<slug>` 从源码重建 |
| 静态构建站（Astro/Vite SSG/Hugo），目标是保真 | `mirror-site.mjs` 1:1 镜像——见 [static-mirror](references/static-mirror.zh-CN.md) |
| 框架 SPA（React/Next/Vue），需要可编辑 | 重建：走下面 2→5 节 |
| SaaS/登录态应用，只做展示层 | 重建外壳 + `network-capture` 做 API fixtures |
| WebGL/canvas 特效为核心 | 深度逆向纪律——真 shader/真源码，绝不臆造 |
| 有现成开源主题 | 用主题，替换内容 |

**交互模型判定先于任何布局工作：** 先判定每个动效 section 是滚动驱动还是点击驱动（跑 `interaction-probe`，检查原生输入）。把滚动驱动的 section 做成点击驱动，得到的是另一种产品——这是最贵的错误，所以放在最前面犯不得。

## 2. 梳理工作

阅读本 skill 约定与已有 `apps/*` 路由。在 NOTES.md 记录简短的 源 URL → 本地目的地 映射，以及每个页面拥有哪些文件。

- 克隆产物都在 app 内：`RECON/`（证据）、`docs/`（RUNSHEET、研究简报、spec）、`site/`（镜像产物）或 app 源码本身。
- 不同 origin 用**独立 app**——这是本工作台的默认。合并站点（仅被要求时）需要各自的路由前缀，字体/样式/布局做作用域隔离。
- 同一 origin 多页面保留源 pathname；query/fragment 变体是同一路由的状态——复现这些状态。
- 克隆 app 初始只有 NOTES/RECON，没有可替换的模板首页。
- 与框架语法冲突的 URL 段（`_`、`@`、方括号）按框架机制转义，然后验证真实请求仍可解析。

每个请求的 URL 都有目的地、文件归属清晰时，本节完成。

## 3. 先观察，后构建

在桌面与移动宽度下检查整个页面。从头滚到底加载懒加载媒体并显示 sticky/pinned 场景。然后逐一尝试菜单、tab、折叠面板、轮播、hover 状态与主要链接。区分由**滚动、点击、hover 或时间**驱动的变化。

把每次观察视为某条**规则**的一次采样。读声明值（computed styles、CSS 变量、动画库的运行时 options），而不是从一次渲染推断；变换视口宽度（包括比设计更宽）、高度、输入与状态，直到弄清每个变化由什么驱动。用访客的方式驱动页面（滚轮、触摸、键盘、指针）；脚本化滚动会绕过挂在这些输入上的行为，例如平滑滚动。

保存源站截图并标注视口、滚动位置与交互状态（RECON/screenshots）。在 `docs/` 保留一份紧凑页面简报：section 顺序、排版、布局测量、资产映射、交互。提取细节见 [inspection-guide](references/inspection-guide.zh-CN.md)；Framer/sticky/reveal 页面见 [framer-and-motion](references/framer-and-motion.zh-CN.md)。

使用源站的真实文本与其实际加载的文件（字体、图片、SVG、视频）。同名替代品度量不同。跟踪 源 URL → 本地路径 并验证 content type/尺寸：`.png` 的 URL 可能返回 AVIF；HTTP 200 也可能是错误页。已知事故模式见 [field-notes](references/field-notes.zh-CN.md)。

每个 section 与有意义的状态都有足够证据、不可得细节已识别时，本节完成。庞大的 DOM dump 不能代替看页面。

## 4. 构建完整的第一遍

先确立字体、页面宽度、颜色、资产、路由、页面级行为与共享组件——每个共享组件带上观察到的全部状态（hover、focus、断点）构建，让后续 section 原样复用。布局/简单动效优先 CSS；源行为需要时才引入动画库。

**Spec 文件是委派施工的唯一事实源。** 每个独立 section 写 `docs/research/components/<name>.spec.md`：DOM 结构、精确 computed styles、States & Behaviors（触发器 → 前值/后值 → transition）、逐字文案、资产、断点。**spec 超 ~150 行必须拆分。** 给 builder 内联 spec + 截图 + 资产路径 + 目标文件 + 明确完成线。顺序：基础层先行，然后各 section（共享文件有归属后可并行），最后页面组装。

重建范围内的交互；可见控件必须兑现承诺。范围外外链继续指向源站并披露。每完成一个集成切片跑一次构建检查。

## 5. 对比、修复、重复

在**相同视口、滚动位置与状态**下打开源/本地。等字体、媒体与 reveal 稳定。审查第 3 节发现规则变化的每一处，外加一个比设计更宽的视口。并排蒙太奇定位漂移；全尺寸 section 确立细节。

**量化初筛：**
```bash
node packages/clone-tools/scripts/visual-diff.mjs --original <src.png> --clone <local.png> --out apps/<slug>/RECON/diff.json --diff apps/<slug>/RECON/diff.png
node packages/clone-tools/scripts/compare-recon.mjs --original apps/<slug>/RECON/original-recon.json --clone apps/<slug>/RECON/clone-recon.json --visual-diff apps/<slug>/RECON/diff.json --out apps/<slug>/CLONE_REPORT.md
```

先修最大的可见差异：几何、缺失 section/图层、排版/换行、资产裁剪——再修间距与动效。在初始、激活、稳定三态下对比动效区域，含反向滚动。

**双审计循环：** 跑两轮审查——一轮像素保真（字型、间距、颜色、裁剪、断点），一轮行为保真（研究笔记里记录的每个交互真实操作一遍）。两轮都「只找错，不表扬」。合并成 fix list（首屏优先，一条不落），修复，复验。**完成 = 连续两轮零 findings + 生产构建通过 + 渲染对比完成。** 精确陈述剩余差异，不把未验证的结果称作像素级完美。

## 6. 审计与交付

```bash
node packages/clone-tools/scripts/audit-clone.mjs --project apps/<slug> --brand "<源站名>" --out apps/<slug>/CLONE_AUDIT.md
```

处理追踪/品牌残留。然后交付：预览/运行说明、源→本地路由映射、有代表性的桌面/移动对比、实际运行过的检查、剩余视觉/功能差距、NOTES.md 中的许可/署名记录。用证据回填 NOTES.md 评分。产物模板见 [deliverables](references/deliverables.zh-CN.md)。
