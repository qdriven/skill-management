# README



这是一个SKILL使用评测的目录，会根据不同的Topic来评测不同SKILL使用情况. 基本原则：

1.  SKILL 目录是放到references里面
2.  docs目录按照topic分类，比如ui-ux的就在ui-ux 目录
3. 在每一个topic目录中每一个SKILL的使用都在对应的SKILL名称的目录中，保留测试的目录，结果内容，还有分析这个SKILL的内容，都在一个目录中
4. 所有的SKILL使用，安装都统一在这个目录

## 统一落点

按以上原则归档试用记录的全局 skill：[references/skill-eval/](references/skill-eval/)。
装到任意项目的 skills 目录后，`init` 一键生成 `references/<skill>/` 与
`docs/<topic>/<skill>/`（tests/ + results/ + analysis.md），不同项目、不同 Agent
写入同一个 skill-management 目录。
