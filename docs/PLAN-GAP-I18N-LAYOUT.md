# 与 VS Code 差距分析 + 中文化 + 布局升级规划

> 状态：规划文档（未实施）。基于 2026-08-17 代码全量盘点。
> 前置：[SPEC.md](./SPEC.md)（已完成项）、[PLAN-VSCODE-ALIGNMENT.md](./PLAN-VSCODE-ALIGNMENT.md)（对齐起源）。

## 目录

1. [与 VS Code 的真实差距](#一与-vs-code-的真实差距)
2. [欠缺的功能与体验清单](#二欠缺的功能与体验清单)
3. [中文化（i18n）实现规划](#三中文化i18n实现规划)
4. [整体布局升级规划](#四整体布局升级规划)
5. [优先级与里程碑](#五优先级与里程碑)
6. [风险与依赖](#六风险与依赖)

---

## 一、与 VS Code 的真实差距

按区域逐项对比。⭐ = 已达 VS Code 基本形态；⚠ = 有骨架但断线/降级；✗ = 完全缺失。

### 1.1 编辑器内核（Monaco 集成深度）

| 能力 | VS Code | 本插件现状 | 差距定级 |
|---|---|---|---|
| 文本编辑/语法高亮 | 完整 | Monaco 运行时加载，33 种扩展名映射 | ⭐ |
| 主题跟随 | 编辑器主题随工作台主题切换 | **`EditorSurface.tsx:91` 硬编码 `theme: 'vs-dark'`**——SettingsView 切到 Light+ 后外壳变亮、编辑器仍全黑 | ⚠ **断线 bug** |
| Minimap | 可开关、可渲染 | **`EditorSurface.tsx:93` 硬编码 `minimap: { enabled: false }`**——SettingsView 的 Minimap 开关只写 localStorage，从未传给 Monaco | ⚠ **断线 bug** |
| 查找替换 (Ctrl+F) | 编辑器内建 Find Widget，主题适配 | Monaco 自带但主题是 vs-dark 暗皮肤，Light+ 下样式撕裂；跨文件查找无 | ⚠ |
| 多光标/列选择 | 完整 | Monaco 自带，透传正常（未加破坏性配置） | ⭐（默认） |
| Sticky Scroll、Bracket Guides、字体缩放 (Ctrl+=/-)、折行开关 | 完整 | 均未开启/未接线 | ✗ |
| Undo/Redo 命令化 | 命令面板 + 菜单可达 | 依赖 Monaco 内建 Ctrl+Z，`COMMANDS` 表中无 `undo`/`redo` 条目，菜单/面板不可达 | ✗ |
| Diff 编辑器（并排/内联） | 标准能力 | 仅 AI 面板 DiffCard 有折叠文本预览，无真正 Monaco diff editor | ✗ |
| per-language 设置（tabSize per lang 等） | 完整 | 全局写死 `tabSize: 2` | ✗ |

### 1.2 资源管理与 Git

| 能力 | VS Code | 本插件现状 |
|---|---|---|
| Source Control 视图（更改列表、暂存、提交信息框） | 核心视图 | ✗ 无 |
| Explorer 文件名 Git 装饰（M/U/D 着色） | 默认有 | ✗ 无 |
| 行内变更指示（gutter 蓝/绿/红三角） | 默认有 | ✗ 无 |
| 行内 blame、Timeline 视图 | 内建/扩展 | ✗ 无 |

**依赖判断**：本体 `dsh` 未暴露 git 能力面；按零修改约束，Git 功能必须在插件 host 半自建 `git-gateway.ts`（`node:child_process` 调用系统 `git` 可执行文件，`--porcelain` 输出解析），策略链可复用 `fs/write-intent` 的模式（读操作无策略、仅账目）。

### 1.3 搜索

| 能力 | VS Code | 本插件现状 |
|---|---|---|
| 大小写敏感 / 全字匹配 / 正则 | 三开关 | ✗ 仅字面 `String.includes`（`search-gateway.ts:101`） |
| 替换（单文件/全部） | 完整 | ✗ 无 |
| include/exclude glob | 完整 | ⚠ 仅请求级可选 glob，UI 无入口；glob 实现是 `*`→`.*` 的朴素转换（`search-gateway.ts:127-129`），`**` 一律放行 |
| 按文件分组折叠结果树 | 完整 | ⭐（`SearchView` 分组 + 展开计数） |
| 结果上下文行 | 完整 | ⭐ 每侧 1 行（`CONTEXT_LINES = 1`）；VS Code 默认无上下文但可开 |
| 保留最近搜索 | 完整 | ✗ 无 |
| 在当前文件内查找 | 完整 | ✗ 无（依赖 Monaco Ctrl+F） |

### 1.4 命令与快捷键

| 能力 | VS Code | 本插件现状 |
|---|---|---|
| 命令数量 | 数百 | **17 条**（`workbench.action.*` 清单见 `commands.ts`） |
| 缺失的高频命令 | — | `gotoLine`、`gotoSymbol`、`formatDocument`、`copyFilePath`、`reopenClosedEditor`、`closeAllEditors`、`undo`/`redo`、`findInFiles`、字体缩放族 |
| 键位自定义 UI | 完整 | ✗ 无（`DEFAULT_KEYBINDINGS` 单表，用户不可改） |
| when 子句（上下文条件键） | 完整 | ✗ 无（全局监听 window keydown，编辑器聚焦时 shell 键与 Monaco 键可能争抢，如 Ctrl+P 在 Monaco 有 focus 时 Monaco 先吃掉） |
| 键位冲突提示 | 完整 | ✗ 无 |

### 1.5 面板生态（下方面板）

| VS Code 面板标签 | 本插件现状 |
|---|---|
| TERMINAL | ⭐ 单会话 xterm + SSE |
| PROBLEMS | ✗ 无（无数据源：本体 LSP/诊断未暴露给插件） |
| OUTPUT | ✗ 无 |
| DEBUG CONSOLE | ✗ 无（范围外，见 SPEC §1 排除项） |
| PORTS | ✗ 无（范围外） |

**终端自身差距**：单会话无终端标签页、无拆分（split terminal）、管道模式非 PTY（无 TTY 任务控制、无 resize 信号、`shell prompt` 交互降级）、无持久化会话恢复。`TerminalPanel.tsx` 中无任何 tab 结构（grep 证实 0 处）。

### 1.6 Quick Input

| 能力 | VS Code | 本插件现状 |
|---|---|---|
| 文件/命令/prompt 三模式 | — | ⭐ |
| `:行号` 跳转、`@符号`、`#文件`、`?帮助` 修饰符 | 完整 | ✗ 无 |
| 最近打开排序（MRU 权重） | 完整 | ⚠ 仅 fuzzy 分数 |
| 多选（multi-select Quick Pick） | 完整 | ✗ 无 |

### 1.7 其他体验缺口

- **面包屑**：仅展示（`EditorArea.tsx:282`），不可点击跳转段。
- **标签页**：支持拖拽到另一组、中键关闭、预览斜体 ⭐；缺溢出下拉菜单（`...`）、缺「显示已打开编辑器」列表视图、缺拖出成浮动窗口。
- **通知中心**：无 toast、无铃铛收件箱（保存失败等错误只在编辑器工具条内联展示）。
- **标题栏**：无居中 Command Center（VS Code 1.73+ 的搜索框式入口）。
- **布局控制按钮组**：无右上角「面板/侧栏/辅助栏/次级栏」一键开关组（VS Code 1.84+）。
- **设置**：仅 2 个开关（主题/Minimap），非可搜索设置编辑器。
- **国际化**：全部硬编码英文（§三）。

---

## 二、欠缺的功能与体验清单

按「用户可感知」排序，标注根因层（UI 断线 / 数据源缺失 / 网关缺失）：

### P0 级（接线 bug，用户立刻可感知）

1. **Light+ 主题不作用于编辑器**——Monaco `vs-dark` 硬编码。修复：主题切换时 `monaco.editor.setTheme('vs')` + 定义与 `LIGHT_COLORS` 对齐的自定义 Monaco 主题。
2. **Minimap 开关不作用于编辑器**——`minimap.enabled: false` 硬编码。修复：EditorSurface 接收 `minimapEnabled` prop（从 settings store 读），`editor.updateOptions({ minimap: { enabled } })`。
3. **快捷键在编辑器聚焦时行为不确定**——window 级监听与 Monaco 焦点争抢（Ctrl+P/Ctrl+S 等）。需定义焦点上下文规则（§4.4）。

### P1 级（高频功能缺失）

4. 状态栏信息贫乏：无 Git 分支、无错误/警告计数、无缩进（空格数可点切换）、无 EOL（LF/CRLF）、无语言模式可点切换。
5. 搜索无正则/大小写/替换——VS Code 用户肌肉记忆冲突最大点。
6. 终端无多标签。
7. 命令面板缺 `gotoLine`/`formatDocument`/`copyPath` 等高频命令。
8. 中文化（§三整体）。

### P2 级（形态补齐）

9. 活动栏视图不全：缺 Source Control、Run/Test、Extensions 图标位；Settings/Accounts 应沉底（VS Code 惯例）。
10. 面板单标签：应升级为 Terminal/Problems/Output 多标签容器（Problems/Output 需新数据源，可先占位）。
11. 标签页溢出菜单 + 已打开编辑器列表。
12. 面包屑可点击导航。
13. 字体缩放（Ctrl+= / Ctrl+- / Ctrl+0）与折行开关（Alt+Z）。

### P3 级（深度体验）

14. Monaco sticky scroll / bracket guides / guides 高级开关接入 Settings。
15. QuickInput 修饰符（`:line` `@symbol`）。
16. 键位自定义（读 cordis.yml config 或 localStorage 层覆盖表）。
17. 通知中心 + toast。
18. 编辑器 diff 视图（Monaco `createDiffEditor`，服务 AI DiffCard 的「在编辑器中查看」）。

---

## 三、中文化（i18n）实现规划

### 3.1 目标

- UI 全量 **zh-CN / en 双语**，默认语言可跟随浏览器（`navigator.language`）+ 手动切换（Settings 新增「语言」节）。
- 零修改本体：语言表完全在插件内；dsh 宿主侧文案（如 session 标题）不翻译，只翻插件自持字符串。
- 切换即时生效（无需 reload）：所有文案经 context 订阅。

### 3.2 架构

```
src/client/i18n/
  messages.ts      # 类型：MessageId → string（从使用点收键，编译期防漏译）
  zh-CN.ts         # 中文表
  en.ts            # 英文表（迁移现有硬编码字符串）
  I18nProvider.tsx # React context + useT() hook + 语言 preference 持久化
```

核心约定：

1. **消息表 keyed by 语义 id**，不用英文原文当 key（避免改英文文案时中文失效）：
   ```ts
   // messages.ts
   export const messageIds = [
     'menu.file', 'menu.edit', 'menu.view', 'menu.help',
     'cmd.showCommands.title', 'cmd.quickOpen.title',
     'status.codeMode', 'status.exitCodeMode',
     'settings.theme.label', 'settings.theme.dark', 'settings.theme.light',
     'settings.minimap.label', 'settings.minimap.on', 'settings.minimap.off',
     'explorer.newFile', 'explorer.newFolder', 'explorer.rename', 'explorer.delete',
     'editor.save', 'editor.saving', 'conflict.title', ...
   ] as const
   export type MessageId = typeof messageIds[number]
   ```
2. **`useT()` 返回 `t(id, params?)`**；插值用 `{n}` 占位（避免引入 i18n 依赖，符合"优先维护依赖"原则前先评估：消息表 <100 条时手写插值足够，超过 200 条再评估 `intl-messageformat`）。
3. **命令表联动**：`CommandEntry.title` 从 string 改为 `MessageId`，palette/menu/keybinding label 统一经 `t()` 渲染——一处翻译三处生效（沿用单表驱动设计）。
4. **复数与格式**：中文无数形变化，跳过 ICU 复数；日期/数字如出现用 `Intl` 标准件。
5. **语言偏好**：进 `settings/store.ts`（key `dsh.workbench.language`，值 `zh-CN | en | auto`）。

### 3.3 分阶段落地

| 阶段 | 范围 | 估字符串量 | 验收 |
|---|---|---|---|
| M1 框架+壳 | I18nProvider、语言设置项、菜单栏、活动栏 tooltip、状态栏、QuickInput 标题 | ~80 | 切语言后菜单/状态栏即时切换；`t()` 未命中 id 时 fail-loud（开发态 throw，与「misconfiguration fails loud」约定一致） |
| M2 编辑区 | 标签页 aria、冲突对话框、保存错误、面包屑、欢迎页 | ~50 | Light/Dark × zh/en 四象限快照 |
| M3 资源区 | Explorer（新建/重命名/删除 prompt 与错误）、Search（空态/错误）、Settings 全部、终端（重启/退出提示） | ~60 | 同上 |
| M4 AI 面板 | 角色名、Thinking…、审批卡（Allow Once/Reject）、提问卡（跳过/回答）、diff 卡（接受/拒绝/冲突） | ~40 | 审批/提问卡片双语快照 |

### 3.4 术语表（中英对照，翻译前冻结）

| 英 | 中 | 备注 |
|---|---|---|
| Explorer | 资源管理器 | VS Code 官方简中译法 |
| Search | 搜索 | |
| Source Control | 源代码管理 | |
| Auxiliary Bar | 辅助侧边栏 | |
| Panel | 面板 | |
| Terminal | 终端 | |
| Problems | 问题 | |
| Output | 输出 | |
| Command Palette | 命令面板 | |
| Quick Open | 快速打开 | |
| Preview tab | 预览标签页 | 斜体未固定语义 |
| Dirty (tab) | 已修改 | 不译 "脏" |
| Minimap | 小地图 | |
| Zen Mode | 禅模式 | |
| Split Editor | 拆分编辑器 | |
| Allow Once / Reject | 允许一次 / 拒绝 | 审批卡按钮 |
| Code Mode | 编码模式 | 与「原生模式」对举 |

### 3.5 排除项

- Monaco 内建 UI（Find Widget、右键菜单、IntelliSense 提示）的汉化走 Monaco `nls` 配置——运行时从 CDN 加载 `vscode-nls` 语言包有版本对齐风险，**一期不做**，二期评估自托管 zh 语言 json。
- 宿主 dsh 会话/工具文案：不属插件字符串，不翻。

---

## 四、整体布局升级规划

### 4.1 现状骨架（已达成）

```
┌─ TitleBar + MenuBar（File/Edit/View/Help 下拉）────────────────┐
├─ ActivityBar(48) ─┬─ Sidebar(300,可折叠) ─┬─ EditorArea ─┬─ AuxBar(300) ─┤
│  Explorer         │  按活动切换:           │  Breadcrumbs │  AI 助手      │
│  Search           │  files/search/settings │  Tabs(35)    │  (四停靠已通) │
│  Settings         │                        │  Monaco      │               │
│  ─────────        │                        │  Toolbar     │               │
│  AI Assistant     │                        ├─ Panel(bottom/left/right) ───┤
│                   │                        │  Terminal(单会话)            │
├─ StatusBar(22): CodeMode | Ln Col | UTF-8 | 布局开关 | ExitCodeMode ──────┤
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 目标布局（VS Code 1.96 形态补齐）

```
┌─ TitleBar：菜单 + [Command Center 居中搜索框] + [右上布局按钮组⋮] ──────┐
├─ ActivityBar ─┬─ Sidebar ────────────────┬─ EditorArea ─┬─ AuxBar ──────┤
│  ⬚ Explorer   │  多视图堆叠(collapsed     │  Breadcrumbs(可点击)         │
│  ⌕ Search     │   sections，见4.2.1)     │  Tabs(+溢出菜单)             │
│  ⑂ Source Ctrl│                          │  Monaco(minimap接线,         │
│  ▷ Run/Test   │                          │   sticky scroll)            │
│  ⧉ Extensions │                          │  Toolbar                    │
│  ── 沉底 ──   │                          ├─ Panel(多标签) ─────────────┤
│  ◯ Accounts   │                          │  [Terminal][Problems][Output]│
│  ⚙ Settings   │                          │   终端标签页 + 拆分          │
├─ StatusBar：分支 | Ⓐ错误 ⚠警告 | Ln,Col | 空格:2 | UTF-8 | LF | TS | 布局组 ┤
└────────────────────────────────────────────────────────────────────┘
```

#### 4.2.1 活动栏重构（P2 布局期）

- `ActivityId` 扩为 `'files' | 'search' | 'scm' | 'run' | 'extensions' | 'settings'`。
- 图标纵列分两段：主视图在顶，`Accounts`/`Settings` 沉底（flex column + `margin-top: auto`）——现状 Settings 与 Explorer 同列，属形态偏差。
- SCM/Run/Extensions 一期注册图标+空态视图（「需要 git / 无测试提供方 / 扩展系统范围外」说明卡），不空悬死链；SCM 在 §五 P4 变真。

#### 4.2.2 侧边栏视图堆叠

VS Code 侧边栏是「一个活动 = 一个 view container，内含多个可折叠 section」。现状 SearchView/SettingsView 是独占整栏的单视图。升级为：

```
Explorer 容器 = [OPEN EDITORS(可关)] + [文件夹树]
Search 容器   = [搜索表单+结果] （现状即如此，达标）
```

`SidebarContent` 的 TITLES 分发保留，容器化改造集中在 Explorer 加 section 头。

#### 4.2.3 面板多标签容器（P2 布局期）

- 新 `PanelContainer`：标签行（VS Code `panelTitle` 样式已有）+ 活动视图。
- Terminal 标签页：会话数组（spawn 多次）、每 tab 一个 xterm 实例、`+` 新建、右键 kill；拆分（split）一期只做同面板纵向 split。
- Problems/Output 占位标签注册进 `panel` slot 机制，为后续数据源留位。

#### 4.2.4 状态栏富化（P1 布局期）

左：CodeMode 徽标（保留）+ Git 分支（P4 起）+ 错误/警告计数（P5 起）。
右：Ln,Col（已有）→ 缩进 `空格:2`（点击弹 2/4/8）→ 编码 UTF-8（一期静态）→ EOL LF（点击切 CRLF，写文件时转换，网关已有版本护栏）→ 语言 `TypeScript`（点击弹 QuickInput 选语言，改 Monaco model language）→ 现有布局开关组收编进右上角布局按钮组（4.2.5）。

#### 4.2.5 标题栏 Command Center + 布局按钮组（P2）

- Command Center：居中输入框，聚焦即开 QuickInput files 模式（VS Code 同款行为）；zen 模式隐藏。
- 布局按钮组：标题栏最右四个 toggle（主侧栏/面板/辅助栏/次级栏占位），替代现散落在状态栏右侧的三个按钮——状态栏那组移除，减少双入口。

#### 4.2.6 编辑器区补齐（P0 接线 + P3 深度）

- **P0**：minimap/theme 从 settings store 流入 EditorSurface（props 或 context selector），`editor.updateOptions` 响应式更新。
- 字体缩放：Ctrl+= / Ctrl+- / Ctrl+0 改 `fontSize`（Settings 持久化）。
- 折行：Alt+Z 切 `wordWrap`（per-tab 覆盖 + 默认设置）。
- Sticky Scroll：`experimental.stickyScroll.enabled`，进 Settings。
- 标签溢出：宽度不足时显示 `…` 活动列表菜单。
- 面包屑：每段可点，末段下拉列同级符号/文件（一期只做路径段跳转）。

### 4.3 数据流修正

现状 `WorkbenchShell` 侧边栏直接内联 FilesView/SearchView/SettingsView（本会话改动），`renderSlot('workbench.sidebar')` 分支实际不再走 apply.ts 注册的 `SidebarContent`——**存在双轨**：apply.ts:97 注册的 `SidebarContent` 与 shell 内联渲染并存，`slots.ts` 的 sidebar owner props（fsOpsSeq/explorerError）传给了不再消费它们的内联组件。布局升级时统一：

- 方案 A（推荐）：恢复 shell 经 `renderSlot('workbench.sidebar')` 渲染，`SidebarContent` 作为 slot 内容按 activity 分发到 FilesView/SearchView/SettingsView——slot 机制重新单一化，测试可继续用 stub 占位。
- 方案 B：删除 apply.ts 的 sidebar 注册，承认 shell 内联是唯一路径，`slots.ts` owner props 随之删。
- 无论 A/B，`fsOpsSeq`/`explorerError` 必须回流到 FilesView（当前内联版未接，explorer 错误提示实际断线）。

### 4.4 键盘焦点上下文（P1）

- 定义 `FocusZone: 'editor' | 'terminal' | 'quickinput' | 'chrome'`。
- shell 键分发前查活动 zone：editor zone 时仅拦截 shell 专属 chord（Ctrl+P/Ctrl+Shift+P/Ctrl+B 族），其余（Ctrl+F/Ctrl+Z/Ctrl+D）放行给 Monaco；terminal zone 时 Ctrl+`` ` ``/Ctrl+Shift+` 拦截、Ctrl+C/V 放行 xterm。
- 实现挂点：`document.activeElement` 最近祖先的 data 属性（`[data-workbench-editor-area]` / `[data-terminal-panel]`），无侵入。

---

## 五、优先级与里程碑

| 批次 | 内容 | 依赖 | 验收标准 |
|---|---|---|---|
| **B0 接线修复** | Monaco theme/minimap 透传（§1.1 两断线 bug）；侧边栏双轨收敛（§4.3）；explorer 错误回流 | 无 | Settings 切 Light+ 后 Monaco 同步变 `vs` 系主题；Minimap 开关实时生效；explorer 删除失败能看到错误条 |
| **B1 中文化 M1+M2** | i18n 框架 + 壳层 + 编辑区（§3.3） | B0（Settings 加语言节在同一视图） | zh/en 切换即时生效；命令面板/菜单/状态栏/设置/冲突框全双语；快照测试四象限 |
| **B2 布局形态** | 活动栏沉底+新视图位（§4.2.1）、面板多标签容器+终端多会话（§4.2.3）、状态栏富化静态项（§4.2.4）、Command Center+布局按钮组（§4.2.5）、焦点上下文（§4.4） | B1（新视图空态文案直接双语） | 终端可开 3 个标签独立交互；布局按钮组四开关可用；Ctrl+P 在编辑器聚焦时稳定开 QuickOpen |
| **B3 搜索升级** | 正则/大小写/全字、替换（单文件/全部）、include/exclude UI、glob 正确实现（`*` `**` `?` 语义）、上下文行可开 | 无强依赖 | host 网关 regex 测试含非法正则 400；替换走 write-intent 策略链（同 fs 网关身份） |
| **B4 Git 集成** | `git-gateway.ts`（status --porcelain / branch / stage / commit / diff）、Source Control 视图、Explorer 装饰、状态栏分支 | 系统 git 存在（缺失时视图显式降级提示） | 无 git 仓库时 SCM 视图显示空态不报错；提交走策略链账目 |
| **B5 中文化 M3+M4 + 设置编辑器化** | 资源区/AI 面板双语；Settings 升级为可搜索设置页（分组列表 + 搜索框，VS Code 设置 UI 精简版） | B1 框架 | 设置页可搜 "theme" 定位主题节；AI 审批卡双语快照 |
| **B6 深度编辑体验** | 字体缩放/折行/sticky scroll（§4.2.6）、gotoLine/gotoSymbol/format 命令、QuickInput `:line`、通知中心、diff 编辑器 | B0 | Ctrl+= 连续缩放在 9–30px 间；`:120` 直达行 |
| **B7 终端增强** | PTY 评估（本体 subprocess 面是否提供 PTY 类谓词；无则维持管道模式并在文档声明限制）、终端拆分、会话持久恢复 | 本体能力盘点 | 若 PTY 可用：resize 信号、Ctrl+C 中断行为对齐；不可用：限制说明进 Settings 帮助节 |

**明确不做**（沿用 SPEC §1 排除）：扩展市场、调试器、远程开发、Electron。Run/Test 与 Extensions 活动位是占位容器，不是功能承诺。

---

## 六、风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| Monaco 运行时加载与自定义主题注册 | Light+ 下 Monaco 需 `defineTheme` 对齐 `LIGHT_COLORS`，版本升级色板漂移 | 主题 json 由 `tokens.ts` 程序生成（单一来源原则延伸），测试断言两套色板键集合一致 |
| 键位与 Monaco 争抢（现状已有） | 用户感知「快捷键时灵时不灵」 | B2 焦点上下文先行，早于新命令扩充 |
| git-gateway 跨平台（Windows） | `git` 不在 PATH / CRLF 语义 | 探测失败显式降级；diff 用 `--no-color` 固定输出 |
| 消息表膨胀后插值/选择需求 | 手写插值不够 | >200 条时评估 `intl-messageformat`（符合"优先维护依赖"决策门槛） |
| 侧边栏双轨（§4.3）未收敛先叠加新视图 | 布局升级工作量翻倍 | B0 强制先收敛，再动 B2 |
| 本体 LSP/诊断无暴露面 | Problems 面板无数据源 | 占位标签 + 空态说明；不为此打洞本体（约束 1） |
| 终端 PTY 依赖原生模块 | 违反「无原生依赖」约束（SPEC §1.3） | 仅当本体 subprocess 提供 PTY 谓词才启用；否则文档化管道模式限制 |

---

## 附：现状盘点快照（2026-08-17）

- 测试：30 files / 263 tests 全绿；typecheck 零错误。
- 代码量：WorkbenchShell 594 行、css.ts 1415 行、codicons 203 行（19 图标）。
- 命令：17 条 `workbench.action.*`。
- 网关：fs / fs-ops / search / terminal / monaco-static / active-file 共 6 个 host 路由组。
- QuickInput 模式：files / commands / prompt。
- i18n：无（全英文硬编码）。
