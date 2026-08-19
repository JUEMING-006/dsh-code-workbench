/**
 * The workbench design tokens: the single home of color and dimension
 * literals. Pinned source: VS Code 1.96.0 — workbench colors from
 * extensions/theme-defaults/themes/dark_modern.json (the default dark theme),
 * list colors from src/vs/platform/theme/common/colors/listColors.ts dark
 * base defaults. Entries VS Code does not define as a theme color are marked
 * "derived" and kept visually equivalent. Upgrading the baseline means
 * regenerating this table, not editing components.
 */

/**
 * Semantic color tokens (VS Code theme-color ids in kebab case → value).
 * Keys mirror upstream names so a future theme file can be diffed key-by-key.
 */
export const COLORS = {
  'foreground': '#CCCCCC',
  'icon.foreground': '#CCCCCC',
  'descriptionForeground': '#9D9D9D',
  'focusBorder': '#0078D4',
  'errorForeground': '#F85149',

  'titleBar.activeBackground': '#181818',
  'titleBar.activeForeground': '#CCCCCC',
  'titleBar.border': '#2B2B2B',

  'activityBar.background': '#181818',
  'activityBar.foreground': '#D7D7D7',
  'activityBar.inactiveForeground': '#868686',
  'activityBar.activeBorder': '#0078D4',
  'activityBar.border': '#2B2B2B',

  'sideBar.background': '#181818',
  'sideBar.foreground': '#CCCCCC',
  'sideBar.border': '#2B2B2B',
  'sideBarTitle.foreground': '#CCCCCC',

  'editor.background': '#1F1F1F',
  'editor.foreground': '#CCCCCC',
  'editorLineNumber.foreground': '#6E7681',
  'editorLineNumber.activeForeground': '#CCCCCC',

  'editorGroupHeader.tabsBackground': '#181818',
  'tab.activeBackground': '#1F1F1F',
  'tab.activeForeground': '#FFFFFF',
  'tab.activeBorderTop': '#0078D4',
  'tab.inactiveBackground': '#181818',
  'tab.inactiveForeground': '#9D9D9D',
  'tab.border': '#2B2B2B',

  'panel.background': '#181818',
  'panel.border': '#2B2B2B',
  'panelTitle.activeForeground': '#CCCCCC',
  'panelTitle.inactiveForeground': '#9D9D9D',
  'panelTitle.activeBorder': '#0078D4',

  'statusBar.background': '#181818',
  'statusBar.foreground': '#CCCCCC',
  'statusBar.border': '#2B2B2B',
  'statusBarItem.remoteBackground': '#0078D4',
  'statusBarItem.remoteForeground': '#FFFFFF',

  'menu.background': '#1F1F1F',
  'menu.foreground': '#CCCCCC',
  'menu.selectionBackground': '#0078D4',
  'menu.selectionForeground': '#FFFFFF',
  'menu.border': '#313131',

  'list.hoverBackground': '#2A2D2E',
  'list.activeSelectionBackground': '#04395E',
  'list.activeSelectionForeground': '#FFFFFF',
  'list.inactiveSelectionBackground': '#37373D',

  'button.background': '#0078D4',
  'button.foreground': '#FFFFFF',
  'button.hoverBackground': '#026EC1',
  'button.secondaryBackground': '#313131',
  'button.secondaryForeground': '#CCCCCC',
  'button.secondaryHoverBackground': '#3C3C3C',

  'input.background': '#313131',
  'input.foreground': '#CCCCCC',
  'input.border': '#3C3C3C',
  'input.placeholderForeground': '#989898',

  'dropdown.background': '#313131',
  'dropdown.foreground': '#CCCCCC',
  'dropdown.border': '#3C3C3C',

  'widget.border': '#313131',
  'quickInput.background': '#222222',
  'editorWidget.background': '#202020',
  'editorWidget.foreground': '#D4D4D4',

  'textLink.foreground': '#4DAAFC',
  'gitDecoration.addedResourceForeground': '#81B88B',
  'gitDecoration.modifiedResourceForeground': '#E2C08D',
  'gitDecoration.untrackedResourceForeground': '#73C991',
  'gitDecoration.renamedResourceForeground': '#4EC9B0',
  'gitDecoration.deletedResourceForeground': '#C74E39',
  'textCodeBlock.background': '#2B2B2B',
  'textPreformat.background': '#3C3C3C',
  'textPreformat.foreground': '#D0D0D0',

  // Derived (no upstream theme color): chrome hover overlays on dark parts.
  'chromeHoverBackground': 'rgba(255, 255, 255, 0.06)',
  'statusBarItem.hoverBackground': 'rgba(255, 255, 255, 0.12)',
  // Derived: sash hover/active accent (VS Code highlights the active sash in
  // the focus color).
  'sash.hoverBorder': '#0078D4',
  // Breadcrumb strip (VS Code breadcrumb.* tokens, dark-modern values).
  'breadcrumb.background': '#181818',
  'breadcrumb.foreground': '#8C8C8C',
  'breadcrumb.focusForeground': '#E0E0E0',
  // Derived: menu/quick-input drop shadow, VS Code widget shadow equivalent.
  'widget.shadow': '0 4px 10px rgba(0, 0, 0, 0.5)',
  // Derived: the warning strip of the approval card (VS Code renders chat
  // approval headers in the warning yellow family).
  'approvalWaiting.foreground': '#CCA700',
  'approvalWaiting.background': '#8a6d00cc',

  // File explorer icon colors (VS Code file-icon theme standard colors).
  'fileIcon.folder': '#dcb67a',
  'fileIcon.python': '#3572A5',
  'fileIcon.java': '#ea2d2e',
  'fileIcon.typescript': '#3178c6',
  'fileIcon.javascript': '#f7df1e',
  'fileIcon.html': '#e34f26',
  'fileIcon.css': '#563d7c',
  'fileIcon.json': '#cbcb41',
  'fileIcon.yaml': '#cb171e',
  'fileIcon.markdown': '#519aba',
  'fileIcon.shell': '#89e051',
  'fileIcon.cpp': '#68217a',
  'fileIcon.rust': '#dea584',
  'fileIcon.go': '#00add8',
  'fileIcon.image': '#a074c4',
  'fileIcon.config': '#f34f29',
  'fileIcon.default': '#9da5b4',
  'dialog.backdrop': 'rgba(0, 0, 0, 0.55)',
  'dialog.shadow': '0 16px 36px rgba(0, 0, 0, 0.5)',
  'kbd.shadow': '0 1px 2px rgba(0, 0, 0, 0.2)',
  'scrollbarSlider.background': 'rgba(121, 121, 121, 0.2)',
  'scrollbarSlider.hoverBackground': 'rgba(100, 100, 100, 0.4)',
  'scrollbarSlider.activeBackground': 'rgba(191, 191, 191, 0.4)',
  'tree.indentGuidesStroke': '#585858',
  'ai.bubble.userBackground': '#2b2d30',
  'ai.bubble.userBorder': '#383b40',
  'ai.think.background': 'rgba(255, 255, 255, 0.03)',
  'ai.think.border': 'rgba(255, 255, 255, 0.08)',
  'ai.think.text': '#9da5b4',
  'ai.think.timerText': '#0078d4',
  'ai.tool.headerBackground': '#21252b',
  'ai.tool.border': '#31363f',
  'ai.tool.outputBackground': '#181a1f',
  'ai.context.chipBackground': 'rgba(0, 120, 212, 0.15)',
  'ai.context.chipBorder': 'rgba(0, 120, 212, 0.3)',
  'ai.context.chipForeground': '#58a6ff',
  'ai.code.headerBackground': '#21252b',
} as const satisfies Readonly<Record<string, string>>

/** Light+ theme overrides (VS Code Light Modern equivalents). */
export const LIGHT_COLORS = {
  'foreground': '#1F1F1F',
  'icon.foreground': '#1F1F1F',
  'descriptionForeground': '#616161',
  'focusBorder': '#0078D4',
  'errorForeground': '#A31515',

  'titleBar.activeBackground': '#F3F3F3',
  'titleBar.activeForeground': '#1F1F1F',
  'titleBar.border': '#E5E5E5',

  'activityBar.background': '#F3F3F3',
  'activityBar.foreground': '#1F1F1F',
  'activityBar.inactiveForeground': '#616161',
  'activityBar.activeBorder': '#0078D4',
  'activityBar.border': '#E5E5E5',

  'sideBar.background': '#F3F3F3',
  'sideBar.foreground': '#1F1F1F',
  'sideBar.border': '#E5E5E5',
  'sideBarTitle.foreground': '#1F1F1F',

  'editor.background': '#FFFFFF',
  'editor.foreground': '#1F1F1F',
  'editorLineNumber.foreground': '#616161',
  'editorLineNumber.activeForeground': '#1F1F1F',

  'editorGroupHeader.tabsBackground': '#F3F3F3',
  'tab.activeBackground': '#FFFFFF',
  'tab.activeForeground': '#1F1F1F',
  'tab.activeBorderTop': '#0078D4',
  'tab.inactiveBackground': '#F3F3F3',
  'tab.inactiveForeground': '#616161',
  'tab.border': '#E5E5E5',

  'panel.background': '#F3F3F3',
  'panel.border': '#E5E5E5',
  'panelTitle.activeForeground': '#1F1F1F',
  'panelTitle.inactiveForeground': '#616161',
  'panelTitle.activeBorder': '#0078D4',

  'statusBar.background': '#F3F3F3',
  'statusBar.foreground': '#1F1F1F',
  'statusBar.border': '#E5E5E5',
  'statusBarItem.remoteBackground': '#0078D4',
  'statusBarItem.remoteForeground': '#FFFFFF',

  'menu.background': '#FFFFFF',
  'menu.foreground': '#1F1F1F',
  'menu.selectionBackground': '#0078D4',
  'menu.selectionForeground': '#FFFFFF',
  'menu.border': '#E5E5E5',

  'list.hoverBackground': '#E8E8E8',
  'list.activeSelectionBackground': '#0078D4',
  'list.activeSelectionForeground': '#FFFFFF',
  'list.inactiveSelectionBackground': '#E8E8E8',

  'button.background': '#0078D4',
  'button.foreground': '#FFFFFF',
  'button.hoverBackground': '#026EC1',
  'button.secondaryBackground': '#E5E5E5',
  'button.secondaryForeground': '#1F1F1F',
  'button.secondaryHoverBackground': '#F3F3F3',

  'input.background': '#FFFFFF',
  'input.foreground': '#1F1F1F',
  'input.border': '#D0D0D0',
  'input.placeholderForeground': '#616161',

  'dropdown.background': '#FFFFFF',
  'dropdown.foreground': '#1F1F1F',
  'dropdown.border': '#D0D0D0',

  'widget.border': '#D0D0D0',
  'quickInput.background': '#FFFFFF',
  'editorWidget.background': '#FFFFFF',
  'editorWidget.foreground': '#1F1F1F',

  'textLink.foreground': '#006AB1',
  'gitDecoration.addedResourceForeground': '#008000',
  'gitDecoration.modifiedResourceForeground': '#895503',
  'gitDecoration.untrackedResourceForeground': '#107C10',
  'gitDecoration.renamedResourceForeground': '#005FB8',
  'gitDecoration.deletedResourceForeground': '#A31515',
  'textCodeBlock.background': '#F3F3F3',
  'textPreformat.background': '#F3F3F3',
  'textPreformat.foreground': '#1F1F1F',

  'chromeHoverBackground': 'rgba(0, 0, 0, 0.06)',
  'statusBarItem.hoverBackground': 'rgba(0, 0, 0, 0.08)',
  'sash.hoverBorder': '#0078D4',
  'breadcrumb.background': '#F3F3F3',
  'breadcrumb.foreground': '#616161',
  'breadcrumb.focusForeground': '#1F1F1F',
  'widget.shadow': '0 4px 10px rgba(0, 0, 0, 0.12)',
  'approvalWaiting.foreground': '#9D6700',
  'approvalWaiting.background': '#fff3cd',

  // File explorer icon colors (Light Modern equivalents).
  'fileIcon.folder': '#c49a45',
  'fileIcon.python': '#3572A5',
  'fileIcon.java': '#b07219',
  'fileIcon.typescript': '#3178c6',
  'fileIcon.javascript': '#d4b830',
  'fileIcon.html': '#e34f26',
  'fileIcon.css': '#563d7c',
  'fileIcon.json': '#8f8f20',
  'fileIcon.yaml': '#cb171e',
  'fileIcon.markdown': '#007acc',
  'fileIcon.shell': '#22863a',
  'fileIcon.cpp': '#68217a',
  'fileIcon.rust': '#b55a30',
  'fileIcon.go': '#00add8',
  'fileIcon.image': '#805ad5',
  'fileIcon.config': '#d73a49',
  'fileIcon.default': '#586069',
  'dialog.backdrop': 'rgba(0, 0, 0, 0.4)',
  'dialog.shadow': '0 16px 36px rgba(0, 0, 0, 0.2)',
  'kbd.shadow': '0 1px 2px rgba(0, 0, 0, 0.1)',
  'scrollbarSlider.background': 'rgba(100, 100, 100, 0.2)',
  'scrollbarSlider.hoverBackground': 'rgba(100, 100, 100, 0.35)',
  'scrollbarSlider.activeBackground': 'rgba(0, 0, 0, 0.5)',
  'tree.indentGuidesStroke': '#d3d3d3',
  'ai.bubble.userBackground': '#e8eaed',
  'ai.bubble.userBorder': '#dadce0',
  'ai.think.background': 'rgba(0, 0, 0, 0.03)',
  'ai.think.border': 'rgba(0, 0, 0, 0.08)',
  'ai.think.text': '#5f6368',
  'ai.think.timerText': '#005fb8',
  'ai.tool.headerBackground': '#f1f3f4',
  'ai.tool.border': '#e0e0e0',
  'ai.tool.outputBackground': '#f8f9fa',
  'ai.context.chipBackground': 'rgba(0, 120, 212, 0.1)',
  'ai.context.chipBorder': 'rgba(0, 120, 212, 0.25)',
  'ai.context.chipForeground': '#005fb8',
  'ai.code.headerBackground': '#f1f3f4',
} as const satisfies Readonly<Record<string, string>>

/**
 * Dimension tokens, pinned to the same VS Code baseline.
 * Sources: StatusbarPart.HEIGHT, ActivitybarPart.ACTION_HEIGHT,
 * DEFAULT_CUSTOM_TITLEBAR_HEIGHT, EditorTabsControl.EDITOR_TAB_HEIGHT.normal,
 * sidebarPart optimal-width floor; the tree row height is the workbench List
 * default; the rest are derived spacing equivalents.
 */
export const SIZES = {
  /** Custom title bar with command center (window.ts). */
  titleBarHeight: 35,
  /** StatusbarPart.HEIGHT. */
  statusBarHeight: 22,
  /** Activity rail square action size; the bar's width equals it. */
  activityBarSize: 48,
  /** EditorTabsControl.EDITOR_TAB_HEIGHT.normal (compact is 22). */
  tabHeight: 35,
  /** View title strip (viewlet header) height, derived. */
  viewHeaderHeight: 34,
  /** Breadcrumb strip height (BreadcrumbsControl default). */
  breadcrumbHeight: 22,
  /** Workbench List default row height, derived from the tree row sizing. */
  treeRowHeight: 22,
  /** sidebarPart.getOptimalWidth floor. */
  sidebarDefaultWidth: 300,
  /** Workbench UI font size. */
  fontSize: 13,
  /** Chrome icon size (activity rail renders 24). */
  iconSize: 16,
  /** Activity rail icon size. */
  activityIconSize: 24,
} as const

/** The VS Code UI font stack (workbench base styles). */
export const FONT_UI = '"-apple-system", "BlinkMacSystemFont", "Segoe WPC", "Segoe UI", system-ui, "Ubuntu", "Droid Sans", sans-serif'

/** The VS Code monospace stack (editor/terminal). */
export const FONT_MONO = 'Consolas, "Courier New", monospace'

/** Terminal xterm colors for dark theme. */
export const TERMINAL_DARK_THEME = {
  background: '#181818',
  foreground: '#CCCCCC',
  cursor: '#FFFFFF',
  selectionBackground: '#264F78',
} as const

/** Terminal xterm colors for light theme. */
export const TERMINAL_LIGHT_THEME = {
  background: '#FFFFFF',
  foreground: '#1F1F1F',
  cursor: '#1F1F1F',
  selectionBackground: '#ADD6FF',
} as const
