import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider'
import { useTheme } from '../theme/useTheme'

function ThemeProbe() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={() => setTheme('champagne-light')}>
        switch
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to ceremony-red and writes the root dataset', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('ceremony-red')
    expect(document.documentElement.dataset.theme).toBe('ceremony-red')
  })

  it('hydrates the persisted theme and updates localStorage on change', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('champagne-light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('champagne-light')

    fireEvent.click(screen.getByRole('button', { name: 'switch' }))
    expect(window.localStorage.setItem).toHaveBeenCalledWith('wedding-manager-theme', 'champagne-light')
  })
})
