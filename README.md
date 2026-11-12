# README



这是一个SKILL使用评测的目录，会根据不同的Topic来评测不同SKILL使用情况. 基本原则：

1.  SKILL 目录是放到references里面
2.  docs目录按照topic分类，比如ui-ux的就在ui-ux 目录
3. 在每一个topic目录中每一个SKILL的使用都在对应的SKILL名称的目录中，保留测试的目录，结果内容，还有分析这个SKILL的内容，都在一个目录中
4. 所有的SKILL使用，安装都统一在这个目录

## references registry（spark repo scan + pre-commit）

`references/` 里的参考仓是**嵌入式 git 仓**（git 以 gitlink 160000 记录）。
**刻意不转成 submodule、不建 `.gitmodules`**——参考仓数量多、内容体量大，
submodule 的登记与同步开销都过高；因此新 clone 拿不到仓内容，恢复凭据统一放在
根目录 [`registry_references.yaml`](./registry_references.yaml)（`name / repo / path`），
换机器用 `spark repo clone -f registry_references.yaml` 恢复。新增/删除参考仓由
pre-commit 钩子自动扫描并**随同一次提交**更新该 registry。

用 pre-commit 钩子自动生成并**随同一次提交一起入库**（一次性启用）：

```bash
git config core.hooksPath .githooks     # 启用 .githooks/pre-commit
spark repo scan references              # 手动生成/校验 registry
```

- 触发条件：本次提交涉及 `references/**`（增/删/改名）或 registry 缺失；约 0.4s，
  幂等，重扫会同步删除已移除的仓。
- `spark` 未安装或扫描失败时**告警但不阻断提交**（内容仍由 gitlink 记录，可事后补）。
- 局限：registry 只覆盖**带 origin remote 的 git 仓**（普通目录如
  `references/clone-website` 不入册）；`core.hooksPath` 是本地配置，每个 clone
  需自己执行一次上面那条命令。

## 统一落点

按以上原则归档试用记录的全局 skill：[references/skill-eval/](references/skill-eval/)。
装到任意项目的 skills 目录后，`init` 一键生成 `references/<skill>/` 与
`docs/<topic>/<skill>/`（tests/ + results/ + analysis.md），不同项目、不同 Agent
写入同一个 skill-management 目录。
