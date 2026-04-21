import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Timeline from '../pages/Timeline/Timeline'
import { timelineAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    timelineAPI: {
      ...actual.timelineAPI,
      getTimeline: vi.fn(),
      createNode: vi.fn(),
    },
  }
})

describe('Timeline redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      token: 'token',
      user: { id: 1, username: 'alice', inviteCode: 'ABC123', partnerId: null } as any,
      partnerId: null,
      _hasHydrated: true,
    })
    vi.mocked(timelineAPI.getTimeline).mockResolvedValue({ data: { nodes: [] } } as any)
  })

  it('keeps the create-node flow reachable from the redesigned page', async () => {
    render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    )

    await screen.findByText('还没有任何节点')
    expect(screen.getByRole('heading', { name: '婚礼时间线' })).toBeInTheDocument()
    expect(screen.queryByText('💒 婚嫁管家')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '创建第一个节点' }))

    await waitFor(() => {
      expect(screen.getByText('创建新节点')).toBeInTheDocument()
    })
  })
})
