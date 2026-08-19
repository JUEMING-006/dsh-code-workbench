# 实施指导文档（Implementation Guide）

> 基于 [PLAN-GAP-I18N-LAYOUT.md](./PLAN-GAP-I18N-LAYOUT.md) 差距分析。
> 每个批次包含：目标、精确文件改动清单、代码模式、测试策略、验收标准。
> 不修改宿主仓库（`packages/`），仅在 `dsh-code-workbench/` 内工作。

---

## B0：接线修复 + 侧边栏双轨收敛

### 目标

修复三个用户立即可感知的 bug，收敛 sidebar 双轨渲染路径。

### B0-1：Monaco 主题跟随工作台主题

**问题**：`EditorSurface.tsx:91` 硬编码 `theme: 'vs-dark'`。SettingsView 切到 Light+ 后外壳变亮、编辑器全黑。

**改动文件**：

1. **`src/client/editor/EditorSurface.tsx`**
   - `EditorSurfaceProps` 新增可选字段：
     ```ts
     readonly theme?: 'vs-dark' | 'vs' | 'hc-black'
     ```
   - `MonacoEditorSurface` 接收 `theme`，创建时传入，并在后续 effect 中响应式更新：
     ```ts
     // 创建时
     theme: props.theme ?? 'vs-dark',

     // 新增 effect：主题切换时 updateOptions
     useEffect(() => {
       const editor = editorRef.current
       const monaco = monacoRef.current
       if (editor !== null && monaco !== null) {
         monaco.editor.setTheme(props.theme ?? 'vs-dark')
       }
     }, [props.theme])
     ```
   - **注意**：不要用 `editor.updateOptions({ theme })`——Monaco 的 `theme` 不走 `updateOptions`，必须用 `monaco.editor.setTheme()`。

2. **`src/client/workbench/editor-context.ts`**
   - `WorkbenchServices` 新增：
     ```ts
     /** Current workbench theme (propagated to editor surfaces). */
     readonly theme?: ThemePreference
     ```
   - 导入 `ThemePreference` from `../settings/store.ts`。

3. **`src/client/workbench/WorkbenchShell.tsx`**
   - 导入 `readTheme` from `../settings/store.ts`。
   - 在 shell mount 时读取初始主题并写入 `servicesRef.current.theme`：
     ```ts
     const [theme, setTheme] = useState<ThemePreference>(() => readTheme(globalThis.localStorage))
     // ...
     servicesRef.current.theme = theme
     ```
   - 监听 `storage` 事件（跨标签页同步）或让 SettingsView 通过回调通知 shell（后者更简单）：
     - 方案 A（推荐）：`WorkbenchServices` 新增 `setTheme: (t: ThemePreference) => void`，SettingsView 通过 `useWorkbench()` 调用它而非直接写 `document.documentElement.dataset`。
     - Shell 在 `setTheme` 里同步更新 `servicesRef.current.theme` + `document.documentElement.dataset.workbenchTheme` + localStorage。

4. **`src/client/workbench/parts/SettingsView.tsx`**
   - 改用 `useWorkbench()` 获取 `setTheme` 回调，不再直接写 DOM 和 localStorage：
     ```ts
     const applyTheme = (next: ThemePreference): void => {
       setTheme(next)
       services.setTheme?.(next)
     }
     ```

5. **`src/client/workbench/parts/EditorArea.tsx`**
   - `EditorGroupView` 从 `useWorkbench()` 读 `theme`，传给 `<Surface theme={theme} ...>`。

6. **`src/client/theme/css.ts`**
   - Light+ 主题已有 `[data-workbench-theme="light"]` 覆盖块——确认 Monaco 容器（`.dsh-wb-editortoolbar`、`.dsh-wb-editorbody`）背景色跟随 editor.background 令牌。若 Monaco 主题是 `vs`，其自带背景色正确，无需额外 CSS。

7. **`src/client/workbench/parts/SettingsView.spec.tsx`**（新建或修改现有）
   - 快照测试：切换主题后验证 `data-workbench-theme` 属性值。
   - 验证 `setTheme` 被调用（mock WorkbenchContext provider）。

8. **`src/client/editor/EditorSurface.spec.tsx`**（若存在则修改）
   - 验证 `MonacoEditorSurface` 接收 `theme='vs'` 时 `monaco.editor.setTheme('vs')` 被调用。

### B0-2：Minimap 开关接线

**问题**：`EditorSurface.tsx:93` 硬编码 `minimap: { enabled: false }`。geometry store 有 `minimapEnabled` 字段，SettingsView 的开关只写 localStorage，从未传给 Monaco。

**改动文件**：

1. **`src/client/editor/EditorSurface.tsx`**
   - `EditorSurfaceProps` 新增：
     ```ts
     readonly minimapEnabled?: boolean
     ```
   - `MonacoEditorSurface` 创建时：
     ```ts
     minimap: { enabled: props.minimapEnabled ?? true },
     ```
   - 新增 effect：
     ```ts
     useEffect(() => {
       const editor = editorRef.current
       if (editor !== null) {
         editor.updateOptions({ minimap: { enabled: props.minimapEnabled ?? true } })
       }
     }, [props.minimapEnabled])
     ```

2. **`src/client/workbench/WorkbenchShell.tsx`**
   - 从 geometry store 读 `minimapEnabled`，通过 `useLayout` 或直接 `props.useStore` 选择器注入 services：
     ```ts
     const minimapEnabled = props.useStore(s => s.minimapEnabled)
     servicesRef.current.minimapEnabled = minimapEnabled
     ```

3. **`src/client/workbench/editor-context.ts`**
   - `WorkbenchServices` 新增：
     ```ts
     readonly minimapEnabled?: boolean
     ```

4. **`src/client/workbench/parts/EditorArea.tsx`**
   - `EditorGroupView` 从 `useWorkbench()` 读 `minimapEnabled`，传给 `<Surface minimapEnabled={minimapEnabled} ...>`。

5. **`src/client/workbench/parts/SettingsView.tsx`**
   - Minimap 切换改为调用 layout store action：
     ```ts
     const applyMinimap = (next: boolean): void => {
       setMinimap(next)
       writeMinimap(globalThis.localStorage, next)
       // 通知 shell 更新 geometry store
       services.layoutActions?.toggleMinimap?.() // 若 next !== current
       // 或更精确：直接写入
     }
     ```
   - **注意**：当前 `PanelActions` 接口没有 `toggleMinimap`（它只在 `geometry.ts` 的 actions 里）。需要在 `WorkbenchServices` 上加 `layoutActions` 或在 shell 层面把 geometry actions 暴露出来。
   - **推荐做法**：`WorkbenchServices` 已经有 `panelActions`（类型 `PanelActions`），`PanelActions` 不含 `toggleMinimap`。新增一个 `LayoutActions` 接口或在 `PanelActions` 里加 `toggleMinimap`：
     ```ts
     // editor-context.ts
     export interface PanelActions {
       // ...existing
       toggleMinimap(): void
     }
     ```
   - Shell 在 servicesRef 赋值时加上：
     ```ts
     servicesRef.current.panelActions = {
       // ...existing
       toggleMinimap: () => { actions.toggleMinimap() },
     }
     ```

6. **`src/client/workbench/geometry.ts`**
   - `DEFAULT_GEOMETRY.minimapEnabled` 当前是 `true`。确认 `readMinimap` 默认值也是 `true`（`settings/store.ts:31` 是 `true`）——一致。但 geometry store 的 persist key `dsh.workbench.layout.v2` 里可能存了旧值（`minimapEnabled` 可能不在旧持久化数据里）。`defineStore` 的 `init` 用 `{ ...DEFAULT_GEOMETRY }` 展开，缺失字段会取默认值——安全。但若用户已持久化过（v2 存过不带 `minimapEnabled` 的对象），加载时该字段会是 `undefined`。`toggleMinimap` 的 `d.minimapEnabled = !d.minimapEnabled` 在 `undefined` 上取反得 `true`——行为正确但类型不安全。
   - **修复**：`toggleMinimap` 里加 `d.minimapEnabled ??= DEFAULT_GEOMETRY.minimapEnabled` 在取反前。

### B0-3：侧边栏双轨收敛

**问题**：
- `apply.ts:97` 注册 `SidebarContent` 到 `workbench.sidebar` slot，它期望 owner props `activity`, `fsOpsSeq`, `explorerError`。
- `WorkbenchShell.tsx` 内联渲染 `FilesView`/`SearchView`/`SettingsView`，不走 slot。
- 结果：`SidebarContent` 被注册但从未被 shell 消费（shell 的内联分支绕过了 `renderSlot('workbench.sidebar')`）。`explorerError` 和 `fsOpsSeq` 不传导到内联的 FilesView。

**改动方案（方案 A——恢复 slot 渲染，推荐）**：

1. **`src/client/workbench/WorkbenchShell.tsx`**
   - 将 sidebar `<aside>` 里的内联视图替换回 `props.renderSlot('workbench.sidebar', { owner })`：
     ```tsx
     <aside className="dsh-wb-sidebar" style={{ width: geometry.sidebarWidth }} data-workbench-sidebar>
       {geometry.aiLocation === 'sidebar'
         ? aiView
         : props.renderSlot('workbench.sidebar', {
             owner: {
               activity: geometry.activity,
               fsOpsSeq,
               explorerError,
             },
           })}
     </aside>
     ```
   - 这样 `SidebarContent` 重新成为 sidebar 的唯一渲染路径，`fsOpsSeq`/`explorerError` 自然流进 FilesView。
   - 同时把 `useSessions` 传进 slot（SidebarContent 需要 `useSessions`）——检查 `PropsRenderSlots` 的 owner 类型是否支持 `useSessions`。如果不支持，用 `PropsRuntime` 的 `useSessions`（shell 自己的 props 里已有）。

2. **`src/client/workbench/parts/SidebarContent.tsx`**
   - 当前 `activity === 'settings'` 时显示 `<Placeholder label="Settings" />`——需要改为渲染 `SettingsView`：
     ```tsx
     import { SettingsView } from './SettingsView.tsx'

     // 在 body 赋值分支里：
     } else if (activity === 'settings') {
       body = <SettingsView useSessions={useSessions} />
     }
     ```
   - 删除底部 `import { FilesView }` 等重复 import（SidebarContent 自带）。

3. **`src/client/workbench/WorkbenchShell.tsx`**
   - 移除直接 import 的 `FilesView`、`SearchView`、`SettingsView`（它们不再被 shell 内联使用）。
   - 移除 `servicesRef.current!.fs` / `onOpenFile` 内联调用（这些职责回归 SidebarContent）。

4. **测试影响**：
   - 之前测试从 `data-slot="workbench.sidebar"` 改为 `data-workbench-sidebar` 的——需确认 slot 渲染后 shell 仍产出 `data-workbench-sidebar`（sidebar `<aside>` 上的 data attribute 在 shell 层，不受 slot 内容影响——保留）。
   - `SidebarContent` 的 `data-sidebar-header`、`data-explorer-error` 等属性应在 slot 恢复后重新出现。
   - 之前改用 `data-workbench-sidebar` 做断言的测试可能需要同时保留，因为 shell 仍然渲染 `<aside data-workbench-sidebar>`。

### B0-4：Explorer 错误回流

**问题**：sidebar 内联渲染时 `explorerError` 不传给 FilesView（B0-3 收敛后自动修复，因为 `fsOpsSeq` 和 `explorerError` 通过 slot owner props 传导给 SidebarContent，SidebarContent 已有 `explorerError` 渲染逻辑）。

**改动**：B0-3 完成后此问题自动解决。验证点：在 SidebarContent 里确认 `explorerError` 渲染为红色错误条（`data-explorer-error`），它位于 FilesView 上方。

### B0 测试策略

| 测试 | 文件 | 验证点 |
|---|---|---|
| 主题切换传到 Monaco | `EditorSurface.spec.tsx`（新建） | mock `loadMonaco` 返回的 `monaco.editor.setTheme` 被调用 `vs` |
| Minimap 开关传到 Monaco | `EditorSurface.spec.tsx` | `editor.updateOptions({ minimap: { enabled: true/false } })` 被调用 |
| SettingsView 主题切换调用 services.setTheme | `SettingsView.spec.tsx`（新建） | mock `WorkbenchContext.setTheme` 被调用正确值 |
| SidebarContent 渲染 SettingsView | `SidebarContent.spec.tsx`（修改） | `activity='settings'` 时 `data-settings-view` 出现 |
| fsOpsSeq 传导 | `SidebarContent.spec.tsx` | FilesView 的 key 包含 `fsOpsSeq` |
| explorerError 传导 | `SidebarContent.spec.tsx` | `explorerError` 非空时 `data-explorer-error` 出现 |

### B0 验收标准

- [ ] SettingsView 切到 Light+ 后 Monaco 编辑器同步变亮（`setTheme('vs')` 被调用）
- [ ] SettingsView 切回 Dark+ 后 Monaco 同步变暗（`setTheme('vs-dark')`）
- [ ] Minimap 开关 On 后 Monaco 出现 minimap；Off 后消失
- [ ] 侧边栏 `activity='settings'` 时渲染 `SettingsView`（非空态占位）
- [ ] explorer 操作失败后错误条出现在 sidebar（`data-explorer-error`）
- [ ] 全部现有测试通过（30 files / 263 tests）
- [ ] `pnpm run typecheck` 零错误

---

## B1：中文化 M1 + M2（框架 + 壳层 + 编辑区）

### 目标

建立 i18n 框架；菜单栏、活动栏、状态栏、QuickInput 标题、命令面板标签、冲突对话框、面包屑、欢迎页全部双语。

### B1-1：i18n 框架

**新建文件**：

```
src/client/i18n/
  ids.ts            # MessageId 类型 + id 常量
  zh-CN.ts          # 中文消息表
  en.ts             # 英文消息表
  I18nProvider.tsx   # React context + useT hook
  index.ts          # 重导出
```

**`ids.ts`**：
```ts
/**
 * Message identifiers for the workbench i18n system.
 * Each id is a dot-separated semantic key; the id itself is the stable
 * reference — the English string must NOT be used as key.
 */

export const messageIds = [
  // Menu bar
  'menu.file', 'menu.edit', 'menu.view', 'menu.help',

  // Activity bar labels
  'activity.explorer', 'activity.search', 'activity.settings', 'activity.aiAssistant',

  // Status bar
  'status.codeMode', 'status.exitCodeMode',
  'status.utf8', 'status.showPanel', 'status.hidePanel',
  'status.showAuxBar', 'status.hideAuxBar', 'status.showSidebar', 'status.hideSidebar',
  'status.exitZenMode',
  'status.chordWaiting',

  // Command palette titles
  'cmd.showAllCommands.title',
  'cmd.quickOpen.title',

  // Editor area
  'editor.welcome.title', 'editor.welcome.hint',
  'editor.save', 'editor.saving', 'editor.path',
  'editor.conflict.title', 'editor.conflict.body',
  'editor.conflict.overwrite', 'editor.conflict.discard',
  'editor.conflict.saveAs', 'editor.conflict.saveCopy', 'editor.conflict.cancel',

  // Explorer
  'explorer.title', 'explorer.newFile', 'explorer.newFolder',
  'explorer.refresh', 'explorer.rename', 'explorer.renamePlaceholder',
  'explorer.delete', 'explorer.noWorkspace',
  'explorer.newFileName', 'explorer.newFolderName',
  'explorer.invalidName',

  // Search
  'search.title', 'search.placeholder', 'search.noResults', 'search.noWorkspace',
  'search.matches', 'search.files',

  // Settings
  'settings.title', 'settings.theme.label',
  'settings.theme.dark', 'settings.theme.light',
  'settings.minimap.label', 'settings.minimap.on', 'settings.minimap.off',

  // Terminal
  'terminal.title', 'terminal.sessionExited', 'terminal.restart',
  'terminal.closePanel', 'terminal.maximizePanel', 'terminal.restorePanel',

  // Quick Input
  'quickInput.noResults',

  // Common
  'common.close', 'common.cancel',
] as const

export type MessageId = typeof messageIds[number]
```

**`en.ts`**：
```ts
import type { MessageId } from './ids.ts'

const en: Readonly<Record<MessageId, string>> = {
  'menu.file': 'File',
  'menu.edit': 'Edit',
  'menu.view': 'View',
  'menu.help': 'Help',
  'activity.explorer': 'Explorer',
  'activity.search': 'Search',
  'activity.settings': 'Settings',
  'activity.aiAssistant': 'AI Assistant',
  'status.codeMode': 'Code Mode',
  'status.exitCodeMode': 'Exit Code Mode',
  'status.utf8': 'UTF-8',
  'status.showPanel': 'Show Panel',
  'status.hidePanel': 'Hide Panel',
  'status.showAuxBar': 'Show Auxiliary Bar',
  'status.hideAuxBar': 'Hide Auxiliary Bar',
  'status.showSidebar': 'Show Sidebar',
  'status.hideSidebar': 'Hide Sidebar',
  'status.exitZenMode': 'Exit Zen Mode',
  'status.chordWaiting': 'was pressed. Waiting for second key of chord...',
  'cmd.showAllCommands.title': 'Show All Commands',
  'cmd.quickOpen.title': 'Go to File',
  'editor.welcome.title': 'Welcome to Code Mode',
  'editor.welcome.hint': 'Open a file from the Explorer on the left to start editing.',
  'editor.save': 'Save',
  'editor.saving': 'Saving\u2026',
  'editor.path': '',
  'editor.conflict.title': 'has been changed on disk',
  'editor.conflict.body': 'Saving would overwrite changes made outside this editor.',
  'editor.conflict.overwrite': 'Overwrite',
  'editor.conflict.discard': 'Discard My Changes',
  'editor.conflict.saveAs': 'Save As\u2026',
  'editor.conflict.saveCopy': 'Save Copy',
  'editor.conflict.cancel': 'Cancel',
  'explorer.title': 'Explorer',
  'explorer.newFile': 'New File...',
  'explorer.newFolder': 'New Folder...',
  'explorer.refresh': 'Refresh Explorer',
  'explorer.rename': 'Rename',
  'explorer.renamePlaceholder': 'New name',
  'explorer.delete': 'Delete',
  'explorer.noWorkspace': 'Open a workspace session to browse files',
  'explorer.newFileName': 'Name of the new file',
  'explorer.newFolderName': 'Name of the new folder',
  'explorer.invalidName': 'is not a valid entry name',
  'search.title': 'Search',
  'search.placeholder': 'Search',
  'search.noResults': 'No results found',
  'search.noWorkspace': 'Open a workspace session to search',
  'search.matches': 'matches',
  'search.files': 'files',
  'settings.title': 'Settings',
  'settings.theme.label': 'Theme',
  'settings.theme.dark': 'Dark+',
  'settings.theme.light': 'Light+',
  'settings.minimap.label': 'Minimap',
  'settings.minimap.on': 'On',
  'settings.minimap.off': 'Off',
  'terminal.title': 'TERMINAL',
  'terminal.sessionExited': 'Session exited.',
  'terminal.restart': 'Restart',
  'terminal.closePanel': 'Close Panel',
  'terminal.maximizePanel': 'Maximize Panel Size',
  'terminal.restorePanel': 'Restore Panel Size',
  'quickInput.noResults': 'No results found',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
}

export default en
```

**`zh-CN.ts`**：同结构，中文值（如 `'menu.file': '文件'`）。完整表见附录 A。

**`I18nProvider.tsx`**：
```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { MessageId } from './ids.ts'
import zhCN from './zh-CN.ts'
import en from './en.ts'

export type Locale = 'zh-CN' | 'en'

export interface I18nContextValue {
  readonly locale: Locale
  readonly t: (id: MessageId, params?: Record<string, string | number>) => string
  readonly setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

const TABLES: Readonly<Record<Locale, Readonly<Record<MessageId, string>>>> = { 'zh-CN': zhCN, en }

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = globalThis.localStorage.getItem('dsh.workbench.language')
    return stored === 'zh-CN' || stored === 'en' ? stored : 'en'
  })

  const setLocale = useCallback((next: Locale): void => {
    setLocaleState(next)
    globalThis.localStorage.setItem('dsh.workbench.language', next)
  }, [])

  const t = useCallback((id: MessageId, params?: Record<string, string | number>): string => {
    let text = TABLES[locale][id] ?? TABLES.en[id] ?? `??${id}??`
    if (params !== undefined) {
      for (const [key, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'gu'), String(value))
      }
    }
    return text
  }, [locale])

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nContextValue {
  const value = useContext(I18nContext)
  if (value === null) throw new Error('useT: render inside <I18nProvider>')
  return value
}
```

### B1-2：命令表国际化

**改动文件**：`src/client/platform/commands.ts`

- `CommandEntry.title` 从 `string` 改为 `MessageId`：
  ```ts
  import type { MessageId } from '../i18n/ids.ts'

  export interface CommandEntry {
    readonly id: string
    readonly category: string  // category 保持 string（可后续 i18n）
    readonly title: MessageId  // ← 改为 MessageId
    readonly binding?: KeybindingRule
    readonly run: (args: CommandRunArgs) => void
  }
  ```
- `COMMANDS` 表每条命令的 title 改用 id：
  ```ts
  { id: 'workbench.action.toggleSidebar', category: 'View', title: 'activity.explorer', ... }
  // 注意：category 暂不 i18n，M1 只做 title
  ```
- **渲染层**：所有消费 `command.title` 的地方改为 `t(command.title)`：
  - `WorkbenchShell.tsx` 菜单下拉：`<span>{t(command.title)}</span>`
  - `QuickInput.tsx` 命令列表
  - 键位标签（如有）

### B1-3：壳层组件双语

**改动文件及替换映射**：

| 文件 | 原文 | 替换为 |
|---|---|---|
| `WorkbenchShell.tsx` | `ACTIVITIES` 的 `label: 'Explorer'` | `t('activity.explorer')` |
| `WorkbenchShell.tsx` | `title="AI Assistant"` | `title={t('activity.aiAssistant')}` |
| `WorkbenchShell.tsx` | `Code Mode` | `{t('status.codeMode')}` |
| `WorkbenchShell.tsx` | `Exit Code Mode` | `{t('status.exitCodeMode')}` |
| `WorkbenchShell.tsx` | `UTF-8` | `{t('status.utf8')}` |
| `WorkbenchShell.tsx` | status bar 按钮的 `title`/`aria-label` | `t('status.showSidebar')` 等 |
| `WorkbenchShell.tsx` | chord waiting 文本 | `t('status.chordWaiting')` |
| `WorkbenchShell.tsx` | `Exit Zen Mode` | `{t('status.exitZenMode')}` |
| `EditorArea.tsx` | `Welcome to Code Mode` | `{t('editor.welcome.title')}` |
| `EditorArea.tsx` | `Open a file from...` | `{t('editor.welcome.hint')}` |
| `EditorArea.tsx` | `Saving…` / `Save` | `{t('editor.saving')}` / `{t('editor.save')}` |
| `EditorArea.tsx` | 冲突对话框所有文本 | 各 `t('editor.conflict.*')` |
| `SidebarContent.tsx` | `TITLES` record | `t('explorer.title')` / `t('search.title')` / `t('settings.title')` |
| `SidebarContent.tsx` | `panel coming soon` | 删除（Settings 不再是 Placeholder） |
| `SettingsView.tsx` | `Theme` / `Dark+` / `Light+` / `Minimap` / `On` / `Off` | 各 `t('settings.*')` |
| `TerminalPanel.tsx` | `TERMINAL` / `Session exited.` / `Restart` / 按钮标题 | 各 `t('terminal.*')` |
| `QuickInput.tsx` | `No results found`（如有） | `t('quickInput.noResults')` |

**ModeToggleButton.tsx**：`src/client/mode/ModeToggleButton.tsx` 的文本也需双语（如果在 code mode 下可见）。

### B1-4：I18nProvider 挂载位置

**`src/client/workbench/WorkbenchShell.tsx`**：
- `<WorkbenchContext.Provider>` 内部包裹 `<I18nProvider>`，或反过来——I18nProvider 应该在 WorkbenchContext 外层（因为 SidebarContent 等组件同时需要两者）：
  ```tsx
  return (
    <I18nProvider>
      <WorkbenchContext.Provider value={servicesRef.current}>
        {/* ... */}
      </WorkbenchContext.Provider>
    </I18nProvider>
  )
  ```

**测试中的 Provider 嵌套**：每个测试文件需要在现有 `WorkbenchContext.Provider` 外层加 `<I18nProvider>`（或 mock `useT`）。

### B1-5：Settings 新增语言切换

**改动文件**：`src/client/workbench/parts/SettingsView.tsx`
- 新增「语言」section：
  ```tsx
  {locale === 'zh-CN' ? '中文' : 'English'}
  ```
- 使用 `useT()` 获取 `setLocale`，切换时调用。

**新增 ids**：`settings.language.label`、`settings.language.zhCN`、`settings.language.en`

### B1 测试策略

| 测试 | 文件 | 验证点 |
|---|---|---|
| 消息表完整性 | `i18n/ids.spec.ts`（新建） | zh-CN 和 en 的键集合 === `messageIds`，无遗漏 |
| `t()` 缺失 id 时 fail-loud | `i18n/I18nProvider.spec.tsx`（新建） | 未知 id 返回 `??id??`（或 throw，视策略） |
| 语言切换持久化 | `I18nProvider.spec.tsx` | setLocale 后 localStorage 写入，re-render 后 locale 不变 |
| 命令面板双语 | `QuickInput.spec.tsx`（修改） | locale='zh-CN' 时命令标题显示中文 |
| 菜单双语 | `WorkbenchShell` 快照测试 | locale='zh-CN' 时菜单项中文 |
| 冲突对话框双语 | `EditorArea` 快照测试 | 四象限 (dark/light × zh/en) |

### B1 验收标准

- [ ] i18n 框架：`useT()` hook 可用，缺失 id 返回 `??id??`
- [ ] 命令面板 17 条命令在 zh-CN 下全部显示中文
- [ ] 菜单栏 File/Edit/View/Help → 文件/编辑/视图/帮助
- [ ] 状态栏：编码模式 / 退出编码模式 / UTF-8 / 显示/隐藏侧栏/面板/辅助栏
- [ ] 欢迎页：欢迎使用编码模式
- [ ] 冲突对话框：已被磁盘更改 / 保存将覆盖... / 覆盖 / 放弃我的更改 / 另存为… / 取消
- [ ] Settings 页：主题（暗色+/亮色+）、小地图、语言（中文/English）
- [ ] 切语言后所有文本即时切换，无需 reload
- [ ] 全部现有测试通过
- [ ] `pnpm run typecheck` 零错误

---

## B2：布局形态升级

### 目标

活动栏沉底（Settings/Accounts）、面板多标签容器（Terminal/Problems/Output 占位）、状态栏富化静态项、Command Center + 布局按钮组、焦点上下文规则。

### B2-1：活动栏沉底

**改动文件**：

1. **`src/client/workbench/geometry.ts`**
   - `ActivityId` 扩展：`'files' | 'search' | 'settings' | 'scm' | 'run' | 'extensions'`
   - `DEFAULT_GEOMETRY.activity` 保持 `'files'`。

2. **`src/client/workbench/WorkbenchShell.tsx`**
   - `ACTIVITIES` 数组拆为主视图 + 底部视图：
     ```ts
     const MAIN_ACTIVITIES = [
       { id: 'files', label: 'activity.explorer', Icon: IconFiles },
       { id: 'search', label: 'activity.search', Icon: IconSearch },
       { id: 'scm', label: 'activity.scm', Icon: IconScm },       // 新图标
       { id: 'run', label: 'activity.run', Icon: IconRun },         // 新图标
       { id: 'extensions', label: 'activity.extensions', Icon: IconExtensions }, // 新图标
     ]
     const BOTTOM_ACTIVITIES = [
       { id: 'settings', label: 'activity.settings', Icon: IconSettingsGear },
     ]
     ```
   - 活动栏渲染：主视图在顶部，spacer（`flex: 1`），底视图在底部：
     ```tsx
     <div className="dsh-wb-activitybar" data-workbench-activitybar>
       {MAIN_ACTIVITIES.map(...)}
       <div className="dsh-wb-activitybar-spacer" />
       {BOTTOM_ACTIVITIES.map(...)}
       {/* AI Assistant 保持现有位置（spacer 上方） */}
     </div>
     ```

3. **`src/client/theme/css.ts`**
   - 新增 `.dsh-wb-activitybar-spacer { flex: 1; }`

4. **`src/client/theme/codicons.tsx`**
   - 新增 Source Control / Run / Extensions 图标（codicon unicode 或 SVG）。

5. **`src/client/workbench/parts/SidebarContent.tsx`**
   - SCM/Run/Extensions 显示空态卡片：
     ```tsx
     function EmptyActivityCard({ label, hint }: { label: string; hint: string }) {
       return (
         <div className="dsh-wb-placeholder" data-empty-activity>
           <div>{label}</div>
           <div className="dsh-wb-placeholder-hint">{hint}</div>
         </div>
       )
     }
     // SCM: "需要 Git 仓库才能使用源代码管理"
     // Run: "测试提供方尚未接入"
     // Extensions: "扩展系统范围外"
     ```

### B2-2：面板多标签容器

**新建文件**：`src/client/workbench/panels/PanelContainer.tsx`

```tsx
/**
 * Panel container: a multi-tab host for the bottom/side panel.
 * Manages a set of registered panel items; each is a React component
 * rendered when its tab is active.
 */
export type PanelItemId = 'terminal' | 'problems' | 'output'

export interface PanelItem {
  readonly id: PanelItemId
  readonly label: string  // MessageId (after B1)
  readonly Icon: FC<{ size?: number }>
  readonly content: FC
}

// PanelContainer:
// - 状态：activePanelId（默认 'terminal'）
// - 标签行：与 tab strip 同风格但用 panelTitle CSS
// - 内容区：渲染 activePanelId 对应的 content 组件
// - Terminal 标签内部管理多终端会话（下一阶段）
```

**改动文件**：

1. **`src/client/workbench/WorkbenchShell.tsx`**
   - `panelContent` 从直接渲染 `TerminalPanel` 改为渲染 `PanelContainer`：
     ```tsx
     import { PanelContainer } from './panels/PanelContainer.tsx'

     // 替代 props.renderSlot('workbench.panel', {})
     <PanelContainer useSessions={props.useSessions} />
     ```
   - `apply.ts:100` 的 `ctx.slots.register({ name: 'workbench.panel' }, TerminalPanel)` 改为注册 `PanelContainer`。

2. **`src/client/workbench/panels/PanelContainer.tsx`**
   - 注册内置面板项：Terminal（现有 TerminalPanel）、Problems（空态占位）、Output（空态占位）。
   - 渲染标签行 + 活跃内容。

3. **`src/client/theme/css.ts`**
   - 面板标签样式（类似 `dsh-wb-tabs` 但用 `panelTitle` 色板）：
     ```css
     .dsh-wb-paneltabs { ... }
     .dsh-wb-paneltab { ... }
     .dsh-wb-paneltab-active { ... }
     ```

### B2-3：状态栏富化静态项

**改动文件**：`src/client/workbench/WorkbenchShell.tsx`

- 右侧状态栏新增静态项（暂无动态数据源）：
  ```tsx
  {/* 在 language 后，UTF-8 前 */}
  <button className="dsh-wb-statusitem" data-status-indent onClick={...}>
    Spaces: 2
  </button>
  ```
- 交互：点击弹出 QuickInput prompt 选择缩进（2/4/8 tab），选后写入 settings store 并广播到编辑器。

**新增 ids**：`status.indent.label`、`status.indent.spaces`、`status.indent.tabs`

### B2-4：Command Center + 布局按钮组

**改动文件**：

1. **`src/client/workbench/WorkbenchShell.tsx`**
   - 标题栏中间加 Command Center 输入框：
     ```tsx
     <div className="dsh-wb-commandcenter" data-command-center>
       <input
         className="dsh-wb-commandcenter-input"
         placeholder={t('cmd.quickOpen.title')}
         onFocus={() => { setQuickInput({ kind: 'files' }) }}
         data-command-center-input
       />
     </div>
     ```
   - 状态栏右侧的三个 toggle 按钮移到标题栏右侧（布局按钮组）。
   - 标题栏结构：`[菜单] [Command Center 居中] [布局按钮组 ⋮]`

2. **`src/client/theme/css.ts`**
   - `.dsh-wb-commandcenter`：`flex: 1; display: flex; justify-content: center;`
   - `.dsh-wb-commandcenter-input`：视觉与 QuickInput 输入框类似但嵌入标题栏。

### B2-5：焦点上下文规则

**改动文件**：`src/client/workbench/WorkbenchShell.tsx`（keybindings useEffect）

- 在 `onKeyDown` 开头判断当前焦点区域：
  ```ts
  const activeEl = document.activeElement
  const focusZone: FocusZone =
    activeEl?.closest('[data-workbench-editor-area]') !== null ? 'editor'
    : activeEl?.closest('[data-terminal-panel]') !== null ? 'terminal'
    : activeEl?.closest('[data-quick-input]') !== null ? 'quickinput'
    : 'chrome'
  ```
- `editor` zone：仅拦截 `Ctrl+P`、`Ctrl+Shift+P`、`Ctrl+B`、`Ctrl+J`（面板）、`Ctrl+\`（拆分）等 shell 专属键；其余放行给 Monaco。
- `terminal` zone：拦截 `Ctrl+`` ` ``（面板切换）、`Ctrl+Shift+`` ` ``（新建终端）；其余放行给 xterm。

### B2 测试策略

| 测试 | 验证点 |
|---|---|
| 活动栏沉底 | Settings 图标在底部分隔线下方 |
| 面板多标签 | 点击 Terminal/Problems/Output 切换内容区 |
| Command Center | 聚焦输入框时打开 QuickInput files 模式 |
| 布局按钮组 | 标题栏右侧三个 toggle 可用 |
| 焦点上下文 | Monaco 聚焦时 Ctrl+P 开 QuickInput（不触发 Monaco 内建） |
| 焦点上下文 | Monaco 聚焦时 Ctrl+F 不被 shell 拦截 |

### B2 验收标准

- [ ] 活动栏：Settings 在底部分隔线下
- [ ] SCM/Run/Extensions 显示空态占位卡
- [ ] 面板有三个标签（Terminal/Problems/Output），Terminal 有内容，其余占位
- [ ] Command Center 居中，聚焦即开文件快速打开
- [ ] 布局 toggle 按钮组在标题栏右侧
- [ ] Monaco 聚焦时 Ctrl+P 稳定开 QuickInput
- [ ] 全部测试通过

---

## B3：搜索升级

### 目标

正则 / 大小写敏感 / 全字匹配三开关；单文件替换；include/exclude glob UI；glob 正确实现。

### B3-1：搜索网关升级

**改动文件**：`src/host/search-gateway.ts`

- `SearchRequest` 新增字段：
  ```ts
  readonly caseSensitive?: boolean
  readonly wholeMatch?: boolean
  readonly useRegex?: boolean
  ```
- 匹配逻辑：`String.includes` → `RegExp` 构造 + `test`：
  ```ts
  function matchLine(pattern: string, text: string, opts: SearchOptions): boolean {
    let regex: RegExp
    try {
      const flags = opts.caseSensitive ? 'u' : 'ui'
      const source = opts.useRegex ? pattern : escapeRegex(pattern)
      const full = opts.wholeMatch ? `\\b${source}\\b` : source
      regex = new RegExp(full, flags)
    } catch {
      return false  // 非法正则不匹配
    }
    return regex.test(text)
  }
  ```
- **非法正则**：返回 400 + `SEARCH_INVALID_PATTERN` 错误码（非 500）。

### B3-2：替换

**改动文件**：
- `src/host/search-gateway.ts`：新增 `replace-gateway.ts`（或复用 fs-gateway 的 writeText）——替换走 `readText` → 内容替换 → `writeText`（带 version guard）。
- 替换策略：单文件替换一次写回整个文件（行级替换 + version 冲突检测）。

### B3-3：搜索 UI 升级

**改动文件**：`src/client/workbench/parts/SearchView.tsx`

- 搜索表单下新增三个 toggle 按钮（大小写 Aa / 全字 Ab / 正则 .*），类似 VS Code 搜索框右侧图标按钮。
- 替换输入框（第二行）+ Replace / Replace All 按钮。
- include/exclude 输入框（折叠的「更多选项」区域）。

### B3 测试策略

- 正则匹配测试：`ts\s*function` 匹配 `function` 和 `function`。
- 大小写敏感：`String` 不匹配 `string`。
- 非法正则：返回 `SEARCH_INVALID_PATTERN`（400）。
- 替换：替换后文件内容正确（host 端 writeTest mock 验证）。

---

## 附录 A：zh-CN 消息表

```ts
const zhCN: Readonly<Record<MessageId, string>> = {
  'menu.file': '文件',
  'menu.edit': '编辑',
  'menu.view': '视图',
  'menu.help': '帮助',
  'activity.explorer': '资源管理器',
  'activity.search': '搜索',
  'activity.settings': '设置',
  'activity.aiAssistant': 'AI 助手',
  'activity.scm': '源代码管理',
  'activity.run': '运行和调试',
  'activity.extensions': '扩展',
  'status.codeMode': '编码模式',
  'status.exitCodeMode': '退出编码模式',
  'status.utf8': 'UTF-8',
  'status.showPanel': '显示面板',
  'status.hidePanel': '隐藏面板',
  'status.showAuxBar': '显示辅助侧边栏',
  'status.hideAuxBar': '隐藏辅助侧边栏',
  'status.showSidebar': '显示侧边栏',
  'status.hideSidebar': '隐藏侧边栏',
  'status.exitZenMode': '退出禅模式',
  'status.chordWaiting': '已按下，等待组合键的第二个按键...',
  'cmd.showAllCommands.title': '显示所有命令',
  'cmd.quickOpen.title': '转到文件',
  'editor.welcome.title': '欢迎使用编码模式',
  'editor.welcome.hint': '从左侧资源管理器打开文件开始编辑。',
  'editor.save': '保存',
  'editor.saving': '保存中…',
  'editor.path': '',
  'editor.conflict.title': '已在磁盘上更改',
  'editor.conflict.body': '保存将覆盖在此编辑器之外所做的更改。',
  'editor.conflict.overwrite': '覆盖',
  'editor.conflict.discard': '放弃我的更改',
  'editor.conflict.saveAs': '另存为…',
  'editor.conflict.saveCopy': '保存副本',
  'editor.conflict.cancel': '取消',
  'explorer.title': '资源管理器',
  'explorer.newFile': '新建文件...',
  'explorer.newFolder': '新建文件夹...',
  'explorer.refresh': '刷新资源管理器',
  'explorer.rename': '重命名',
  'explorer.renamePlaceholder': '新名称',
  'explorer.delete': '删除',
  'explorer.noWorkspace': '打开工作区会话以浏览文件',
  'explorer.newFileName': '新文件名称',
  'explorer.newFolderName': '新文件夹名称',
  'explorer.invalidName': '不是有效的条目名称',
  'search.title': '搜索',
  'search.placeholder': '搜索',
  'search.noResults': '未找到结果',
  'search.noWorkspace': '打开工作区会话以搜索',
  'search.matches': '个匹配',
  'search.files': '个文件',
  'settings.title': '设置',
  'settings.theme.label': '主题',
  'settings.theme.dark': '暗色+',
  'settings.theme.light': '亮色+',
  'settings.minimap.label': '小地图',
  'settings.minimap.on': '开启',
  'settings.minimap.off': '关闭',
  'settings.language.label': '语言',
  'settings.language.zhCN': '中文',
  'settings.language.en': 'English',
  'terminal.title': '终端',
  'terminal.sessionExited': '会话已退出。',
  'terminal.restart': '重新启动',
  'terminal.closePanel': '关闭面板',
  'terminal.maximizePanel': '最大化面板大小',
  'terminal.restorePanel': '还原面板大小',
  'quickInput.noResults': '未找到结果',
  'common.close': '关闭',
  'common.cancel': '取消',
}
```

---

## 附录 B：执行顺序约束

```
B0（接线修复）──→ 无依赖，最先执行
  │
  ├── B0-1 Monaco 主题（无前置）
  ├── B0-2 Minimap 接线（无前置）
  ├── B0-3 侧边栏双轨收敛（无前置，但 B0-1/B0-2 的 EditorSurface 改动不应与 B0-3 冲突）
  └── B0-4（B0-3 自动解决）
  │
B1（中文化 M1+M2）──→ 依赖 B0（Settings 加语言节、命令表 title 改 MessageId 需要 B0 代码稳定）
  │
B2（布局形态）──→ 依赖 B1（新空态视图文本直接走 i18n）
  │
B3（搜索升级）──→ 无强依赖（可与 B1/B2 并行，但推荐串行避免合并冲突）
```

**建议执行顺序**：B0 → B1 → B2 → B3，每个批次独立 commit，每个批次完成后 `pnpm run test && pnpm run typecheck`。
