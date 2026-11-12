# RefDock — GitHub 仓库一键 clone 到 references

> 位置:`ref-dock/`(插件 `extension/` + 本地服务 `server/`)
> 用途:在浏览器里看到 GitHub 仓库,选个类别就 clone 到本仓 `references/` 对应目录;快
> 捷键 `Alt+R` 直接唤起。慢网络下自动重试、无超时、支持镜像/代理加速。

## 它解决什么问题

给 `references/` 收集开源参考仓,平时要:开终端 → 想类别目录 → 手敲 `git clone` → 网慢
失败重来。RefDock 把这条链缩成:浏览器里点 **Clone**,仓库落到
`references/<类别>/<子目录>/<repo>`,失败自动重试,「记录」里可看进度、可重跑。

## 组成

| 部分 | 说明 |
|---|---|
| `ref-dock/extension/` | Chrome/Edge 插件(MV3,纯静态,无构建)。弹窗 UI + GitHub 页面角标 + 快捷键 |
| `ref-dock/server/refdock-server.mjs` | 本地伴侣服务(零依赖 Node ≥ 18)。真正执行 git 的地方,绑 `127.0.0.1:7420` |

插件只负责选类别、发请求、看记录;git 全部由本地服务在后台串行执行。

## 首次安装(一次性)

1. **启动服务**(每次开机后执行一次,建议在本仓根目录):
   ```bash
   node ref-dock/server/refdock-server.mjs
   ```
   看到 `[refdock] listening on http://127.0.0.1:7420` 即就绪。
2. **装插件**:`chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→
   选 `ref-dock/extension/` 目录。
3. **验证**:浏览器工具栏点 RefDock 图标,顶部显示绿色「服务在线」即通;
   不通时进插件 options 检查服务地址(默认 `http://127.0.0.1:7420`)点「测试连接」。

## 日常使用

1. 打开任意 `github.com/owner/repo` 页面(页面右下角会出现绿色 R 角标表示已识别)。
2. 点工具栏图标,或按 **`Alt+R`**(独立小窗;快捷键可在 `chrome://extensions/shortcuts` 改)。
3. 弹窗里:
   - 左上选 **workspace**(默认 `ws0` = 本仓);
   - 点选类别 chips:固定四类 **skills / plugins / products / others**;
   - 选 `skills` 等多级类别时出现**子目录下拉**(来自 references 实时目录,
     如 `skills/ui-ux`;不选则直接放在类别根)。
4. 点 **Clone** → 立即入队,后台下载;已存在同源仓库则自动改为 `git pull --ff-only`。
5. 点 **记录** 查看每次任务:⏳排队 / 🔄执行(显示已跑分钟数)/ 🔁重试中 /
   ✅成功 / ❌失败(含完整命令和错误);失败可一键 **重跑**。
6. **服务没开?** Clone 按钮自动降级为「复制命令」,把 `git clone --depth=1 …`
   复制到剪贴板,自己找终端执行即可。

## 慢网络 / 不稳定环境

服务对 git **不设超时**——大仓库慢就慢,跑到结束为止;网络类失败自动退避重试
(默认 3 次)。实在很慢时可加加速参数:

```bash
node ref-dock/server/refdock-server.mjs --mirror https://ghfast.top   # 走加速镜像
node ref-dock/server/refdock-server.mjs --proxy http://127.0.0.1:7890 # 走本地代理
node ref-dock/server/refdock-server.mjs --retry 5                     # 加大重试次数
node ref-dock/server/refdock-server.mjs --full                        # 不要 --depth=1,完整历史
```

clone 默认 `--depth=1`(浅克隆省时间);broken 残仓(进程被杀留下的半个 `.git`)
下次任务会自动探测清理重下,陈旧 `.lock` 文件也会自动清。

## 其他启动选项

```bash
--workspace D:\path\to\repo2   # 追加 workspace(可重复;第一个默认为当前目录)
--port 7420                    # 端口
--token mysecret               # 令牌校验(插件 options 里填同一个值)
--watch-clipboard              # 监听剪贴板哨兵命令(见下)
--clone-timeout 1800000        # 显式超时 ms(默认 0 = 无超时)
```

## 剪贴板哨兵(可选)

用 `--watch-clipboard` 启动后,复制如下格式文本即触发 clone(适合脚本/手机推过来):

```
REFDOCK://clone?workspace=ws0&category=skills/ui-ux&url=https://github.com/owner/repo
```

## clone 记录与重启

- 记录持久化在 `ref-dock/server/jobs.json`(运行时文件,不入库);服务重启后自动恢复
  历史记录,重启时正在跑的任务标记为失败,可在弹窗里重跑。
- 目录结构变化/新类别无需任何配置:子目录下拉来自 `references/` 实时扫描;
  `registry_references.yaml` 由本仓 pre-commit 钩子(`spark repo scan`)自动更新。

## 调试 API

```
GET  /api/ping                       存活 + workspace 列表
GET  /api/workspaces                 workspace 详情
GET  /api/tree?workspace=ws0         references 类别目录实时树
GET  /api/registry?workspace=ws0     registry_references.yaml 解析结果
GET  /api/list?workspace=&category=  类别下已有仓
GET  /api/jobs?limit=30              clone 记录
POST /api/clone                      {workspace, category, url, name?} → 202 入队
POST /api/retry                      {id} 重跑某个失败/完成任务
```

## 安全

- 服务仅绑定 loopback `127.0.0.1`;请求来源校验仅放行本插件 origin,可再加 `--token`。
- clone 目标被约束在 workspace 的 `references/` 内(拒绝 `..`、绝对路径、控制字符)。
- 不采集、不外发任何数据;GitHub 页面内容仅用于拼装 clone URL。
