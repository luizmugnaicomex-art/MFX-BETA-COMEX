import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppLanguage,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  TranslationDict,
  fmt,
} from './translations';

const LS_LANG_KEY = 'mfx_comex_lang_v1';

function readInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(LS_LANG_KEY);
    if (saved === 'en' || saved === 'pt' || saved === 'it') {
      return saved;
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return 'en';
}

interface I18nContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  tr: TranslationDict;
  fmt: typeof fmt;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  tr: TRANSLATIONS.en,
  fmt,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<AppLanguage>(readInitialLanguage);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LANG_KEY, lang);
    } catch {
      // Ignore storage write errors
    }
    const meta = LANGUAGE_OPTIONS.find((opt) => opt.code === lang);
    if (meta) {
      document.documentElement.lang = meta.htmlLang;
    }
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      tr: TRANSLATIONS[lang],
      fmt,
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
