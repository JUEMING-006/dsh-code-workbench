# dsh-code-workbench 需求清单

> 汇总自产品讨论与迭代全过程的需求基线。状态：`完成` / `进行中` / `待办(Deferred)`。

## 一、项目定位

| 需求 | 说明 | 状态 |
|---|---|---|
| 独立可分发插件 | 作为 dsh 原生 bundle（npm 包 + cordis.patch.yml + dsh.client 声明），**零修改 deepseek-harness 本体** | 完成 |
| 任何设备可用 | 任意装有 dsh web 的设备经 `dsh plugin --profile web add dsh-code-workbench` 安装即用 | 完成（link: 本地联调） |
| 双模式 | 编码模式（VS Code 形态）+ harness 原版样式（默认） | 完成 |
| 可自由选择 VS Code 功能子集 | 按需实现，不做全套（扩展市场/调试器/远程开发等明确排除） | 完成（见"明确不做"） |

## 二、模式切换

| 需求 | 说明 | 状态 |
|---|---|---|
| 切换开关（harness 侧） | 默认桌面**右上角浮动按钮**（`Open Code Mode`，高对比胶囊，经 shell.overlay 注入） | 完成 |
| 切换开关（workbench 侧） | 状态栏 `Exit Code Mode` 按钮；右上角按钮自动消失（AppFrame 被 shadow 不渲染 overlay） | 完成 |
| 切换粒度 | 全局默认（`dsh.workbench.mode`）+ 会话覆盖（`dsh.workbench.mode.session.<id>`） | 完成（UI 只暴露全局；会话键可 console 设置） |
| 切换机制 | 写 localStorage + 一次页面重载（root shadow 是 boot 期决策） | 完成 |
| 故障回退 | workbench 渲染崩溃自动 abdicate，harness 壳接管 | 完成（框架机制） |
| harness 零副作用 | harness 模式下仅一个浮动按钮，无其他注册/监听 | 完成 |

## 三、编码模式工作台（VS Code 形态，逐项对齐）

| VS Code 要素 | 需求 | 状态 |
|---|---|---|
| 菜单栏 | File / View / Terminal / Help，下拉菜单（View→切换侧边栏/面板等） | 完成 |
| 活动栏 | 48px 纯图标列，VS Code 顺序（Explorer 第一）：Explorer / Search / AI Assistant / Settings | 完成 |
| 侧边栏 | 视图标题栏（EXPLORER/SEARCH/AI ASSISTANT/SETTINGS）+ 操作按钮（Explorer 刷新）；内容随活动栏切换 | 完成 |
| 编辑器区 | 标签条（打开/切换/关闭/脏标记）+ Monaco + 无文件时 Welcome 欢迎页 | 完成 |
| 底部面板 | TERMINAL 标题栏 + xterm 终端 + 关闭按钮；可折叠（Show/Hide Panel） | 完成 |
| 状态栏 | 两端分区：左（Code Mode 高亮项）；右（文件语言、UTF-8、Exit、面板/侧边栏切换）；22px（StatusbarPart.HEIGHT） | 完成 |
| 主题 | VS Code **Dark Modern**：钉住 vscode 1.96.0 权威色板（dark_modern.json + 平台 list 默认值）+ codicons 图标集 + 尺寸常量（状态栏 22 / 活动栏 48 / 标签 35 / 标题栏 35 / 侧栏默认 300）；全部经 theme/ 令牌层，组件零颜色字面量（有测试门禁） | 完成 |
| 侧边栏/面板拖拽调宽调高 | Sash 拖拽手柄（4px 热区、hover 高亮、双击重置）：主侧栏/辅助侧栏/面板（随停靠方向） | 完成 |
| 辅助侧栏（Auxiliary Bar） | 右侧视图容器（Copilot 同款停靠位），AI 助手面板默认驻留；活动栏 Sparkle 图标 + Ctrl+Alt+B + 状态栏图标三路开关 | 完成 |
| 面板换位 | 下/右/左三向停靠（View 菜单），独立宽/高存储 | 完成 |
| 面板最大化 | 面板标题栏 ChevronUp/Down + View 菜单，最大化时铺满编辑器区 | 完成 |
| 布局持久化 | defineStore 引擎 persist（localStorage 键 `dsh.workbench.layout.v1`，带形状版本），刷新恢复 | 完成 |
| Zen 模式 | View 菜单进入；隐藏标题栏/活动栏/侧栏/辅助栏/面板，状态栏保留 Exit Zen Mode | 完成 |
| 布局快捷键 | 命令表驱动：Ctrl+P Quick Open / Ctrl+Shift+P 命令面板 / Ctrl+B 侧栏 / Ctrl+Alt+B 辅助栏 / Ctrl+J、Ctrl+` 面板 | 完成 |
| 命令注册表 | VS Code 命令 id（workbench.action.*）单表驱动 命令面板+菜单栏+键位；菜单项带快捷键标签 | 完成 |
| 命令面板 | Quick Input 部件（Ctrl+Shift+P）：全命令模糊搜索、上下键高亮、回车执行、Esc/点击遮罩关闭 | 完成 |
| Quick Open | Ctrl+P 按文件名模糊跳转：宿主 listAll 有界递归清单（上限 10000、跳过 node_modules/.git） | 完成 |
| ui-commands 深度集成（dsh 宿主命令面） | 宿主 ui-commands 服务的桥接 | 待办 |
| 编辑器面包屑/大纲 | 标签条下方导航 | 待办 |
| 状态栏 Ln/Col | 需 Monaco 光标事件 | 待办 |

## 四、文件系统能力

| 需求 | 说明 | 状态 |
|---|---|---|
| fs 网关 | HTTP JSON 载体（/api/code-workbench/fs），listDir/listAll/readText/writeText/noteActiveFile | 完成 |
| 政策链闭环 | 写入走 `fs/write-intent` waterfall、读写后发 `fs/observed`（工作台独立 actor 域），与模型工具同门禁 | 完成 |
| 版本防护保存 | replaceIfVersion 守卫，模型工具并发写触发 FS_STALE_VERSION 拒绝 | 完成 |
| 文件树 | 懒加载展开/收起、错误呈现、根=当前会话 cwd、一键刷新 | 完成 |
| 右键菜单（新建/重命名/删除） | fs 能力无 rename/mkdir/remove 原语 | 待办 |

## 五、AI 助手面板（原生集成、全能力）

| 需求 | 说明 | 状态 |
|---|---|---|
| 会话管理 | 下拉切换（sessions.open）+ New 新建（workspaces.startSession）；面板默认驻留**辅助侧栏**（右侧，Copilot 停靠位） | 完成 |
| 流式聊天 | 节点投影渲染（user/assistant/tool/command/其他），运行中 Thinking… | 完成 |
| 工具调用摘要 | `[tool] name(args)` 行内展示 | 完成 |
| 发送/取消 | Enter 发送（Shift+Enter 换行）、运行中变 Stop（cancel） | 完成 |
| Slash 命令 | `/` 开头直通 session.command | 完成 |
| 队列/错误 | pending 消息预览 + 错误条 | 完成 |
| **审批闭环（热修）** | 编码模式下 harness 审批 UI 随 AppFrame 被 shadow 无出口；面板内渲染审批卡（理由 + 命令行 + Allow Once / Reject，一次性闩锁、失败重挂）直接 `respond()` 应答；待答 question 显示提示条（应答 UI 归 P4） | 完成 |
| 面板位置灵活切换（侧边栏↔底部/浮动） | 类比 Qoder 且更灵活的核心诉求 | 待办 |
| 选区 → 上下文注入 | 编辑器选中文本一键送入 AI | 待办 |
| AI 编辑应用 | 模型建议的 diff/编辑应用到文件 | 待办 |

## 六、Monaco 编辑器

| 需求 | 说明 | 状态 |
|---|---|---|
| 内核 | Monaco（@monaco-editor 分发），VS Code 同款体验 | 完成 |
| 加载架构 | /monaco 静态分发（host 路由 + 穿越防护），运行时加载，不打进 bundle | 完成 |
| 语言检测 | 30+ 扩展名映射（TS/JS/JSON/MD/Python/Go 等） | 完成 |
| 编辑器表面 | 可插拔（Monaco 生产 / textarea 测试回退） | 完成 |
| 外观 | vs-dark、自动布局、迷你地图关闭 | 完成 |

## 七、终端

| 需求 | 说明 | 状态 |
|---|---|---|
| 交互式终端 | xterm.js 渲染 + SSE 输出流 + 输入回传 | 完成 |
| 跨平台 shell | Windows cmd.exe / Unix bash（管道模式，零原生依赖） | 完成 |
| 生命周期 | spawn（当前会话 cwd）/ kill / 退出后 Restart | 完成 |
| PTY 级体验 | node-pty（TTY job control、resize 信号） | 待办 |

## 八、模型感知（P3）

| 需求 | 说明 | 状态 |
|---|---|---|
| editor/active 事件 | 标签切换时 log-only 会话事件（扩展 SessionEventMap） | 完成 |
| 活动文件注入 | 动态 system-prompt section：`The user is currently viewing: <path>` | 完成 |
| 可重建性 | 模型可见 ⟺ 已记录：请求与活动文件事实可从同一日志重建 | 完成 |

## 九、技术约束与已确认决策

- 交付形态：浏览器 Web App（不做 Electron/Tauri 桌面壳）
- 不修改 dsh 本体；依赖发布包 `@deepseek-ai/dsh-*@0.1.0-rc.6`
- 对宿主版本宽容：服务面用自持窄接口、错误识别用契约码（非 instanceof）
- root shadowing：静态插件必须显式 `priority: -1`（无自动分配）
- cordis 服务访问必须显式 `inject` 声明
- 外部 UI 浮层走 `shell.overlay`（官方文档明示的外部表面入口）
- 测试：vitest alias（runtime/ui-primitives 指向 stub）+ css stub；122 单测全绿（stub 已实现 persist 契约）
- 主题基线：钉住 vscode 1.96.0 Dark Modern（升级 = 重生成 theme/tokens.ts，不改组件）
- 开发联调：`link:` 符号链接安装（源码重建即时生效）

## 十、明确不做（功能子集边界）

扩展市场（dsh 插件系统即扩展体系）、调试器、远程开发、多窗口、SCM（dsh 无 git 能力）、主题市场、Electron/Tauri 桌面壳、代码补全。

## 十一、当前状态

- **已完成**：P0（双模式骨架/切换/五区工作台）→ P1（fs 网关/文件树/标签编辑）→ P1.5（Monaco）→ P2（AI 面板/xterm 终端）→ P3（模型感知）→ VS Code 布局对齐 → harness 顶部切换按钮 → **审批缺口热修（对话内审批卡闭环）** → **VSC 对齐 P0（Dark Modern 令牌层 + codicons + 尺寸常量）** → **VSC 对齐 P1（布局引擎：辅助侧栏/面板换位与最大化/sash 拖拽/布局持久化/zen/布局快捷键）** → **VSC 对齐 P2（平台服务：命令注册表/命令面板/Quick Open/键位分发/菜单命令化）**
- **进行中**：VSC 对齐 P3（编辑器组：split/跨组拖拽/preview tab）与 P4（AI 助手视图容器化 + 选区注入 + diff 应用），见 [PLAN-VSCODE-ALIGNMENT.md](PLAN-VSCODE-ALIGNMENT.md)
- **待办（Deferred）**：AI 面板位置切换（四处停靠含浮动窗，P4 视图容器化）、选区→上下文注入、AI 编辑应用、PTY 终端、面包屑/大纲、Ln/Col、文件树右键菜单、ui-commands 深度集成、question 应答 UI
