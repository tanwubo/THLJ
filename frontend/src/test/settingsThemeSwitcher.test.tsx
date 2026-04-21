import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../pages/Settings/Settings'
import { useAuthStore } from '../store/authStore'
import { ThemeProvider } from '../theme/ThemeProvider'
import { Dialog } from 'antd-mobile'

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
      bindPartner: vi.fn(),
      unbindPartner: vi.fn(),
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

  it('shows a persistent hint explaining whose invite code to use', () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(
      screen.getByText('想保留谁当前的筹备数据，就输入谁的邀请码进行绑定。'),
    ).toBeInTheDocument()
  })

  it('shows the explicit shared-data warning when confirming partner binding', () => {
    const dialogConfirmSpy = vi.spyOn(Dialog, 'confirm').mockImplementation(async () => true)

    render(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /绑定情侣账号/ }))
    fireEvent.change(screen.getByPlaceholderText('输入邀请码'), { target: { value: '459448' } })
    fireEvent.click(screen.getByRole('button', { name: /确认绑定/ }))

    expect(dialogConfirmSpy).toHaveBeenCalled()
    expect(dialogConfirmSpy.mock.calls[0][0]).toMatchObject({
      content:
        '绑定后，双方将共用同一份筹备数据。当前版本中，输入谁的邀请码，就会保留谁当前的数据作为绑定后的共享数据；另一方当前数据不会自动合并。确定继续绑定吗？',
      confirmText: '确定绑定',
    })
  })

  it('uses the auth store unbind action from the settings screen', async () => {
    const unbindPartner = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'alice',
        inviteCode: 'ABCD12',
        partnerId: 2,
        partner: { id: 2, username: 'bob' },
        createdAt: '2026-01-01',
        lastLogin: '2026-01-01',
      } as any,
      partnerId: 2,
      unbindPartner,
    })

    const dialogConfirmSpy = vi.spyOn(Dialog, 'confirm').mockImplementation(async (config: any) => {
      await config.onConfirm?.()
      return true
    })

    render(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(
      screen.getByText('想保留谁当前的筹备数据，就输入谁的邀请码进行绑定。'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /解除绑定/ }))

    expect(dialogConfirmSpy).toHaveBeenCalledTimes(1)
    expect(unbindPartner).toHaveBeenCalledTimes(1)
  })

  it('shows the timeline template management entry for admins only', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        username: 'alice',
        inviteCode: 'ABCD12',
        isAdmin: true,
        partnerId: null,
        createdAt: '2026-01-01',
        lastLogin: '2026-01-01',
      } as any,
    })

    render(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('link', { name: '时间线模板管理' })).toBeInTheDocument()
  })
})
