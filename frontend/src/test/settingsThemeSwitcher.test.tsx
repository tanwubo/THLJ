import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../pages/Settings/Settings'
import { useAuthStore } from '../store/authStore'
import { ThemeProvider } from '../theme/ThemeProvider'

describe('Settings theme switcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.removeAttribute('data-theme')
    useAuthStore.setState({
      token: 'token',
      user: {
        id: 1,
        username: 'alice',
        inviteCode: 'ABCD12',
        partnerId: null,
        createdAt: '2026-01-01',
        lastLogin: '2026-01-01',
      } as any,
      partnerId: null,
      _hasHydrated: true,
    })
  })

  it('allows switching to champagne-light from the settings screen', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /奶油香槟/ }))

    expect(document.documentElement.dataset.theme).toBe('champagne-light')
  })
})
