/**
 * Settings view: the sidebar's settings activity panel. Two switches — theme
 * (dark / light) and minimap (on / off) — persisted to localStorage through the
 * settings store. The view itself is read-only state; the shell wires the
 * minimap toggle into the editor area render.
 */

import { useState } from 'react'
import type { ThemePreference } from '../../settings/store.ts'
import { readMinimap, readTheme, writeTheme } from '../../settings/store.ts'
import type { SessionListState } from '@deepseek-ai/dsh-client-runtime/client'
import { IconSettingsGear } from '../../theme/codicons.tsx'
import { useWorkbench } from '../editor-context.ts'
import { useT } from '../../i18n/I18nProvider.tsx'
import type { Locale } from '../../i18n/I18nProvider.tsx'

/** Props the sidebar entry receives (owner props only; the shell passes useSessions). */
export interface SettingsViewProps {
  readonly useSessions: (selector: (state: SessionListState) => unknown) => unknown
}

/** The settings view body. */
export function SettingsView({ useSessions }: SettingsViewProps) {
  const services = useWorkbench()
  const { t, locale, setLocale } = useT()
  const [theme, setTheme] = useState<ThemePreference>(() => readTheme(globalThis.localStorage))
  const [minimap, setMinimap] = useState<boolean>(() => readMinimap(globalThis.localStorage))

  const applyTheme = (next: ThemePreference): void => {
    setTheme(next)
    services.setTheme?.(next)
  }

  const applyMinimap = (next: boolean): void => {
    setMinimap(next)
    services.panelActions?.toggleMinimap?.()
  }

  const applyLocale = (next: Locale): void => {
    setLocale(next)
  }

  return (
    <div className="dsh-wb-settings" data-settings-view>
      <div className="dsh-wb-viewheader" data-settings-header>
        <span className="dsh-wb-viewheader-title">{t('settings.title')}</span>
      </div>
      <div className="dsh-wb-settings-body">
        <div className="dsh-wb-settings-section" data-settings-section="theme">
          <div className="dsh-wb-settings-label" data-settings-label="theme">{t('settings.theme.label')}</div>
          <div className="dsh-wb-settings-options" data-settings-options="theme">
            {(['dark', 'light'] as ThemePreference[]).map(option => (
              <button
                key={option}
                type="button"
                className={`dsh-wb-settings-option${theme === option ? ' dsh-wb-settings-option-active' : ''}`}
                aria-pressed={theme === option}
                onClick={() => { applyTheme(option) }}
                data-settings-theme={option}
              >
                {option === 'dark' ? t('settings.theme.dark') : t('settings.theme.light')}
              </button>
            ))}
          </div>
        </div>
        <div className="dsh-wb-settings-section" data-settings-section="minimap">
          <div className="dsh-wb-settings-label" data-settings-label="minimap">{t('settings.minimap.label')}</div>
          <div className="dsh-wb-settings-options" data-settings-options="minimap">
            <button
              type="button"
              className={`dsh-wb-settings-option${minimap ? ' dsh-wb-settings-option-active' : ''}`}
              aria-pressed={minimap}
              onClick={() => { applyMinimap(!minimap) }}
              data-settings-minimap-toggle
            >
              {minimap ? t('settings.minimap.on') : t('settings.minimap.off')}
            </button>
          </div>
        </div>
        <div className="dsh-wb-settings-section" data-settings-section="language">
          <div className="dsh-wb-settings-label" data-settings-label="language">{t('settings.language.label')}</div>
          <div className="dsh-wb-settings-options" data-settings-options="language">
            {(['zh-CN', 'en'] as Locale[]).map(option => (
              <button
                key={option}
                type="button"
                className={`dsh-wb-settings-option${locale === option ? ' dsh-wb-settings-option-active' : ''}`}
                aria-pressed={locale === option}
                onClick={() => { applyLocale(option) }}
                data-settings-locale={option}
              >
                {option === 'zh-CN' ? t('settings.language.zhCN') : t('settings.language.en')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
