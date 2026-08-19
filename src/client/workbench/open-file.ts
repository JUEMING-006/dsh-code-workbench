/**
 * Open one file into the editor store: read through the fs gateway and open
 * a tab with the version token (the version-guarded-save contract). Shared
 * by the explorer and Quick Open. Tabs opened this way are preview tabs —
 * a fresh explorer click replaces the previous preview instead of stacking.
 */

import type { EngineStoreInstance } from '@deepseek-ai/dsh-client-runtime/client'
import type { FsClient } from '../fs/client.ts'
import type { EditorActions, EditorState } from './editor-store.ts'

/**
 * Read one file and open it as an editor tab.
 * @param fs - the gateway client.
 * @param editor - the editor store instance.
 * @param path - the file to open (absolute or workspace-relative per gateway).
 * @returns resolves when the tab is open; rejects with the gateway error.
 */
export async function openFileIntoEditor(
  fs: FsClient,
  editor: EngineStoreInstance<EditorState, EditorActions>,
  path: string,
): Promise<void> {
  const file = await fs.readText(path)
  editor.actions.openTab({
    path: file.path,
    content: file.content,
    version: file.version,
    dirty: false,
    preview: true,
  })
}
