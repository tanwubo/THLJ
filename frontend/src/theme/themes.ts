export const THEME_STORAGE_KEY = 'wedding-manager-theme'

export const themeOrder = ['ceremony-red', 'champagne-light'] as const

export type ThemeName = (typeof themeOrder)[number]

export type ThemeDefinition = {
  label: string
  description: string
  preview: {
    hero: string
    surface: string
    accent: string
  }
}

export const themes: Record<ThemeName, ThemeDefinition> = {
  'ceremony-red': {
    label: '雅红金',
    description: '中式雅致、酒红主调、克制金色强调',
    preview: {
      hero: '#6f1022',
      surface: '#fff9f2',
      accent: '#c8a062',
    },
  },
  'champagne-light': {
    label: '奶油香槟',
    description: '轻盈暖白、香槟金、柔和玫瑰色点缀',
    preview: {
      hero: '#e9dccb',
      surface: '#fffdf9',
      accent: '#b78b5d',
    },
  },
}

export function isThemeName(value: string | null): value is ThemeName {
  return value !== null && value in themes
}
