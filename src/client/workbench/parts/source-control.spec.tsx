import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SourceControlView } from './SourceControlView.tsx'
import { WorkbenchContext } from '../editor-context.ts'
import type { GitClient, GitStatusResult } from '../../git/client.ts'
import { createEditorStore } from '../editor-store.ts'
import { I18nProvider } from '../../i18n/I18nProvider.tsx'

function mockGit(statusResult: GitStatusResult): GitClient {
  return {
    status: vi.fn(async () => statusResult),
    stage: vi.fn(async () => {}),
    unstage: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    commit: vi.fn(async () => ({ hash: 'abc1234' })),
    diff: vi.fn(async () => ({ original: 'old content', modified: 'new content' })),
  }
}

function renderScm(git: GitClient, root = '/workspace') {
  const editor = createEditorStore().create()
  const services = {
    editor,
    fs: {} as never,
    fsOps: {} as never,
    sessions: { open: vi.fn(), binding: vi.fn() },
    workspaces: { startSession: vi.fn() },
    git,
  }
  const utils = render(
    <I18nProvider>
      <WorkbenchContext.Provider value={services}>
        <SourceControlView git={git} root={root} />
      </WorkbenchContext.Provider>
    </I18nProvider>,
  )
  return { ...utils, editor }
}

describe('SourceControlView', () => {
  it('renders branch name and changes', async () => {
    const git = mockGit({
      isRepo: true,
      branch: 'feature/login',
      tracking: 'origin/feature/login',
      staged: [{ path: 'src/login.ts', status: 'M', staged: true }],
      unstaged: [{ path: 'README.md', status: 'M', staged: false }],
    })

    const { container } = renderScm(git)

    await waitFor(() => {
      expect(screen.getByText('feature/login')).toBeDefined()
      expect(container.querySelector('[data-scm-staged-file="src/login.ts"]')).toBeDefined()
      expect(container.querySelector('[data-scm-unstaged-file="README.md"]')).toBeDefined()
    })
  })

  it('handles non-git repo gracefully', async () => {
    const git = mockGit({
      isRepo: false,
      staged: [],
      unstaged: [],
    })

    renderScm(git)

    await waitFor(() => {
      expect(screen.getByText('当前工作区非 Git 仓库')).toBeDefined()
    })
  })

  it('performs commit with commit message', async () => {
    const git = mockGit({
      isRepo: true,
      branch: 'main',
      staged: [{ path: 'a.ts', status: 'M', staged: true }],
      unstaged: [],
    })

    const { container } = renderScm(git)

    await waitFor(() => {
      expect(container.querySelector('[data-scm-staged-file="a.ts"]')).toBeDefined()
    })

    const input = screen.getByPlaceholderText('输入提交信息 (Ctrl+Enter 提交)')
    fireEvent.change(input, { target: { value: 'fix: issue 1' } })

    const commitBtn = screen.getByText('提交 (Commit)')
    fireEvent.click(commitBtn)

    await waitFor(() => {
      expect(git.commit).toHaveBeenCalledWith('/workspace', 'fix: issue 1')
    })
  })

  it('triggers stage, unstage, and discard', async () => {
    const git = mockGit({
      isRepo: true,
      branch: 'main',
      staged: [{ path: 'staged.ts', status: 'M', staged: true }],
      unstaged: [{ path: 'unstaged.ts', status: 'M', staged: false }],
    })

    const { container } = renderScm(git)

    await waitFor(() => {
      expect(container.querySelector('[data-scm-staged-file="staged.ts"]')).toBeDefined()
      expect(container.querySelector('[data-scm-unstaged-file="unstaged.ts"]')).toBeDefined()
    })

    const unstageBtn = screen.getByTitle('取消暂存')
    fireEvent.click(unstageBtn)
    expect(git.unstage).toHaveBeenCalledWith('/workspace', ['staged.ts'])

    const stageBtn = screen.getByTitle('暂存更改')
    fireEvent.click(stageBtn)
    expect(git.stage).toHaveBeenCalledWith('/workspace', ['unstaged.ts'])

    const discardBtn = screen.getByTitle('放弃更改')
    fireEvent.click(discardBtn)
    expect(git.discard).toHaveBeenCalledWith('/workspace', ['unstaged.ts'])
  })

  it('opens diff in editor on change file click', async () => {
    const git = mockGit({
      isRepo: true,
      branch: 'main',
      staged: [{ path: 'file.ts', status: 'M', staged: true }],
      unstaged: [],
    })

    const { editor, container } = renderScm(git)

    await waitFor(() => {
      expect(container.querySelector('[data-scm-staged-file="file.ts"]')).toBeDefined()
    })

    const fileItem = container.querySelector('[data-scm-staged-file="file.ts"]')!
    fireEvent.click(fileItem)

    await waitFor(() => {
      expect(git.diff).toHaveBeenCalledWith('/workspace', 'file.ts', true)
      const tabs = editor.getSnapshot().groups[0]?.tabs
      expect(tabs?.[0]?.kind).toBe('diff')
      expect(tabs?.[0]?.originalContent).toBe('old content')
      expect(tabs?.[0]?.content).toBe('new content')
    })
  })
})
