# dsh-code-workbench 完整规格文档

> 状态：当前完成情况 + 待实现目标 + 逐项实现方法 + 最终实现效果。

## 1. 项目定位与约束

**dsh-code-workbench** 是 DeepSeek Harness 的一个可分发插件（installable bundle），为宿主提供一套现代专业标准的**编码工作台**界面。

四条不可动摇的约束：

1. **零修改本体**。`D:\deepseek-harness` 主仓库一行不改；插件只消费本体已发布的客户端运行时面（`dsh.client`、`ctx.sessions`、`ctx.workspaces`、`ctx.slots`、`defineStore`、`ctx.fs`、`ctx.subprocess`、`ctx.userQuestions` 等），缺失能力一律在插件内补（HTTP 网关 + 客户端实现），绝不在本体打洞。
2. **双模式共存**。harness 模式（原生样式）与 workbench 模式（工作台形态）由同一个开关切换；开关两端都要有入口（harness 端悬浮 pill / workbench 端状态栏按钮）。
3. **任意设备可安装**。`dsh plugin --profile web add git+https://github.com/JUEMING-006/dsh-code-workbench.git` 一条命令装完；纯 Web 插件形态，无 Electron、无原生依赖（PTY 终端复用本体的 subprocess 服务，插件不打包 node-pty）。
4. **设计令牌单一来源**。颜色、尺寸、间距全部经由 `tokens.ts` 集中管理，并有用测试强制约束（组件内不允许出现颜色字面量）。

范围取舍（明确排除）：扩展市场、调试器、远程开发、SCM 面板、Electron 外壳。AI 助手保留 DeepSeek Harness 的全部原生能力（会话、工具、审批、提问、subagent），不做阉割版。

## 2. 当前完成情况

以下全部**已完成并通过 vitest 验收**（jsdom 环境，共约 76 个断言式测试）。

### 2.1 基础：插件骨架与双模式（P0）

| 能力 | 位置 | 说明 |
|---|---|---|
| 插件声明 | `dsh.client` + `cordis.patch.yml` | 客户端插件注册；workbench 根槽以显式 `priority: -1` shadow 宿主 root，只在 workbench 模式下接管整页 |
| 模式开关 | `src/client/mode/store.ts`、`ModeToggleButton.tsx` | `readGlobalMode/writeMode`（localStorage key `dsh.workbench.mode`）；harness 模式经 `shell.overlay` 渲染右上角悬浮 pill（`data-mode-toggle`），点击切换并 reload（shell 形态是 boot 时决策） |
| 服务注册 | `src/client/workbench/services.ts` | `installWorkbenchServices/getWorkbenchServices`：apply 期把 `ctx.sessions/ctx.workspaces` 等注入 shell，测试经 context 注入替代 |

### 2.2 视觉对齐层（P0 视觉对齐）

- **设计令牌单一来源**：`src/client/theme/tokens.ts`。`COLORS` 以 VS Code `dark_modern.json` 主题色 ID 为键，含派生色（`sash.hoverBorder: '#0078D4'`、chrome 悬停底色、审批等待态专用色）；`SIZES` 对齐 VS Code 常量：状态栏 22、活动栏图标 48、标签页 35、标题栏 35、侧边栏默认 300；`FONT_UI` / `FONT_MONO`。
- **三段式注入**：`tokens.ts` → `css.ts`（`WORKBENCH_CSS`，类名前缀 `dsh-wb-`、CSS 变量前缀 `--dsh-wb-*`）→ `inject.ts`（`ensureWorkbenchTheme(doc)`，按 `data-dsh-code-workbench-theme` 属性幂等注入）。
- **图标**：`src/client/theme/codicons.tsx`。19 个 codicon 取自 `@vscode/codicons@0.0.36` 的 `src/icons/*.svg` 真实 path data（生成器 `scripts/gen-codicons.mjs`）；`Codicon` 组件 + `Icon*` 导出。
- **测试**：`theme/theme.spec.ts`（4 条）——其中一条扫描组件源码，禁止任何颜色字面量旁路令牌层。

### 2.3 布局引擎（P1）

- **几何状态**：`src/client/workbench/geometry.ts`。`WorkbenchGeometryState`：sidebarWidth、auxBarWidth、panelHeight/panelWidth、sidebarCollapsed、auxBarHidden、panelCollapsed、panelPosition（`bottom | left | right`）、panelMaximized、zen、activity（`files | search | settings`）。`createWorkbenchStore()` 用本体 `defineStore` 引擎，`persist: 'dsh.workbench.layout.v1'`——布局（含各栏宽度、面板位置）刷新不丢。12 条测试。
- **主壳**：`src/client/workbench/WorkbenchShell.tsx`。标题栏+菜单栏+下拉菜单（含快捷键标注）、活动栏（`aria-pressed` + 2px 指示条）、主侧边栏、辅助栏、编辑区、面板（bottom/left/right 停靠 + 最大化）、状态栏、zen 模式、Quick Input 挂载。
- **Sash 拖动**：`parts/Sash.tsx`。pointer 事件 + window 级监听（拖出目标不丢事件），双击重置默认宽度；水平/垂直两个朝向共用。4 条测试。
- **AI 助手容器**：`parts/AuxBarContent.tsx`——辅助栏内的视图头 + AI 面板（P4 将升级为可停靠视图容器）。
- **区域测试**：`tests/shell.client.spec.tsx`（13 条，命令分发/键盘/菜单/zen）、`tests/regions.client.spec.tsx`（10 条，各区 data 属性与交互）。

### 2.4 平台服务层（P2）

- **命令注册表**：`src/client/platform/commands.ts`。单表 `COMMANDS`（ID 沿用 VS Code 真实命令 ID：`workbench.action.*`），派生 `MENUS`（按区菜单）与 `DEFAULT_KEYBINDINGS`；chord 规范化（Ctrl/Meta 折叠：`ctrl+alt+b`、`ctrl+shift+p`、`ctrl+``）。6 条测试。
- **模糊匹配**：`fuzzy.ts`（连续命中 + 词首加分，稳定排序）。6 条测试。
- **键盘分发**：`keybindings.ts`（`resolveChord`，chord 语法解析）。6 条测试。
- **Quick Input**：`QuickInput.tsx`（`MAX_ROWS=12`、上下键/回车导航、`openFileIntoEditor` 联动、过滤即搜索）。9 条测试。
- **打开文件**：`src/client/workbench/open-file.ts` 的 `openFileIntoEditor(fs, editor, path)`。

### 2.5 宿主网关（P0/P2）

- **文件网关**：`src/host/fs-gateway.ts`。HTTP JSON `/api/code-workbench/fs`；`read` / `write`（版本校验防覆盖他人修改）/ `save` / `listAll`（有界 BFS，上限 10000 条目，排除 `node_modules`/`.git`）；所有写操作过本体 `fs/write-intent` waterfall 策略链 + `fs/observed` 记账，操作者身份 `WORKBENCH_ACTOR`。契约在 `src/shared/fs-contract.ts`（客户端 `FsClient` 同步镜像，含 `listAll`）。含 `listAll` 树遍历测试。
- **终端网关**：`src/host/terminal-gateway.ts`。spawn / kill / stream（当前为 node:child_process 管道模式；P5 升级 PTY，见 §4.6）。
- **host inject**：`src/host/index.ts` 当前 `['fs', 'webServer', 'agents', 'systemPrompt']`。

### 2.6 编辑器基础（P2 部分）

- **编辑器 store**：`src/client/workbench/editor-store.ts`。`EditorState { tabs, activePath }` 单组模型；`openTab/activate/closeTab/setContent/markSaved`；`dirty` 标记 + `version` 令牌（provider 版本号，保存冲突检测用）。P3 将重构为多组（§4.1）。
- **编辑器渲染**：WorkbenchShell 的 editor region（tabs 栏 + 编辑面 + 状态栏集成）。

### 2.7 审批热修复（P2 补丁）

编码模式此前没有审批 UI 出口（用户批准/拒绝流），已补：

- **ApprovalCard**：`src/client/ai/AiPanel.tsx`。一次性锁存（同一次审批不重复弹）、失败后重新启用、`data-approval-key/reject/allow/error` 属性；wire 编码与本体的 `ui-conversation` 完全一致：`respond({ ok: true, value: { sessionId, approvalId, outcome: 'allowed-once' | 'rejected' } })`（对齐 `packages/client/ui-conversation/src/client/contract/slots.ts` 的 `PendingApproval.answer`）。
- **question 提示条**：`data-chat-question` 占位（完整应答链在 P4，见 §4.4）。
- 测试：`ai/AiPanel.approval.spec.tsx`（6 条，含锁存与错误恢复）。

### 2.8 测试基建

- `src/client/testing/runtime-stub.ts`：本体 `defineStore` 引擎的测试替身，忠实实现 persist 契约（create 时 hydrate、每次 update/set 落盘、`clearPersisted`、损坏 JSON 回退）。
- `src/client/testing/ui-primitives-stub.tsx`：屏蔽 katex 等样式依赖的图标替身。
- `vitest.config.ts`：jsdom + 两个测试别名（运行时引擎、ui-primitives）。

## 3. 待实现目标总览

| 阶段 | 范围 | 状态 |
|---|---|---|
| P0 基础 + 视觉对齐 | 全部 | ✅ 完成 |
| P1 布局引擎 | 全部 | ✅ 完成 |
| P2 平台服务 + 编辑器基础 + 审批热修复 | 全部 | ✅ 完成 |
| **P3 编辑器组** | 拆分/拖拽/preview/面包屑/Ln-Col/保存/minimap | ⬜ 未开始（§4.1） |
| **P4 AI 助手升级** | 视图容器化/question 应答/选区注入/diff 确认 | ⬜ 未开始（§4.2–4.5） |
| **P5 完成度收尾** | Explorer 增删改/Search/Settings/Light+ 主题/右键菜单/PTY 终端/chord | ⬜ 未开始（§4.6–4.9） |
| Deferred | 扩展市场、调试器、远程开发、SCM、Electron | ❌ 明确排除 |

## 4. 逐项规格与实现方法

### 4.1 P3-1：编辑器多组拆分（Ctrl+\）

**目标**：`Ctrl+\` 左右拆分、`Ctrl+K Ctrl+\` 上下拆分（VS Code 语义）；每组独立 tab 列表与 activePath；组间竖/横 Sash 可拖；关闭最后一组时合并回相邻组。

**实现方法**：

1. 重构 `src/client/workbench/editor-store.ts`（核心改动，先做）：
   - `interface EditorGroup { id: string; tabs: EditorTab[]; activePath: string | undefined }`
   - `EditorState` 改为 `{ groups: EditorGroup[]; activeGroupId: string }`。
   - actions 全集：`openTab(d, groupId, tab)`、`activate(d, groupId, path)`、`closeTab(d, groupId, path)`、`setContent(d, groupId, path, content)`、`markSaved(d, groupId, path, version)`、`splitGroup(d, anchorGroupId, direction: 'right'|'down')`、`closeGroup(d, groupId)`（活跃组关闭后相邻组接管焦点）、`moveTabToGroup(d, fromGroupId, toGroupId, path)`、`activateGroup(d, groupId)`。
   - 不变量（写成测试）：tab 的 path 在组内唯一；任一组关闭后剩余组 ≥1；`activeGroupId` 恒指向存活组。
2. WorkbenchShell editor region：`groups.map` 渲染为网格（`display: flex` 行/列，方向由拆分层级决定——**v1 简化：只支持一层拆分**，即最多 2 组，方向由最近一次 split 决定；多层树形拆分为 v2，记录为已知限制）。
3. 组间 Sash 复用 `parts/Sash.tsx`（orientation 按拆分方向），拖动改 `groupWidths`（进 geometry store 或 editor store 的 `sizes: Record<groupId, number>`，persist 一并持久化）。
4. 命令注册：`workbench.action.splitEditor`（Ctrl+\）、`workbench.action.splitEditorOrthogonal`（Ctrl+K Ctrl+\——依赖 §4.9 的 chord 支持，chord 未完成前先注册为直接绑定 Ctrl+K 后跟 Ctrl+\ 的 chord 键，keybindings 层支持 pending 状态）。

**验收标准**：拆分后两组各能独立开关 tab；拖动 Sash 改变宽度；Ctrl+W 只关当前组当前 tab；关闭 group 合并。测试：editor-store 多组不变量单测 ≥8 条 + shell 拆分交互测试 ≥3 条。

### 4.2 P3-2：tab 拖拽 / preview / 关闭 / 面包屑 / Ln-Col

**目标**（编辑器组行为补齐）：

1. **tab 跨组拖拽**：拖 tab 到另一组 tab 栏 = `moveTabToGroup`；拖到编辑器面 = 分裂出新组。实现：tab 元素 `draggable` + `dragstart` 携带 path；tab 栏 `dragover` 高亮插入位；`drop` 调 action。纯前端，无宿主依赖。
2. **preview tab**：从 Explorer 单击打开的文件为 preview（tab 标签斜体，复用 VS Code `preview` 视觉）；编辑或显式固定（双击）后转正式 tab；新 preview 打开时替换旧的 preview 槽。实现：`EditorTab.preview?: boolean`；`openTab` 时若目标是 preview 且已有 preview tab 则替换。
3. **关闭**：Ctrl+W（`workbench.action.closeActiveEditor`）、tab 中键点击（`onAuxClick`）、关闭按钮；最后一个 tab 关闭后显示 Welcome（已有）。
4. **面包屑**：编辑区顶部面包屑条（路径按 `/` 分段，逐级可点但 v1 只展示+点击定位到该路径层级，不实现目录展开）。
5. **Ln/Col**：状态栏右侧 `Ln X, Col Y`；事件源 = 编辑器 textarea 的 `onSelect`（selectionStart 换算行列）。随 P5 Settings 的 minimap 开关，状态栏左侧加 `Go to Line` 命令（Ctrl+G，QuickInput 数字输入 + 滚动定位）。

**验收标准**：每项 ≥2 条交互测试；preview 替换语义单测 ≥3 条。

### 4.3 P3-3：Ctrl+S 版本保护保存

**目标**：`Ctrl+S` 保存当前组活跃 tab；若 provider 版本令牌已变（他人改过文件），弹冲突选择（覆盖 / 放弃我的修改 / 另存）；成功后 dirty 清除。

**实现方法**：store 已有 `version` + `markSaved`；补 `save` 动作（`version` 不匹配时置 `conflict: { path, localVersion, remoteVersion }` 状态）→ editor 区域渲染冲突对话框；`FsClient.save(path, content, expectedVersion)` 网关已支持版本校验（返回 409 冲突错误码，客户端据此弹框）。

**验收标准**：正常保存 1 条 + 冲突三选一 3 条（覆盖走新版本、放弃还原内容、另存写新 path）。

### 4.4 P4-1：AI 助手视图容器化

**目标**：AI 助手面板可停靠四处——辅助栏（默认）、主侧边栏、底部面板、浮动窗口——**切换不重载页面、不丢会话状态**。

**实现方法**：

1. `geometry.ts` 增加 `aiLocation: 'auxiliary' | 'sidebar' | 'panel' | 'floating'`（persist 自动覆盖）。
2. WorkbenchShell 按 `aiLocation` 把 `AuxBarContent`（AI 面板组件重命名为 `AiViewContainer`）渲染到对应 region；floating 时渲染为 absolute 定位的浮窗（复用面板拖拽能力：标题条拖动 + 尺寸记忆）。
3. 切换入口：AI 视图头的 `...` 菜单（view-context menu，MENUS 表加 `view/aicontext` 区）+ 命令 `workbench.action.positionPanel` 变体（`workbench.action.moveViewToSidePanel` 等，ID 沿用 VS Code）。
4. **会话状态保留**：AI 面板 state（选中的 session id）由父级（WorkbenchShell）持有而非组件卸载即丢——`AiViewContainer` 挂载点变化只换 DOM 位置，不重建内部状态（用同一 key 的 Portal 或保持组件实例不卸载）。

**验收标准**：四种停靠各 1 条渲染位置断言；切换前后 `data-ai-session` 选中值不变（状态保留断言）；persist 刷新恢复。

### 4.5 P4-2：question 应答 wire 打通（已确认宿主面）

**目标**：模型调用 `ask_user_question` 时，问题卡片出现在 AI 面板，用户作答后回传结构化答案。

**宿主面（已读源码确认，零修改）**：`packages/interaction/user-questions` 提供 `ctx.userQuestions`（`UserQuestionService`）：

- `registerProvider(provider: UserQuestionProvider): () => void`——唯一活动 provider，重复注册抛 `DUPLICATE_PROVIDER`；
- `ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>`——服务侧（工具调用方）阻塞等待 UI 回答；
- 答案编码：`AskUserQuestionAnswer { answers: AskUserQuestionAnswerItem[] }`，每项 = `{ questionId, answer?: string }`（选项标签回传，含自由文本 "Other"）。

**实现方法**：

1. host `index.ts` inject 增加 `'userQuestions'`；apply 期调用 `ctx.userQuestions.registerProvider({ ask })`，disposer 进 `ctx.on('dispose')`。
2. 桥接：host 把请求推入浏览器侧（复用现有 HTTP 事件流或新增 `GET /api/code-workbench/questions/current` 轮询 + `POST .../answer`）；客户端 AiPanel 维护 `currentQuestion` 状态。
3. UI：`data-chat-question` 卡片升级为完整表单——单选/多选/自由文本（按 `AskUserQuestionItem` 的选项结构渲染）；提交 → `POST answer`（JSON：`{ questionId, answer }` 数组）→ host resolve promise。
4. 超时/中断：请求的 `signal` 中止时 host 侧 reject，UI 收 `data-chat-question-closed` 收尾。

**验收标准**：host 桥接单测（provider 注册唯一性、ask-resolve 闭环、signal 中止）≥4 条；客户端表单渲染 + 提交 payload 断言 ≥3 条。

### 4.6 P4-3：编辑器选区 → prompt 上下文注入

**目标**：用户在编辑器选中文本 → AI 面板出现「Add selection」chip → 点选后选区作为附件进入下一次 prompt（并显示在输入框上下文栏，可移除）。

**实现方法**：

1. 编辑器层暴露选区事件：WorkbenchShell 持 `selection: { groupId, path, startLine, startCol, endLine, endCol, text } | undefined`（textarea `onSelect` 更新）。
2. AI 面板 chip：选区非空时显示 `+ @file:Ln-Ln` chip；点击把选区加入 `pendingContext: SelectionRef[]`，输入框上方渲染 chip 列表（可 x 移除）。
3. **注入路径（唯一待验证点）**：本体会话 input 附件 API——首选 `ctx.sessions` 的会话 send 接口的 attachments 参数或 `inputTriggers` 注入文本；实现前先读 `packages/client/runtime` 的 send 签名与 `ui-commands` 的 `inputTriggers` 消费方式，选文本插入（`@file:Ln` 引用行 + 选区文本块）作为保底方案。**保底方案零宿主依赖**：选区内容直接拼入 prompt 文本，模型可读、日志可重建，符合「模型可见 ⟺ 已记录」不变量。

**验收标准**：选区事件捕获 1 条；chip 加/删 2 条；最终 send payload 含选区文本 1 条（按选定注入路径写断言）。

### 4.7 P4-4：diff 应用确认流

**目标**：模型产生文件修改（工具 `fs/write` 类响应或带 diff 的回复）→ 编辑器区域弹出 diff 卡片（并排或行内 + 接受/拒绝）→ 接受后经版本校验写入。

**实现方法**：先做**行内确认**（v1，不实现 Monaco diff editor）：

1. 会话快照中工具调用结果为 diff 形态（`type: 'diff'`）时，AI 面板消息区渲染 DiffCard：文件路径、±行统计、折叠的 hunks 摘要。
2. 接受 → 客户端调 `FsClient.save`（带 currentVersion）应用；拒绝 → 仅丢弃卡片（记录 `data-diff-rejected`）。
3. 与 §2.7 审批流同构：DiffCard 复用锁存逻辑（一次决定，失败回滚状态）。

**验收标准**：渲染 1 条、接受写盘 1 条（mock FsClient 断言 save 参数）、拒绝不写 1 条、版本冲突降级为冲突对话框 1 条。

### 4.8 P5-1：Explorer 新建 / 重命名 / 删除

**目标**：Explorer 树右键与工具条支持新建文件/文件夹、重命名、删除（本体 fs 能力缺 rename/mkdir/remove 原语，插件内补齐）。

**实现方法**（决策：**方案 A——插件 host 端直接 Node fs 原语 + 本体策略门控**，不用 subprocess 跑 `mv`/`rm`，避免 Windows 命令差异与转义风险）：

1. 新增 `src/host/fs-ops-gateway.ts`：`POST /api/code-workbench/fs-ops`，op ∈ `{ mkdir, rename, remove }`；参数校验（路径必须在当前 workspace 根内——绝对化 + `path.relative` 前缀检查，拒绝 `..` 逃逸）。
2. 写前过**同一策略链**：复用 fs-gateway 的 `fs/write-intent` waterfall + `fs/observed` 记账（`WORKBENCH_ACTOR`），删除/重命名作为 write-intent 变体上报；被策略拒绝时返回 403 + 原因。
3. `fs-contract.ts` 增 `FsOpsClient`；QuickInput 支持「New File…」输入行（复用它做重命名输入框）。
4. 客户端 Explorer 树上下文菜单（依赖 §4.9 右键菜单基建）。

**验收标准**：路径逃逸拒绝 2 条（`..`、绝对路径外）；策略拒绝透传 1 条；三 op 各 1 条成功 + 树刷新；重命名后的 tab path 跟随更新（若该文件正开在编辑器）。

### 4.9 P5-2：Search 视图

**目标**：活动栏 Search → 侧边栏搜索框 → 结果树（文件 + 行号 + 片段）→ 点击跳到编辑器定位。

**实现方法**：host 端 `POST /api/code-workbench/search`（pattern + 可选 glob），复用 `walkFiles` BFS（排除规则同 listAll），服务端逐文件 grep（返回命中文件、行号、上下文行；上限 500 命中防爆）。客户端 SearchView 渲染结果树，点击 = `openFileIntoEditor` + 滚动定位（复用 Ln/Col 定位逻辑）。

**验收标准**：host 搜索单测 3 条（命中/无命中/上限截断）；客户端渲染 + 跳转 2 条。

### 4.10 P5-3：Settings 视图 + Light+ 主题

**目标**：设置面板可改：主题（Dark Modern / Light+）、字体大小、minimap 开关、AI 助手默认停靠位；全部即时生效（主题无 reload）并持久化（`dsh.workbench.settings.v1`）。

**实现方法**：

1. `theme/tokens.ts` 双层化：`COLORS.dark` 为主，新增 `COLORS.light`（取自 VS Code `light_plus.json` 基准）；`inject.ts` 按 `data-dsh-code-workbench-theme="dark|light"` 重灌 CSS（`ensureWorkbenchTheme(doc, theme)`，切换时移除旧 style 再注入新——属性值变化驱动）。
2. settings store：`defineStore` + persist；Settings 视图渲染表单（复用 activity `settings` 已有占位）。
3. minimap 开关仅存设置并挂到编辑器 region 渲染条件（v1 minimap 为简单右侧缩略滚动条，无内容预览；v2 再上内容级 minimap）。

**验收标准**：主题切换后 CSS 变量值断言（注入的 style 内容变化）；设置持久化刷新恢复；minimap 开关渲染断言。

### 4.11 P5-4：右键菜单（context menu）

**目标**：Explorer 树 / tab / 编辑器面 / 聊天消息四处右键菜单，命令复用 COMMANDS 表（ID + 分组）。

**实现方法**：MENUS 表加 `explorer/context`、`editor/title/context`、`editor/context`、`chat/context` 四区；`ContextMenu` 组件（absolute 定位、视口边界翻转、Esc/外点关闭）；各区域 `onContextMenu` 组装可见命令（按区过滤 + 前置条件如「选中文件」「tab 存在」）。

**验收标准**：每区渲染 1 条 + 边界翻转 1 条 + Esc 关闭 1 条 + 命令触发 2 条（如 Explorer 删除调 fs-ops）。

### 4.12 P5-5：PTY 级终端（已确认宿主原语）

**目标**：终端获得真实 TTY 语义——前台进程组信号（Ctrl+C 到前台作业）、resize、`vim`/`top` 等全屏程序可用。

**宿主面（已读源码确认，零修改）**：`packages/subprocess/subprocess` 的 `ctx.subprocess`（`SubprocessRuntime`）提供 `spawnTerminal(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle>`——终端分配、字节 I/O、前景组、信号、整会话树清理一体，spec 含 dimensions、grace、allocation cancellation。这比自带 node-pty 正确：插件不打包原生模块，任意设备可用，且获得本体的 tree-scoped 清理保证。

**实现方法**：

1. host `index.ts` inject 增加 `'subprocess'`。
2. `terminal-gateway.ts` 增 `spawn-pty` 模式：`ctx.subprocess.spawnTerminal(...)`，输出流接线到现有 stream 通道；`resize` 消息映射到终端 handle 的 resize；kill 映射 terminate。
3. **降级**：未注入 subprocess（或 provider 不可用）时自动回退现有 node:child_process 管道模式——插件在极简 profile 下仍可用。
4. 客户端终端组件：xterm 风格的 ANSI 渲染已有管道实现，PTY 只是传输层升级，交互不变（键盘输入 → send、尺寸变化 → resize）。

**验收标准**：host 侧 PTY 分支单测（spawn/kill/resize 调通 mock handle）3 条；回退分支 1 条；既有终端客户端测试保持全绿。

### 4.13 P5-6：和弦快捷键（Ctrl+K 前缀）+ ui-commands 互通

**目标**：Ctrl+K 后跟第二键（Ctrl+K Z = zen、Ctrl+K Ctrl+\ = 上下拆分）；与宿主输入框的斜杠命令 popup 不冲突。

**实现方法**：`keybindings.ts` 增 pending chord 状态：首个 chord 命中前缀后进入 pending（状态栏显示 `(Ctrl+K) was pressed. Waiting for second key...`——VS Code 原文），超时 1s 或按 Esc 取消；第二键 resolve 完整命令。宿主的 `conversation.input.overlay` slot（`ui-commands` 已确认存在）属于 harness 模式输入框，workbench 模式不渲染宿主输入框，故无冲突——仅在规格记录该 slot 供未来「命令面板互通」用，v1 不做。

**验收标准**：chord 命中/超时/Esc 各 1 条；Ctrl+K Ctrl+\ 触发正交拆分 1 条。

## 5. 最终实现效果

以下为全部目标落地后的端到端体验（用户视角）：

**启动与切换**：`dsh plugin --profile web add dsh-code-workbench` 安装后，harness 界面右上角出现「Open Code Mode」悬浮胶囊；点击即整页切换为 VS Code 形态。编码模式状态栏最右的「Exit Code Mode」一键切回原生样式。模式选择、布局、设置全部本地持久化，刷新与换设备（同 profile 迁移）不丢。

**编码模式全貌**：从标题栏、菜单栏（含快捷键标注的下拉菜单）、活动栏（Explorer / Search / Settings 三图标 + 2px 激活指示条）、侧边栏、标签页组、编辑区、面包屑、状态栏（分支/错误计数/Ln-Col/主题切换/退出按钮），到 Sash 拖动、面板停靠与最大化、zen 模式、Ctrl+P 快速打开与 Ctrl+Shift+P 命令面板——观感、尺寸、颜色、图标与 VS Code 1.96 深色/浅色主题逐项对齐。编辑器支持左右/上下拆分、tab 跨组拖拽、preview 斜体标签、Ctrl+S 版本保护保存、Ctrl+G 跳行。

**AI 助手（辅助栏，可自由停靠）**：右侧辅助栏的 AI 面板是完整原生 DeepSeek Harness 会话——历史会话列表、新会话、流式回复、子代理与全部工具能力。它与编辑器双向联动：选中文本一键注入 prompt 上下文；模型产生的文件修改以 diff 卡片呈现，一键接受即写盘（版本冲突有明确选择）；模型调用 ask_user_question 时问题卡片在面板内作答；权限审批以 VS Code 风格的确认卡完成（允许/拒绝/错误重试）。面板可整体拖到主侧边栏、底部面板或浮窗，切换不打断会话。

**终端**：底部面板内置 PTY 终端——`vim`、`top`、交互式 CLI 完整可用，Ctrl+C 正确作用于前台作业，调整面板大小实时同步终端尺寸；极简 profile 下自动退化为管道模式。

**与宿主的关系**：本体仓库零改动；插件只在编码模式接管整页（root slot 显式 `priority: -1` shadow），harness 模式原样运行。文件写操作始终经过本体的策略链与观察者记账，与原生模式的权限、审计语义完全一致。

## 6. 质量门禁

- **单测**：vitest + jsdom；新增功能必须先写测试再合入；当前 ~76 条全绿是基线。测试别名（runtime-stub / ui-primitives-stub）不变。
- **不变量**：组件内无颜色字面量（theme.spec 扫描）；所有模型可见输入可从会话日志重建；所有文件写操作过策略链。
- **静态**：typecheck + lint 通过；tsdown 构建通过（web 插件形态，宿主侧用 `dsh plugin` 安装烟测）。
- **每完成一个 P3/P4/P5 项**，更新本文件 §2/§3 对应行，保证文档与实现同步。

## 7. 决策记录与风险

| 决策 | 结论 | 理由 |
|---|---|---|
| PTY 实现路径 | 消费本体 `ctx.subprocess.spawnTerminal`，插件不打包 node-pty | 原生模块破坏「任意设备」约束；本体已有完整 PTY 原语 + tree-scoped 清理；降级回管道模式 |
| Explorer 增删改路径 | host 端 Node fs 原语 + 既有 write-intent 策略链（方案 A） | subprocess 跑 shell 命令有 Windows 差异与转义风险；策略门控与审计一致性是硬要求 |
| 主题基准 | Dark Modern / Light+（1.96.0 的 `dark_modern.json`、`light_plus.json`） | `dark_defaults.json` 已不随版本分发（404），现代主题文件即默认主题的真实令牌源 |
| 编辑器拆分层级 | v1 只支持一层拆分（≤2 组） | 多层树形拆分复杂度陡增且非核心体验；记为已知限制，v2 演进 |
| 宿主互操作 | 只读消费公开面（sessions/slots/fs/subprocess/userQuestions/defineStore） | 「零修改本体」约束；所有引用面均已读源码确认存在且版本兼容 |
| 待验证点 | 选区注入的会话 input API 形态 | 实现前读 `packages/client/runtime` send 签名；保底方案（文本拼接注入）零宿主依赖且满足「模型可见 ⟺ 已记录」 |
