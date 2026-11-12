# RefDock — GitHub → references 一键 clone 浏览器插件

在 GitHub 页面上直接把仓库 clone 到本仓 `references/` 对应类别目录的浏览器插件 +
本地伴侣服务。Chrome / Edge (Manifest V3)。

## 组成

```
ref-dock/
├── extension/        浏览器插件 (MV3, 无构建步骤, 纯静态)
│   ├── manifest.json
│   ├── popup.html/js/css     弹窗 UI (类别选择 + clone + registry 浏览)
│   ├── content.js            GitHub 页面注入 (识别 repo, 页面内快捷按钮)
│   ├── background.js         service worker (快捷键, 消息路由)
│   └── options.html/js       设置 (服务地址, workspace 列表)
├── server/           本地伴侣服务 (零依赖 Node ≥ 18)
│   └── refdock-server.mjs    HTTP :7420 + 可选剪贴板监听
├── tools/
│   └── make-icons.html       图标生成器 (浏览器打开, 点击下载 PNG)
└── README.md
```

## 工作原理

1. **获取地址** — 内容脚本在 `github.com/<owner>/<repo>` 页面注入解析出的
   `owner/repo`、默认分支、描述;弹窗自动带上当前页仓库。
2. **选择类别** — 固定四类 `skills` / `plugins` / `products` / `others`;
   选 `skills` 等有多级结构的类别时,还会出现子目录下拉(来自 `references/` 实时结构)。
3. **clone 落地 (异步)** — 插件 POST `/api/clone` 后立即收到 202 入队确认,
   伴侣服务在后台串行执行 `git clone --depth=1 <repo> <workspace>/references/<category>/<name>`,
   已存在同源则改为 `git pull --ff-only`。git 不设超时——慢网络大仓库会一直跑到结束;
   5xx/网络类失败自动退避重试(默认 3 次,2s/8s),4xx(参数错误)不重试。
   broken 残仓(进程被杀留下的半个 `.git`)在下次任务时自动探测并清理重 clone。
   registry (`registry_references.yaml`) 由本仓 pre-commit 钩子自动更新,无需插件干预。
4. **clone 记录** — 弹窗「记录」按钮查看每次 clone 的状态(⏳排队/🔄执行/🔁重试中/✅成功/❌失败)、
   完整命令、已运行时长与错误信息;失败的记录可一键「重跑」(后台重新入队)。
   记录持久化在 `server/jobs.json`,服务重启后自动恢复(重启时在跑的任务标记为失败可重跑)。
5. **降级** — 服务不在线时,"clone"按钮自动变为复制 `git clone …` 命令到剪贴板。

## 快捷键 (可在 chrome://extensions/shortcuts 改)

| 快捷键 | 作用 |
|---|---|
| `Alt+R` | 打开 RefDock 弹窗 |

## 启动伴侣服务

```bash
node ref-dock/server/refdock-server.mjs                       # 默认 workspace = 本仓
node ref-dock/server/refdock-server.mjs --workspace D:/path/to/repo2 --workspace D:/path/to/repo3
node ref-dock/server/refdock-server.mjs --watch-clipboard     # 额外监听剪贴板哨兵命令
node ref-dock/server/refdock-server.mjs --port 7420 --token <secret>   # 令牌校验
```

### 稳定性参数 (慢网络建议)

```bash
--mirror https://ghfast.top        # GitHub 加速镜像前缀 (clone/pull 都走镜像)
--proxy http://127.0.0.1:7890      # 走本地代理 (注入 git -c http.proxy=…)
--retry 5                          # 每个任务自动重试次数 (默认 3, 2s/8s 退避)
--full                             # 不加 --depth=1, 完整历史
--clone-timeout 1800000            # 显式超时 ms (默认 0 = 无超时, 跑到结束为止)
```

git 直连约 100KB/s 也能稳定完成 (--depth=1 + 无超时 + 自动重试);更慢可加镜像或代理。

服务只监听 `127.0.0.1`,来源校验仅放行本插件 origin,加 `--token` 后还需带
`X-RefDock-Token` 头。

## 安装插件

1. Chrome/Edge 打开 `chrome://extensions` → 开启「开发者模式」
2. 「加载已解压的扩展程序」→ 选择 `ref-dock/extension/`
3. 打开插件 options,确认服务地址(默认 `http://127.0.0.1:7420`),点「测试连接」

## 剪贴板哨兵协议 (可选)

复制如下格式文本,开启 `--watch-clipboard` 的服务会自动执行:

```
REFDOCK://clone?workspace=<id>&category=<path>&url=<git-url>
```

## 隐私 / 安全

- 服务仅绑定 loopback;clone 目标被约束在 workspace 的 `references/` 内(防路径穿越)。
- 不采集、不外发任何数据;GitHub 页面内容仅用于拼装 clone URL。
