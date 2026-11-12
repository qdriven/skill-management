# RefDock 使用速查

## 1. 启动伴侣服务(每次开机后执行一次)

```bash
# 默认以当前目录为 workspace(推荐在本仓根目录执行)
node ref-dock/server/refdock-server.mjs

# 多 workspace:
node ref-dock/server/refdock-server.mjs --workspace D:\repoA --workspace D:\repoB

# 可选:同时监听剪贴板哨兵
node ref-dock/server/refdock-server.mjs --watch-clipboard

# 可选:令牌校验(插件 options 里填同一个值)
node ref-dock/server/refdock-server.mjs --token mysecret
```

服务绑定 `127.0.0.1:7420`,看到 `listening` 即就绪。

## 2. 安装插件

`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选 `ref-dock/extension/`。

## 3. 日常使用

1. 打开任意 `github.com/owner/repo` 页面
2. 点工具栏 RefDock 图标(或 `Alt+R`)
3. 左上角选 workspace → 点选类别 chips(`skills/ui-ux` 等,来自 references 实时目录)
4. **Clone** → 服务直接 `git clone` 到 `references/<category>/<repo>`;已存在同源则 `git pull --ff-only`
5. 服务离线时点 Clone/复制命令 → 自动降级为复制 `git clone …` 到剪贴板

## 快捷键

`Alt+R` 打开弹窗(以独立小窗形式,可在 `chrome://extensions/shortcuts` 修改)。

## API(调试用)

```
GET  /api/ping                     存活 + workspace 列表
GET  /api/workspaces               workspace 详情
GET  /api/tree?workspace=ws0       references 类别目录实时树
GET  /api/registry?workspace=ws0   registry_references.yaml 解析结果
GET  /api/list?workspace=&category=  类别下已有仓
POST /api/clone                    {workspace, category, url, name?}
```

## 剪贴板哨兵(可选)

复制以下文本,开启 `--watch-clipboard` 的服务会自动执行 clone:

```
REFDOCK://clone?workspace=ws0&category=skills/ui-ux&url=https://github.com/owner/repo
```
