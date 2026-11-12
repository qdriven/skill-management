# clone-website skill 修改清单（TODO）

> 来源：`references/clone-skill/ai-website-cloner-template/.agents/skills/clone-website/`
> （v0.6.1 canonical skill，2026-10-22 中英双语副本入库）。
> 分析依据见 [tasks/task1-monorepo-plan.md](../../tasks/task1-monorepo-plan.md)。
>
> **状态：2026-10-22 全部执行完毕**（P3-16 裁剪项确认不引入）。执行记录见各项括号内说明。

## P0 — 不改就无法在本工作台使用 ✅

1. ✅ **路径约定适配 workspace**：SKILL 全面改写为「一站一 app」——`apps/<slug>/`（init-clone 创建），
   克隆产物（RECON/docs/site）都在 app 内；`<site>` 命名空间仅保留给「用户明确要求合并多 origin」场景。
2. ✅ **接入 clone-tools 工具链**：新建 `packages/clone-tools`（12 个脚本，win32 适配：
   playwright-loader 重写为 env→包内→workspace 根解析 + Chrome channel 回退；init-clone 输出
   `apps/<slug>`；mirror-site 提示改 `npx serve`）。SKILL 第 1/3/5 节嵌入具体命令，
   验收采用「脚本量化初筛（visual-diff/compare-recon）+ agent 审计终审（双审计循环）」。
3. ✅ **触发词补中文**：frontmatter description 已含「复刻网站、克隆网站、仿站、抄个站、
   照着这个站做一个、还原网页效果/交互、把网站搬下来」+ 英文触发词。

## P1 — 流程缺口 ✅

4. ✅ **前置决策层（SKILL 第 1 节）**：先找真源码（gh search / sourcemap-hunt）→ recon-site 基线 →
   L1-L6 定级 + 四模式（忠实/视觉/爆改/拆解，详见 references/assessment）→ 六分支路径决策表
   （源码重建 / mirror-site 镜像 / 框架重建 / API fixtures / WebGL 逆向 / 现成主题）。
5. ✅ **静态站镜像捷径**：决策表分支 + references/static-mirror（mirror-site 用法、
   wget 局限、字体自托管/删追踪收尾、验证标准）。
6. ✅ **license 纪律**：SKILL 第 0 节第 1 条——无许可 = 仅本地学习不得公开部署，结论记 NOTES.md；
   交付前必跑 audit-clone。
7. ✅ **产物规范落地**：init-clone 一次建齐 RECON/ 子目录；references/deliverables 定义完整工件集
   （NOTES/RUNSHEET/spec/CLONE_REPORT/CLONE_AUDIT）+ 模板，兼作抗上下文压缩。

## P2 — 施工深度 ✅

8. ✅ **spec 文件制度**（SKILL 第 4 节）：`docs/research/components/<name>.spec.md`（DOM/computed
   styles/States & Behaviors/逐字文案/资产/断点），超 ~150 行强制拆分，spec 是 builder 唯一事实源。
9. ✅ **交互模型判定先行**（SKILL 第 1 节末 + field-notes）：scroll/click/time 驱动判定先于布局工作。
10. ✅ **RUNSHEET 抗压缩契约**（SKILL 第 0 节第 3 条 + deliverables 模板）：每步 checkbox + 证据行，
    压缩后必重读。
11. ✅ **双审计迭代闭环**（SKILL 第 5 节）：像素保真 + 行为保真两轮审查，只找错不表扬，
    连续两轮零 findings + 生产构建通过才算完成。
12. ✅ **Field Notes 并入**：references/field-notes（favicon 铁律、URL 扩展名撒谎、_next/image HTML 壳、
    分层资产、动画 SVG 依赖、Lenis、pinned 时长、视频伪装、isTrusted、console 干净、Tailwind outerHTML）。

## P3 — 环境与维护 ✅

13. ✅ **Windows 适配**：`npx serve` 替代 `python3 -m http.server`；loader 去除 macOS 路径；
    audit-clone 日文假名检查保留（按需忽略，目标站非日文时无噪音）。
14. ✅ **双语维护策略**：英文 canonical / 中文译本，两版顶部互链；TODO 与本策略随文件维护。
15. ✅ **references 扩充**：新增 assessment / deliverables / field-notes / static-mirror 四篇双语
    （提炼自 claude-skill-web-clone 的方法论 + claude-code-clone-website-skill 的事故经验），
    与原 inspection-guide / framer-and-motion 共 6 篇。
16. ✅ **按需裁剪**：Cloudflare 部署与 Meta Pixel add-on 确认不引入（工作台仅本地运行）；
    Playwriter 专属内容不引入（驱动方式为 playwright/chrome channel）。

## 双语文件对照

| 英文（canonical） | 中文 |
| --- | --- |
| `SKILL.md` | `SKILL.zh-CN.md` |
| `references/inspection-guide.md` | `references/inspection-guide.zh-CN.md` |
| `references/framer-and-motion.md` | `references/framer-and-motion.zh-CN.md` |
| `references/assessment.md` | `references/assessment.zh-CN.md` |
| `references/deliverables.md` | `references/deliverables.zh-CN.md` |
| `references/field-notes.md` | `references/field-notes.zh-CN.md` |
| `references/static-mirror.md` | `references/static-mirror.zh-CN.md` |

## 首次实战测试（2026-10-22，learn-arduino-red）暴露的工具改进项

> **状态：2026-11-02 全部执行完毕**。四项均在 `packages/clone-tools/scripts/` 落地，
> 新增共用等待模块 `scripts/lib/settle.mjs`。

- [x] **interaction-probe 截图加 label 前缀**：截图文件名不含 label，同一 outdir 下第二轮
  （clone）覆盖第一轮（original）的截图。`scripts/interaction-probe.mjs`。
  → 截图名改为 `<label>-<序号>-<action>-<hash>.png`，初始截图为 `<label>-00-initial.png`，
  original / clone 两轮可共存于同一 outdir。
- [x] **"启动序列型 SPA"截图对齐**：recon-site/interaction-probe 的 `--wait` 是盲等，
  该类应用（learn-arduino-red 启动时逐课绘制 3D）需要等加载覆盖层消失再截图
  （可加 `--settle-text <text>`：等到 body 不含指定文本）。实测默认 wait 拍到加载画面，
  两侧必须用 `--wait 9000` 才对齐。
  → 新增 `--settle-text <text>`（recon-site 与 interaction-probe 均支持）与
  `--settle-timeout <ms>`（默认 20000）；轮询等待文本消失后再截图，超时给出告警而非静默失败。
- [x] **interaction-probe 每动作复用页面**（可选）：当前每动作新开页面导致启动序列重放，
  changed 判定被污染；单页应用可加 `--reuse-page` 模式。
  → 新增 `--reuse-page`：全程复用同一页面，启动序列不再重放，changed 判定保持准确。
- [x] **audit-clone 的 GA 检查去误报**：压缩标识符 `ga(`/`Ga(` 触发命中；
  改为匹配 `googletagmanager|google-analytics|gtag(` URL 字符串而非裸函数名。
  → 追踪规则改为按主机名与调用特征匹配（`google-analytics.com`、`googletagmanager.com`、
  `gtag(`、`analytics.js`），移除裸 `ga(` / `hj(` 标识符匹配。
  实测：压缩 bundle 中的 `ga(`/`Ga(` 不再误报，真实 GA 残留仍被捕获。
