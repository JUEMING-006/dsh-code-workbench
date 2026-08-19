/**
 * DirectoryPickerDialog tests: in-app project chooser browsing, parent navigation,
 * directory listing, filtering, selection, and confirm/cancel events.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FsClient } from '../../fs/client.ts'
import { DirectoryPickerDialog } from './DirectoryPickerDialog.tsx'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'

function createFakeFs(): FsClient {
  return {
    listDir: vi.fn(async (path: string) => {
      if (path === '/workspace') {
        return {
          path: '/workspace',
          entries: [
            { name: 'project-a', type: 'directory' },
            { name: 'project-b', type: 'directory' },
            { name: 'file.txt', type: 'file' },
          ],
        }
      }
      if (path === '/workspace/project-a') {
        return {
          path: '/workspace/project-a',
          entries: [
            { name: 'src', type: 'directory' },
          ],
        }
      }
      return { path, entries: [] }
    }),
    listAll: vi.fn(async () => ({ root: '/workspace', files: [] })),
    readText: vi.fn(async () => ({ path: '', content: '', version: '1' })),
    writeText: vi.fn(async () => ({ path: '', version: '2' })),
    noteActiveFile: vi.fn(async () => {}),
    search: vi.fn(async () => ({ root: '', pattern: '', matches: [], truncated: false })),
    replace: vi.fn(async () => ({ path: '', version: '1' })),
  } as unknown as FsClient
}

describe('DirectoryPickerDialog', () => {
  it('renders directory list, navigates into folder on double click, and selects', async () => {
    const fakeFs = createFakeFs()
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <I18nProvider>
        <DirectoryPickerDialog
          initialPath="/workspace"
          fs={fakeFs}
          onSelect={onSelect}
          onClose={onClose}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText('project-a')).toBeTruthy())
    expect(screen.getByText('project-b')).toBeTruthy()
    // Files should be filtered out
    expect(screen.queryByText('file.txt')).toBeNull()

    // Double click to navigate into project-a
    fireEvent.doubleClick(screen.getByText('project-a'))
    await waitFor(() => expect(screen.getByText('src')).toBeTruthy())

    // Confirm selection
    const confirmBtn = screen.getByText('选择此文件夹')
    fireEvent.click(confirmBtn)
    expect(onSelect).toHaveBeenCalledWith('/workspace/project-a')
    expect(onClose).toHaveBeenCalled()
  })

  it('filters directories by name', async () => {
    const fakeFs = createFakeFs()
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <I18nProvider>
        <DirectoryPickerDialog
          initialPath="/workspace"
          fs={fakeFs}
          onSelect={onSelect}
          onClose={onClose}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText('project-a')).toBeTruthy())

    const filterInput = screen.getByPlaceholderText('过滤当前目录下的子文件夹...')
    fireEvent.change(filterInput, { target: { value: 'project-b' } })

    expect(screen.queryByText('project-a')).toBeNull()
    expect(screen.getByText('project-b')).toBeTruthy()
  })

  it('navigates up when clicking Up button', async () => {
    const fakeFs = createFakeFs()
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <I18nProvider>
        <DirectoryPickerDialog
          initialPath="/workspace/project-a"
          fs={fakeFs}
          onSelect={onSelect}
          onClose={onClose}
        />
      </I18nProvider>,
    )

    await waitFor(() => expect(screen.getByText('src')).toBeTruthy())

    const upBtn = screen.getByTitle('上一级 (Up)')
    fireEvent.click(upBtn)

    await waitFor(() => expect(screen.getByText('project-b')).toBeTruthy())
  })
})
