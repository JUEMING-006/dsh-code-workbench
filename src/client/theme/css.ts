/**
 * The workbench stylesheet: one CSS string, classes prefixed `dsh-wb-`,
 * colors/dimensions exclusively through the token variables set on the frame
 * root. Components carry no color or dimension literals. Injected once per
 * page by theme/inject.ts.
 */

import { COLORS, FONT_MONO, FONT_UI, LIGHT_COLORS, SIZES } from './tokens.ts'

/** CSS custom property name for one token key. */
function varName(key: string): string {
  return `--dsh-wb-${key.replace(/\./gu, '-')}`
}

/** The frame-scoped variables block plus every workbench class. */
export const WORKBENCH_CSS = `
.dsh-wb {
  ${Object.entries(COLORS).map(([key, value]) => `${varName(key)}: ${value};`).join('\n  ')}
  --dsh-wb-font-ui: ${FONT_UI};
  --dsh-wb-font-mono: ${FONT_MONO};
  --dsh-wb-size-title-bar: ${SIZES.titleBarHeight}px;
  --dsh-wb-size-status-bar: ${SIZES.statusBarHeight}px;
  --dsh-wb-size-activity-bar: ${SIZES.activityBarSize}px;
  --dsh-wb-size-tab: ${SIZES.tabHeight}px;
  --dsh-wb-size-view-header: ${SIZES.viewHeaderHeight}px;
  --dsh-wb-size-breadcrumb: ${SIZES.breadcrumbHeight}px;
  --dsh-wb-size-tree-row: ${SIZES.treeRowHeight}px;
  --dsh-wb-size-font: ${SIZES.fontSize}px;
  --dsh-wb-size-icon: ${SIZES.iconSize}px;
  --dsh-wb-size-activity-icon: ${SIZES.activityIconSize}px;
}

[data-workbench-theme="light"] .dsh-wb {
  ${Object.entries(LIGHT_COLORS).map(([key, value]) => `${varName(key)}: ${value};`).join('\n  ')}
}

[data-workbench-theme="light"] .dsh-wb .dsh-wb-titlebar,
[data-workbench-theme="light"] .dsh-wb .dsh-wb-activitybar,
[data-workbench-theme="light"] .dsh-wb .dsh-wb-sidebar,
[data-workbench-theme="light"] .dsh-wb .dsh-wb-aux,
[data-workbench-theme="light"] .dsh-wb .dsh-wb-panel,
[data-workbench-theme="light"] .dsh-wb .dsh-wb-statusbar {
  color-scheme: light;
}

.dsh-wb {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  position: relative;
  color-scheme: dark;
  color: var(--dsh-wb-foreground);
  background: var(--dsh-wb-editor-background);
  font-family: var(--dsh-wb-font-ui);
  font-size: var(--dsh-wb-size-font);
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Custom VS Code scrollbar styling */
.dsh-wb *::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.dsh-wb *::-webkit-scrollbar-track {
  background: transparent;
}
.dsh-wb *::-webkit-scrollbar-thumb {
  background: var(--dsh-wb-scrollbarSlider-background);
  border-radius: 5px;
}
.dsh-wb *::-webkit-scrollbar-thumb:hover {
  background: var(--dsh-wb-scrollbarSlider-hoverBackground);
}
.dsh-wb *::-webkit-scrollbar-thumb:active {
  background: var(--dsh-wb-scrollbarSlider-activeBackground);
}
.dsh-wb *::-webkit-scrollbar-corner {
  background: transparent;
}

.dsh-wb :focus-visible {
  outline: 1px solid var(--dsh-wb-focusBorder);
  outline-offset: -1px;
}

/* ---------- Title bar and menu bar ---------- */

.dsh-wb-titlebar {
  display: flex;
  align-items: center;
  height: var(--dsh-wb-size-title-bar);
  flex-shrink: 0;
  padding: 0 8px;
  box-sizing: border-box;
  background: var(--dsh-wb-titleBar-activeBackground);
  color: var(--dsh-wb-titleBar-activeForeground);
  border-bottom: 1px solid var(--dsh-wb-titleBar-border);
  font-size: var(--dsh-wb-size-font);
  user-select: none;
}

.dsh-wb-menubar-item {
  position: relative;
  display: flex;
  align-items: center;
}

.dsh-wb-menubar-button {
  padding: 0 8px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.dsh-wb-menubar-button:hover,
.dsh-wb-menubar-button[aria-expanded="true"] {
  background: var(--dsh-wb-chromeHoverBackground);
}

.dsh-wb-commandcenter {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  min-width: 0;
}

.dsh-wb-commandcenter-input {
  width: 100%;
  max-width: 440px;
  height: 24px;
  padding: 0 16px;
  border: 1px solid var(--dsh-wb-titleBar-border);
  border-radius: 6px;
  background: var(--dsh-wb-chromeHoverBackground);
  color: var(--dsh-wb-titleBar-activeForeground);
  font: inherit;
  font-size: 12px;
  text-align: center;
  outline: none;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.dsh-wb-commandcenter-input:hover,
.dsh-wb-commandcenter-input:focus {
  background: var(--dsh-wb-statusBarItem-hoverBackground);
  border-color: var(--dsh-wb-focusBorder);
}

.dsh-wb-commandcenter-input::placeholder {
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-titlebar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.dsh-wb-menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 900;
  min-width: 220px;
  padding: 4px 0;
  background: var(--dsh-wb-menu-background);
  color: var(--dsh-wb-menu-foreground);
  border: 1px solid var(--dsh-wb-menu-border);
  border-radius: 5px;
  box-shadow: var(--dsh-wb-widget-shadow);
}

.dsh-wb-menu-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  padding: 4px 14px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dsh-wb-menu-entry:hover {
  background: var(--dsh-wb-menu-selectionBackground);
  color: var(--dsh-wb-menu-selectionForeground);
}

.dsh-wb-menu-keybinding {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-menu-entry:hover .dsh-wb-menu-keybinding {
  color: inherit;
}

/* ---------- Context menu (right-click zones) ---------- */

.dsh-wb-contextmenu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 950;
}

.dsh-wb-contextmenu {
  position: fixed;
  z-index: 951;
  min-width: 180px;
  padding: 4px 0;
  background: var(--dsh-wb-menu-background);
  color: var(--dsh-wb-menu-foreground);
  border: 1px solid var(--dsh-wb-menu-border);
  border-radius: 5px;
  box-shadow: var(--dsh-wb-widget-shadow);
}

.dsh-wb-contextmenu-entry {
  display: block;
  width: 100%;
  padding: 4px 14px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dsh-wb-contextmenu-entry:hover {
  background: var(--dsh-wb-menu-selectionBackground);
  color: var(--dsh-wb-menu-selectionForeground);
}

.dsh-wb-contextmenu-danger {
  color: var(--dsh-wb-errorForeground);
}

/* ---------- Quick Input (command palette / go to file) ---------- */

.dsh-wb-quickinput-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
}

.dsh-wb-quickinput {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(600px, 80%);
  display: flex;
  flex-direction: column;
  max-height: 70%;
  background: var(--dsh-wb-quickInput-background);
  color: var(--dsh-wb-quickInput-foreground);
  border: 1px solid var(--dsh-wb-widget-border);
  box-shadow: var(--dsh-wb-widget-shadow);
}

.dsh-wb-quickinput-title {
  padding: 6px 10px 0;
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-quickinput-input {
  margin: 6px;
  padding: 4px 6px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 2px;
  background: var(--dsh-wb-input-background);
  color: var(--dsh-wb-input-foreground);
  font: inherit;
}

.dsh-wb-quickinput-input::placeholder {
  color: var(--dsh-wb-input-placeholderForeground);
}

.dsh-wb-quickinput-list {
  overflow-y: auto;
  padding: 0 6px 6px;
  min-height: 40px;
}

.dsh-wb-quickitem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 22px;
  padding: 0 6px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.dsh-wb-quickitem-active {
  background: var(--dsh-wb-list-activeSelectionBackground);
  color: var(--dsh-wb-list-activeSelectionForeground);
}

.dsh-wb-quickitem-label {
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsh-wb-quickitem-detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-quickitem-active .dsh-wb-quickitem-detail {
  color: inherit;
}

.dsh-wb-quickitem-hint {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
  border: 1px solid var(--dsh-wb-widget-border);
  border-radius: 3px;
  padding: 0 4px;
}

.dsh-wb-quickitem-active .dsh-wb-quickitem-hint {
  color: inherit;
}

/* ---------- Body / activity bar ---------- */

.dsh-wb-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.dsh-wb-activitybar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: var(--dsh-wb-size-activity-bar);
  flex-shrink: 0;
  background: var(--dsh-wb-activityBar-background);
  border-right: 1px solid var(--dsh-wb-activityBar-border);
}

.dsh-wb-activity-action {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--dsh-wb-size-activity-bar);
  width: 100%;
  border: none;
  background: transparent;
  color: var(--dsh-wb-activityBar-inactiveForeground);
  cursor: pointer;
  transition: color 0.1s ease;
}

.dsh-wb-activity-action:hover {
  background: var(--dsh-wb-chromeHoverBackground);
  color: var(--dsh-wb-activityBar-foreground);
}

.dsh-wb-activity-action[aria-pressed="true"] {
  color: var(--dsh-wb-activityBar-foreground);
}

.dsh-wb-activity-action[aria-pressed="true"]::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--dsh-wb-activityBar-activeBorder);
}

.dsh-wb-activitybar-spacer {
  flex: 1;
}

/* ---------- Sidebar and views ---------- */

.dsh-wb-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--dsh-wb-sideBar-background);
  color: var(--dsh-wb-sideBar-foreground);
  border-right: 1px solid var(--dsh-wb-sideBar-border);
  box-sizing: border-box;
}

/* Auxiliary bar: same skin, mirrored border (right-hand dock). */
.dsh-wb-aux {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--dsh-wb-sideBar-background);
  color: var(--dsh-wb-sideBar-foreground);
  border-left: 1px solid var(--dsh-wb-sideBar-border);
  box-sizing: border-box;
}

/* Floating AI window (aiLocation 'floating'): an absolutely-positioned
   widget over the editor area, above the status bar (VS Code widget skin). */
.dsh-wb-aifloat {
  position: absolute;
  right: 16px;
  bottom: 34px;
  z-index: 150;
  width: 380px;
  height: 460px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dsh-wb-sideBar-background);
  color: var(--dsh-wb-sideBar-foreground);
  border: 1px solid var(--dsh-wb-sideBar-border);
  border-radius: 5px;
  box-shadow: var(--dsh-wb-widget-shadow);
}

/* Side-docked panel row (panel left/right of the editor). */
.dsh-wb-row {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

/* Sashes: the 4px drag handles between regions (VS Code sash sizing). */
.dsh-wb-sash {
  position: relative;
  flex-shrink: 0;
  z-index: 35;
}

.dsh-wb-sash-vertical {
  width: 4px;
  cursor: col-resize;
}

.dsh-wb-sash-horizontal {
  height: 4px;
  cursor: row-resize;
}

.dsh-wb-sash::after {
  content: "";
  position: absolute;
  inset: 0;
  background: transparent;
  transition: background-color 100ms ease-out;
}

.dsh-wb-sash:hover::after,
.dsh-wb-sash:active::after {
  background: var(--dsh-wb-sash-hoverBorder);
}

.dsh-wb-viewheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  height: var(--dsh-wb-size-view-header);
  padding: 0 12px;
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.dsh-wb-viewheader-title {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dsh-wb-sideBarTitle-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dsh-wb-viewheader-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Move-to dropdown anchor in a view header. */
.dsh-wb-viewheader-menuwrap {
  position: relative;
}

.dsh-wb-viewheader-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 900;
  min-width: 150px;
  padding: 4px 0;
  background: var(--dsh-wb-menu-background);
  color: var(--dsh-wb-menu-foreground);
  border: 1px solid var(--dsh-wb-menu-border);
  border-radius: 5px;
  box-shadow: var(--dsh-wb-widget-shadow);
}

.dsh-wb-viewheader-dropdown .dsh-wb-menu-entry[aria-pressed="true"] {
  font-weight: 600;
}

.dsh-wb-actionicon {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.dsh-wb-actionicon:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

/* ---------- Tree (explorer) ---------- */

.dsh-wb-tree {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: 2px 0 8px;
}

.dsh-wb-tree-rootlabel {
  display: block;
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--dsh-wb-sideBarTitle-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}

.dsh-wb-treerow {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--dsh-wb-size-tree-row);
  width: 100%;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  box-sizing: border-box;
  overflow: hidden;
}

.dsh-wb-treerow > span:last-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsh-wb-treerow:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-treerow[aria-selected="true"] {
  background: var(--dsh-wb-list-activeSelectionBackground);
  color: var(--dsh-wb-list-activeSelectionForeground);
}

.dsh-wb-treetwistie {
  display: inline-grid;
  place-items: center;
  width: 16px;
  flex-shrink: 0;
  font-size: 12px;
}

.dsh-wb-fileicon {
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--dsh-wb-fileIcon-default);
}

.dsh-wb-fileicon-folder { color: var(--dsh-wb-fileIcon-folder); }
.dsh-wb-fileicon-python { color: var(--dsh-wb-fileIcon-python); }
.dsh-wb-fileicon-java { color: var(--dsh-wb-fileIcon-java); }
.dsh-wb-fileicon-typescript { color: var(--dsh-wb-fileIcon-typescript); }
.dsh-wb-fileicon-javascript { color: var(--dsh-wb-fileIcon-javascript); }
.dsh-wb-fileicon-html { color: var(--dsh-wb-fileIcon-html); }
.dsh-wb-fileicon-css { color: var(--dsh-wb-fileIcon-css); }
.dsh-wb-fileicon-json { color: var(--dsh-wb-fileIcon-json); }
.dsh-wb-fileicon-yaml { color: var(--dsh-wb-fileIcon-yaml); }
.dsh-wb-fileicon-markdown { color: var(--dsh-wb-fileIcon-markdown); }
.dsh-wb-fileicon-shell { color: var(--dsh-wb-fileIcon-shell); }
.dsh-wb-fileicon-cpp { color: var(--dsh-wb-fileIcon-cpp); }
.dsh-wb-fileicon-rust { color: var(--dsh-wb-fileIcon-rust); }
.dsh-wb-fileicon-go { color: var(--dsh-wb-fileIcon-go); }
.dsh-wb-fileicon-image { color: var(--dsh-wb-fileIcon-image); }
.dsh-wb-fileicon-config { color: var(--dsh-wb-fileIcon-config); }
.dsh-wb-fileicon-default { color: var(--dsh-wb-fileIcon-default); }

.dsh-wb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--dsh-wb-descriptionForeground);
  font-size: var(--dsh-wb-size-font);
  padding: 0 16px;
  text-align: center;
}

.dsh-wb-error {
  padding: 6px 12px;
  color: var(--dsh-wb-errorForeground);
  font-size: 12px;
}

/* Attached editor selection chip in the chat composer. */
.dsh-wb-chat-attach {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.dsh-wb-chat-attach-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 2px;
  background: var(--dsh-wb-input-background);
  color: var(--dsh-wb-input-foreground);
}

/* Question card: the pending ask_user_question answer form. */
.dsh-wb-question {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--dsh-wb-panel-border);
}

.dsh-wb-question-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-question-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dsh-wb-question-eyebrow {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-question-title {
  font-size: 13px;
}

.dsh-wb-question-detail {
  font-size: 12px;
  color: var(--dsh-wb-descriptionForeground);
  white-space: pre-wrap;
}

.dsh-wb-question-option {
  padding: 4px 12px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 2px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.dsh-wb-question-option:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-question-option[aria-pressed="true"] {
  background: var(--dsh-wb-button-background);
  color: var(--dsh-wb-button-foreground);
  border-color: var(--dsh-wb-button-background);
}

.dsh-wb-question-option:disabled {
  opacity: 0.5;
  cursor: default;
}

.dsh-wb-question-input {
  padding: 3px 8px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 2px;
  background: var(--dsh-wb-input-background);
  color: var(--dsh-wb-input-foreground);
  font: inherit;
  font-size: 12px;
}

.dsh-wb-question-input::placeholder {
  color: var(--dsh-wb-input-placeholderForeground);
}

.dsh-wb-question-skip {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsh-wb-descriptionForeground);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsh-wb-question-skip:hover {
  text-decoration: underline;
}

.dsh-wb-question-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Diff apply card: a settled tool call's diff result view, rendered inline
   in the chat scroll. */
.dsh-wb-diff {
  display: flex;
  flex-direction: column;
  margin: 4px 8px;
  border: 1px solid var(--dsh-wb-widget-border);
  border-radius: 5px;
  background: var(--dsh-wb-editorWidget-background);
}

.dsh-wb-diff-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsh-wb-widget-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--dsh-wb-editorWidget-foreground);
}

.dsh-wb-diff-file {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
}

.dsh-wb-diff-file + .dsh-wb-diff-file {
  border-top: 1px solid var(--dsh-wb-widget-border);
}

.dsh-wb-diff-path {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.dsh-wb-diff-pathname {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsh-wb-textLink-foreground);
}

.dsh-wb-diff-stats {
  flex: none;
  display: flex;
  gap: 8px;
  font-size: 11px;
}

.dsh-wb-diff-added {
  color: var(--dsh-wb-gitDecoration-addedResourceForeground);
}

.dsh-wb-diff-removed {
  color: var(--dsh-wb-gitDecoration-deletedResourceForeground);
}

.dsh-wb-diff-preview {
  margin: 4px 0 0;
  padding: 6px 8px;
  max-height: 140px;
  overflow: hidden;
  background: var(--dsh-wb-editor-background);
  color: var(--dsh-wb-descriptionForeground);
  font-family: var(--dsh-wb-font-mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.dsh-wb-diff-note {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-diff-conflict {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--dsh-wb-widget-border);
  font-size: 12px;
}

.dsh-wb-diff-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--dsh-wb-widget-border);
}

/* Save-conflict dialog: centered card over the editor area. */
.dsh-wb-conflict {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: min(480px, 80%);
  padding: 14px 16px;
  background: var(--dsh-wb-editorWidget-background);
  color: var(--dsh-wb-editorWidget-foreground);
  border: 1px solid var(--dsh-wb-widget-border);
  box-shadow: var(--dsh-wb-widget-shadow);
  z-index: 250;
}

.dsh-wb-conflict-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.dsh-wb-conflict-body {
  margin-bottom: 10px;
}

.dsh-wb-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.dsh-wb-conflict .dsh-wb-input {
  width: 100%;
  margin-top: 8px;
  padding: 4px 6px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 2px;
  background: var(--dsh-wb-input-background);
  color: var(--dsh-wb-input-foreground);
  font: inherit;
  box-sizing: border-box;
}

/* ---------- Dialog Animations & In-App Workspace Chooser ---------- */

@keyframes dsh-dialog-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dsh-dialog-scale-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.dsh-wb-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: var(--dsh-wb-dialog-backdrop);
  backdrop-filter: blur(4px);
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  animation: dsh-dialog-fade-in 0.15s ease-out;
}

.dsh-wb-dialog-card {
  display: flex;
  flex-direction: column;
  width: min(680px, 94vw);
  height: min(520px, 85vh);
  background: var(--dsh-wb-editorWidget-background);
  color: var(--dsh-wb-editorWidget-foreground);
  border: 1px solid var(--dsh-wb-widget-border);
  border-radius: 6px;
  box-shadow: var(--dsh-wb-dialog-shadow);
  overflow: hidden;
  box-sizing: border-box;
  animation: dsh-dialog-scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.dsh-wb-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid var(--dsh-wb-widget-border);
  background: var(--dsh-wb-titleBar-activeBackground);
  user-select: none;
}

.dsh-wb-dialog-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsh-wb-dialog-close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  opacity: 0.75;
}

.dsh-wb-dialog-close:hover {
  opacity: 1;
}

.dsh-wb-dialog-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--dsh-wb-editorGroupHeader-tabsBackground);
  border-bottom: 1px solid var(--dsh-wb-widget-border);
}

.dsh-wb-dialog-nav input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 2px;
  background: var(--dsh-wb-input-background);
  color: var(--dsh-wb-input-foreground);
  font: inherit;
  font-size: 12px;
}

.dsh-wb-dialog-nav input:focus {
  outline: 1px solid var(--dsh-wb-focusBorder);
}

.dsh-wb-dialog-list {
  flex: 1;
  min-height: 180px;
  overflow-y: auto;
  padding: 4px 0;
  background: var(--dsh-wb-sideBar-background);
}

.dsh-wb-dialog-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
}

.dsh-wb-dialog-row:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-dialog-row[data-selected="true"] {
  background: var(--dsh-wb-list-activeSelectionBackground);
  color: var(--dsh-wb-list-activeSelectionForeground);
}

.dsh-wb-dialog-row-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsh-wb-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--dsh-wb-widget-border);
  background: var(--dsh-wb-titleBar-activeBackground);
  gap: 8px;
  font-size: 12px;
}

.dsh-wb-dialog-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ---------- Center: editor area and panel ---------- */

.dsh-wb-center {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.dsh-wb-editorarea {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  position: relative;
}

.dsh-wb-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 2px;
  height: var(--dsh-wb-size-breadcrumb);
  padding: 0 8px;
  flex-shrink: 0;
  background: var(--dsh-wb-breadcrumb-background);
  color: var(--dsh-wb-breadcrumb-foreground);
  font-size: 11px;
  user-select: none;
}

.dsh-wb-breadcrumb-segment {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 3px;
  border-radius: 3px;
}

.dsh-wb-breadcrumb-segment:last-child {
  color: var(--dsh-wb-breadcrumb-focusForeground);
}

.dsh-wb-editorpanes {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.dsh-wb-editorpane {
  display: flex;
  flex-direction: column;
  flex-grow: 0;
  flex-shrink: 1;
  flex-basis: 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.dsh-wb-editorgroup {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.dsh-wb-tabs {
  display: flex;
  align-items: stretch;
  height: var(--dsh-wb-size-tab);
  flex-shrink: 0;
  background: var(--dsh-wb-editorGroupHeader-tabsBackground);
  border-bottom: 1px solid var(--dsh-wb-tab-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.dsh-wb-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: none;
  border-right: 1px solid var(--dsh-wb-tab-border);
  background: var(--dsh-wb-tab-inactiveBackground);
  color: var(--dsh-wb-tab-inactiveForeground);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.dsh-wb-tab:hover {
  background: var(--dsh-wb-chromeHoverBackground);
  color: var(--dsh-wb-tab-activeForeground);
}

.dsh-wb-tab[aria-selected="true"] {
  background: var(--dsh-wb-tab-activeBackground);
  color: var(--dsh-wb-tab-activeForeground);
}

.dsh-wb-tab[aria-selected="true"]::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--dsh-wb-tab-activeBorderTop);
}

/* Preview (unpinned) tabs render italic, VS Code tab semantics. */
.dsh-wb-tab-preview {
  font-style: italic;
}

.dsh-wb-tab-close {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.1s ease, background 0.1s ease;
}

.dsh-wb-tab-close:hover {
  opacity: 1;
  background: var(--dsh-wb-chromeHoverBackground);
}

.dsh-wb-tab-dirty {
  color: var(--dsh-wb-tab-inactiveForeground);
}

.dsh-wb-tab[aria-selected="true"] .dsh-wb-tab-dirty {
  color: var(--dsh-wb-tab-activeForeground);
}

.dsh-wb-editorbody {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--dsh-wb-editor-background);
}

.dsh-wb-editorsurface {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 4px 0 0 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsh-wb-editor-foreground);
  font-family: var(--dsh-wb-font-mono);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  box-sizing: border-box;
}

.dsh-wb-editortoolbar {
  display: none;
}

.dsh-wb-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  padding: 0 32px;
  text-align: center;
}

.dsh-wb-welcome-title {
  font-size: 26px;
  font-weight: 300;
  letter-spacing: -0.5px;
  color: var(--dsh-wb-editor-foreground);
}

.dsh-wb-welcome-hint {
  font-size: var(--dsh-wb-size-font);
  color: var(--dsh-wb-descriptionForeground);
  max-width: 420px;
  line-height: 1.6;
}

.dsh-wb-welcome-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 24px;
  min-width: 300px;
}

.dsh-wb-welcome-shortcut {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  font-size: 12px;
  color: var(--dsh-wb-descriptionForeground);
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.1s ease, color 0.1s ease;
}

.dsh-wb-welcome-shortcut:hover {
  background: var(--dsh-wb-list-hoverBackground);
  color: var(--dsh-wb-foreground);
}

.dsh-wb-welcome-kbd {
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--dsh-wb-textCodeBlock-background);
  border: 1px solid var(--dsh-wb-widget-border);
  font-family: var(--dsh-wb-font-mono);
  font-size: 11px;
  color: var(--dsh-wb-foreground);
  box-shadow: var(--dsh-wb-kbd-shadow);
}

/* ---------- Bottom panel ---------- */

.dsh-wb-panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--dsh-wb-panel-background);
  border-top: 1px solid var(--dsh-wb-panel-border);
  box-sizing: border-box;
}

.dsh-wb-paneltitle {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--dsh-wb-size-view-header);
  padding: 0 8px 0 16px;
  border-bottom: 1px solid var(--dsh-wb-panel-border);
  flex-shrink: 0;
  box-sizing: border-box;
}

.dsh-wb-paneltitle-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
  height: 100%;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--dsh-wb-panelTitle-activeForeground);
  box-shadow: inset 0 -1px 0 var(--dsh-wb-panelTitle-activeBorder);
}

.dsh-wb-paneltitle-spacer {
  flex: 1;
}

.dsh-wb-terminalbody {
  flex: 1;
  min-height: 0;
  padding: 4px 0 0 8px;
  overflow: hidden;
}

.dsh-wb-panelnotice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px;
  flex-shrink: 0;
  font-size: 12px;
}

/* ---------- Panel tabs (B2-2) ---------- */

.dsh-wb-paneltabs {
  display: flex;
  align-items: stretch;
  height: var(--dsh-wb-size-tab);
  flex-shrink: 0;
  background: var(--dsh-wb-panel-background);
  border-bottom: 1px solid var(--dsh-wb-panel-border);
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0 4px;
}

.dsh-wb-paneltab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--dsh-wb-panelTitle-inactiveForeground);
  font: inherit;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  cursor: pointer;
}

.dsh-wb-paneltab:hover {
  color: var(--dsh-wb-panelTitle-activeForeground);
}

.dsh-wb-paneltab[aria-selected="true"] {
  color: var(--dsh-wb-panelTitle-activeForeground);
  border-bottom: 1px solid var(--dsh-wb-panelTitle-activeBorder);
}

.dsh-wb-panelbody {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

/* ---------- Status bar ---------- */

.dsh-wb-statusbar {
  display: flex;
  align-items: stretch;
  height: var(--dsh-wb-size-status-bar);
  flex-shrink: 0;
  background: var(--dsh-wb-statusBar-background);
  color: var(--dsh-wb-statusBar-foreground);
  border-top: 1px solid var(--dsh-wb-statusBar-border);
  font-size: 12px;
  user-select: none;
}

.dsh-wb-statusbar-left,
.dsh-wb-statusbar-right {
  display: flex;
  align-items: stretch;
}

.dsh-wb-statusbar-left {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.dsh-wb-statusbar-right {
  flex-shrink: 0;
}

.dsh-wb-statusitem {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  height: 100%;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11.5px;
  white-space: nowrap;
}

button.dsh-wb-statusitem {
  cursor: pointer;
}

button.dsh-wb-statusitem:hover {
  background: var(--dsh-wb-statusBarItem-hoverBackground);
}

.dsh-wb-statusitem-remote {
  padding: 0 10px;
  background: var(--dsh-wb-statusBarItem-remoteBackground);
  color: var(--dsh-wb-statusBarItem-remoteForeground);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* ---------- Chat (AI assistant) ---------- */

/* ---------- Qoder-Style AI Assistant Panel ---------- */

.dsh-wb-chat {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--dsh-wb-sideBar-background);
}

.dsh-wb-ai-header {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--dsh-wb-sideBar-border);
  background: var(--dsh-wb-sideBar-background);
  flex-shrink: 0;
}

.dsh-wb-chat-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
}

.dsh-wb-chat-select {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  background: var(--dsh-wb-dropdown-background);
  color: var(--dsh-wb-dropdown-foreground);
  border: 1px solid var(--dsh-wb-dropdown-border);
  border-radius: 3px;
  font: inherit;
  font-size: 12px;
}

.dsh-wb-ai-mode-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px 6px;
}

.dsh-wb-ai-mode-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--dsh-wb-descriptionForeground);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dsh-wb-ai-mode-tab:hover {
  background: var(--dsh-wb-list-hoverBackground);
  color: var(--dsh-wb-foreground);
}

.dsh-wb-ai-mode-tab.dsh-wb-ai-mode-active {
  background: var(--dsh-wb-ai-context-chipBackground);
  border-color: var(--dsh-wb-ai-context-chipBorder);
  color: var(--dsh-wb-ai-context-chipForeground);
  font-weight: 500;
}

.dsh-wb-chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* User & Assistant Bubble Cards */

.dsh-wb-ai-bubble-user {
  align-self: flex-end;
  max-width: 90%;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--dsh-wb-ai-bubble-userBackground);
  border: 1px solid var(--dsh-wb-ai-bubble-userBorder);
  color: var(--dsh-wb-foreground);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dsh-wb-ai-bubble-assistant {
  align-self: flex-start;
  width: 100%;
  padding: 8px 0;
  color: var(--dsh-wb-foreground);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dsh-wb-ai-bubble-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-ai-bubble-avatar {
  font-weight: 600;
}

.dsh-wb-ai-avatar-sparkle {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--dsh-wb-focusBorder);
}

.dsh-wb-ai-bubble-text {
  font-size: var(--dsh-wb-size-font);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.dsh-wb-ai-streaming-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--dsh-wb-descriptionForeground);
  font-style: italic;
  padding: 4px 0;
}

/* DeepSeek Thinking / Reasoning Card */

.dsh-wb-ai-think-card {
  border: 1px solid var(--dsh-wb-ai-think-border);
  border-radius: 6px;
  background: var(--dsh-wb-ai-think-background);
  overflow: hidden;
  margin: 2px 0 6px;
}

.dsh-wb-ai-think-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--dsh-wb-ai-think-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}

.dsh-wb-ai-think-header:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-ai-think-sparkle {
  color: var(--dsh-wb-ai-think-timerText);
  display: flex;
  align-items: center;
}

.dsh-wb-ai-think-label {
  flex: 1;
  font-weight: 500;
}

.dsh-wb-ai-think-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsh-wb-focusBorder);
  animation: dsh-wb-pulse 1.5s infinite ease-in-out;
}

@keyframes dsh-wb-pulse {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

.dsh-wb-ai-think-body {
  padding: 6px 10px 10px;
  border-top: 1px solid var(--dsh-wb-ai-think-border);
  font-size: 11px;
  line-height: 1.45;
  color: var(--dsh-wb-ai-think-text);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 240px;
  overflow-y: auto;
}

/* Markdown Rendering */

.dsh-wb-ai-markdown {
  font-size: var(--dsh-wb-size-font);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dsh-wb-ai-paragraph {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.dsh-wb-ai-heading {
  margin: 6px 0 2px;
  font-weight: 600;
  color: var(--dsh-wb-foreground);
}

.dsh-wb-ai-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dsh-wb-ai-inline-code {
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--dsh-wb-ai-think-background);
  border: 1px solid var(--dsh-wb-ai-think-border);
  font-family: monospace;
  font-size: 12px;
}

/* Code Blocks */

.dsh-wb-ai-code-block {
  border: 1px solid var(--dsh-wb-ai-tool-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--dsh-wb-editor-background);
  margin: 4px 0;
}

.dsh-wb-ai-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: var(--dsh-wb-ai-code-headerBackground);
  border-bottom: 1px solid var(--dsh-wb-ai-tool-border);
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-ai-code-lang {
  font-weight: 500;
  text-transform: uppercase;
}

.dsh-wb-ai-code-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dsh-wb-ai-code-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--dsh-wb-foreground);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.dsh-wb-ai-code-btn:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-ai-code-content {
  margin: 0;
  padding: 8px 10px;
  overflow-x: auto;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.45;
  background: var(--dsh-wb-editor-background);
  color: var(--dsh-wb-editor-foreground);
}

/* Tool Accordion */

.dsh-wb-ai-tool-accordion {
  border: 1px solid var(--dsh-wb-ai-tool-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--dsh-wb-ai-tool-headerBackground);
  margin: 4px 0;
}

.dsh-wb-ai-tool-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--dsh-wb-foreground);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}

.dsh-wb-ai-tool-cat-icon {
  display: flex;
  align-items: center;
  color: var(--dsh-wb-focusBorder);
}

.dsh-wb-ai-tool-summary {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.dsh-wb-ai-tool-status {
  display: flex;
  align-items: center;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-ai-tool-body {
  padding: 8px 10px;
  border-top: 1px solid var(--dsh-wb-ai-tool-border);
  background: var(--dsh-wb-ai-tool-outputBackground);
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dsh-wb-ai-tool-param {
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-ai-tool-raw {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dsh-wb-ai-tool-sublabel {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-ai-tool-code {
  margin: 0;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--dsh-wb-editor-background);
  border: 1px solid var(--dsh-wb-ai-tool-border);
  font-family: monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  overflow-y: auto;
}

/* Command Rows */

.dsh-wb-ai-command-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--dsh-wb-ai-think-background);
  border: 1px solid var(--dsh-wb-ai-think-border);
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-ai-command-prefix {
  color: var(--dsh-wb-focusBorder);
  font-weight: bold;
}

/* Context Bar */

.dsh-wb-ai-context-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}

.dsh-wb-ai-context-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--dsh-wb-ai-context-chipBorder);
  background: var(--dsh-wb-ai-context-chipBackground);
  color: var(--dsh-wb-ai-context-chipForeground);
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}

.dsh-wb-ai-context-badge {
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;
  background: var(--dsh-wb-focusBorder);
  color: var(--dsh-wb-button-foreground);
  text-transform: uppercase;
}

.dsh-wb-ai-context-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
}

/* Composer & Actions */

.dsh-wb-chat-composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--dsh-wb-sideBar-border);
  background: var(--dsh-wb-sideBar-background);
  flex-shrink: 0;
}

.dsh-wb-chat-input {
  width: 100%;
  min-height: 52px;
  padding: 8px;
  border: 1px solid var(--dsh-wb-input-border);
  border-radius: 4px;
  background: var(--dsh-wb-input-background);
  color: var(--dsh-wb-input-foreground);
  font: inherit;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
}

.dsh-wb-chat-input:focus {
  outline: none;
  border-color: var(--dsh-wb-focusBorder);
}

.dsh-wb-chat-input::placeholder {
  color: var(--dsh-wb-input-placeholderForeground);
}

.dsh-wb-chat-composerrow {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dsh-wb-ai-send-btn,
.dsh-wb-ai-stop-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 12px;
}

.dsh-wb-chat-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
}

.dsh-wb-chat-role {
  font-size: 11px;
  color: var(--dsh-wb-descriptionForeground);
}

.dsh-wb-chat-text {
  font-size: var(--dsh-wb-size-font);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.dsh-wb-chat-running {
  color: var(--dsh-wb-descriptionForeground);
  font-style: italic;
}

.dsh-wb-chat-pending {
  color: var(--dsh-wb-descriptionForeground);
}

/* ---------- Approval / question cards ---------- */

.dsh-wb-approval {
  margin: 8px 12px 0;
  border: 1px solid var(--dsh-wb-widget-border);
  border-radius: 4px;
  background: var(--dsh-wb-editorWidget-background);
  overflow: hidden;
  flex-shrink: 0;
}

.dsh-wb-approval-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--dsh-wb-approvalWaiting-foreground);
  background: var(--dsh-wb-approvalWaiting-background);
}

.dsh-wb-approval-body {
  padding: 8px 10px;
  max-height: 180px;
  overflow-y: auto;
  font-size: var(--dsh-wb-size-font);
}

.dsh-wb-approval-tool {
  font-weight: 600;
}

.dsh-wb-approval-command {
  margin-top: 6px;
  padding: 4px 6px;
  border-radius: 3px;
  background: var(--dsh-wb-textPreformat-background);
  color: var(--dsh-wb-textPreformat-foreground);
  font-family: var(--dsh-wb-font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}

.dsh-wb-approval-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 10px;
}

/* ---------- Buttons ---------- */

.dsh-wb-button {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: var(--dsh-wb-button-background);
  color: var(--dsh-wb-button-foreground);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsh-wb-button:hover {
  background: var(--dsh-wb-button-hoverBackground);
}

.dsh-wb-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.dsh-wb-run-button {
  background: var(--dsh-wb-statusBarItem-remoteBackground);
  color: var(--dsh-wb-statusBarItem-remoteForeground);
  font-weight: 600;
}

.dsh-wb-button-secondary {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: var(--dsh-wb-button-secondaryBackground);
  color: var(--dsh-wb-button-secondaryForeground);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsh-wb-button-secondary:hover {
  background: var(--dsh-wb-button-secondaryHoverBackground);
}

.dsh-wb-button-secondary:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ---------- Settings ---------- */

.dsh-wb-settings {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dsh-wb-settings-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
}

.dsh-wb-settings-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--dsh-wb-sideBar-border);
}

.dsh-wb-settings-label {
  font-size: 12px;
  font-weight: 600;
}

.dsh-wb-settings-options {
  display: flex;
  gap: 6px;
}

.dsh-wb-settings-option {
  padding: 3px 10px;
  border: 1px solid var(--dsh-wb-widget-border);
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsh-wb-settings-option:hover {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-settings-option-active {
  background: var(--dsh-wb-button-background);
  color: var(--dsh-wb-button-foreground);
  border-color: var(--dsh-wb-button-background);
}

/* ---------- Minimap ---------- */

.dsh-wb-minimap {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 60px;
  border-left: 1px solid var(--dsh-wb-sideBar-border);
  background: var(--dsh-wb-editor-background);
  opacity: 0.9;
  overflow: hidden;
  user-select: none;
  pointer-events: none;
}

.dsh-wb-minimap-line {
  height: 2px;
  margin: 0 6px;
  background: var(--dsh-wb-editor-foreground);
  opacity: 0.35;
  border-radius: 1px;
}

/* ---------- AI Mention Menu ---------- */

.dsh-wb-ai-mention-menu {
  position: absolute;
  bottom: 100%;
  left: 12px;
  right: 12px;
  background: var(--dsh-wb-dropdown-background);
  color: var(--dsh-wb-dropdown-foreground);
  border: 1px solid var(--dsh-wb-dropdown-border);
  border-radius: 4px;
  box-shadow: var(--dsh-wb-widget-shadow);
  max-height: 180px;
  overflow-y: auto;
  z-index: 100;
  padding: 4px;
  margin-bottom: 6px;
}

.dsh-wb-ai-mention-header {
  font-size: 10px;
  color: var(--dsh-wb-descriptionForeground);
  padding: 2px 6px;
  font-weight: 600;
}

.dsh-wb-ai-mention-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 3px;
  cursor: pointer;
}

.dsh-wb-ai-mention-item:hover,
.dsh-wb-ai-mention-active {
  background: var(--dsh-wb-list-hoverBackground);
}

.dsh-wb-fix-ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-size: 11px;
  background: var(--dsh-wb-button-background);
  color: var(--dsh-wb-button-foreground);
  border-radius: 3px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}
`
