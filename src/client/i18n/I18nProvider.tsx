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

const STORAGE_KEY = 'dsh.workbench.language'

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY)
    return stored === 'zh-CN' || stored === 'en' ? stored : 'en'
  })

  const setLocale = useCallback((next: Locale): void => {
    setLocaleState(next)
    globalThis.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback((id: MessageId, params?: Record<string, string | number>): string => {
    let text = TABLES[locale][id] ?? TABLES.en[id] ?? id
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

const fallbackT = (id: MessageId, params?: Record<string, string | number>): string => {
  let text = zhCN[id] ?? en[id] ?? id
  if (params !== undefined) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'gu'), String(value))
    }
  }
  return text
}

const FALLBACK_VALUE: I18nContextValue = {
  locale: 'zh-CN',
  t: fallbackT,
  setLocale: () => {},
}

export function useT(): I18nContextValue {
  const value = useContext(I18nContext)
  return value ?? FALLBACK_VALUE
}
