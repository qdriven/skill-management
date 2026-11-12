# 静态镜像配方（L1/SSG 站）

适用于静态构建站（Astro / Vite SSG / Hugo / 纯静态导出），目标是保真时使用。部署资产**就是**真相：原样放到 web 根下服务，跑的就是真代码——连原站 bug 都一并还原。

## 为什么不用 wget

运行时才 fetch 的二进制（`.sog/.buf/.wasm/.riv`）由 JS 按滚动进度请求——`wget --mirror` 永远看不到。`mirror-site.mjs` 驱动真浏览器、滚完全页、捕获**每一个** response，再用浏览器网络栈（同 cookie/代理）按原路径重下同源资产。

## 步骤

```bash
# 1. 镜像（仓库根运行）
node packages/clone-tools/scripts/mirror-site.mjs --url <url> --out apps/<slug>/RECON/mirror
# 产物: RECON/mirror/site/（作为 web 根服务）, mirror-manifest.json,
#       own-asset-urls.txt, third-party.json

# 2. site/ 内手工收尾
#    a. 自托管锁域名 webfont: third-party.json 的 webfont_css_to_selfhost
#       （Typekit kit.css / Google fonts CSS）。下载 CSS，抠出 woff2/woff/otf
#       （按魔数判断），把 @import 改写为本地副本。
#    b. 删追踪（GA/gtag/fbq/hotjar/clarity）——audit-clone.mjs 会帮你找。
#    c. 公共 CDN 引用可以留在在线；在 NOTES.md 里披露。

# 3. 服务 + 验证
cd apps/<slug>/RECON/mirror && npx serve site -l 8124
# console 必须干净；用 visual-diff.mjs 对照源站
```

## 验证

hero 与每个 section 对源站做像素对比（同视口/同状态）。良好的 L1 镜像 diff 比率应在 ~1% 以下。分数记入 NOTES.md。追踪/品牌残留：跑 `audit-clone.mjs --project apps/<slug> --brand "<站名>"`。

SKILL 第 0 节的许可纪律完全适用：完美的镜像就是完美的拷贝——无许可 = 仅限本地学习。
