/**
 * Message identifiers for the workbench i18n system.
 *
 * Each id is a dot-separated semantic key; the id itself is the stable
 * reference — the English string must NOT be used as key.
 */

export const messageIds = [
  // Menu bar
  'menu.file', 'menu.edit', 'menu.view', 'menu.help', 'menu.terminal',

  // Activity bar labels
  'activity.explorer', 'activity.search', 'activity.settings', 'activity.aiAssistant',
  'activity.scm', 'activity.run', 'activity.extensions',

  // Status bar
  'status.codeMode', 'status.exitCodeMode',
  'status.utf8', 'status.showPanel', 'status.hidePanel',
  'status.showAuxBar', 'status.hideAuxBar', 'status.showSidebar', 'status.hideSidebar',
  'status.exitZenMode',
  'status.chordWaiting',
  'status.indent.label', 'status.indent.spaces', 'status.indent.tabs',

  // Command palette titles
  'cmd.showAllCommands.title',
  'cmd.quickOpen.title',
  'cmd.openFolder.title',

  // View commands
  'view.toggleSidebar', 'view.toggleAuxBar', 'view.togglePanel',
  'view.movePanelLeft', 'view.movePanelRight', 'view.movePanelBottom',
  'view.toggleMaximizePanel', 'view.toggleZenMode',
  'view.splitEditor', 'view.splitEditorOrthogonal', 'view.closeEditor',
  'view.joinEditorGroups',

  // Editor area
  'editor.welcome.title', 'editor.welcome.hint',
  'editor.save', 'editor.saving', 'editor.path',
  'editor.conflict.title', 'editor.conflict.body',
  'editor.conflict.overwrite', 'editor.conflict.discard',
  'editor.conflict.saveAs', 'editor.conflict.saveCopy', 'editor.conflict.cancel',

  // Explorer
  'explorer.title', 'explorer.newFile', 'explorer.newFolder', 'explorer.openFolder',
  'explorer.refresh', 'explorer.rename', 'explorer.renamePlaceholder',
  'explorer.delete', 'explorer.noWorkspace',
  'explorer.newFileName', 'explorer.newFolderName', 'explorer.openFolderPlaceholder',
  'explorer.invalidName',

  // Search
  'search.title', 'search.placeholder', 'search.noResults', 'search.noWorkspace',
  'search.matches', 'search.files',
  'search.replacePlaceholder', 'search.replace', 'search.replaceAll',
  'search.moreOptions', 'search.include', 'search.exclude',

  // Settings
  'settings.title', 'settings.theme.label',
  'settings.theme.dark', 'settings.theme.light',
  'settings.minimap.label', 'settings.minimap.on', 'settings.minimap.off',
  'settings.language.label', 'settings.language.zhCN', 'settings.language.en',

  // Terminal
  'terminal.title', 'terminal.sessionExited', 'terminal.restart',
  'terminal.closePanel', 'terminal.maximizePanel', 'terminal.restorePanel',
  'terminal.toggle',

  // Panel
  'panel.terminal', 'panel.problems', 'panel.output',
  'panel.problemsHint', 'panel.outputHint',

  // Quick Input
  'quickInput.noResults',

  // Common
  'common.close', 'common.cancel', 'common.viewsAndMoreActions',
] as const

export type MessageId = typeof messageIds[number]
