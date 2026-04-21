import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { isThemeName, THEME_STORAGE_KEY, themeOrder, type ThemeName } from './themes'

type ThemeContextValue = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  availableThemes: typeof themeOrder
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): ThemeName {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeName(stored) ? stored : 'ceremony-red'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      availableThemes: themeOrder,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return value
}
