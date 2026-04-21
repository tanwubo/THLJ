import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NodeDetail from '../pages/NodeDetail/NodeDetail'

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    partnerId: 2,
    emitRealtimeEvent: vi.fn(),
  }),
}))

vi.mock('../hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: () => undefined,
}))

vi.mock('../pages/NodeDetail/useNodeWorkbench', () => ({
  useNodeWorkbench: () => ({
    loading: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    data: {
      node: {
        id: 1,
        name: '确定结婚意向',
        description: '双方家庭沟通订婚方向',
        status: 'pending',
      },
      todos: [],
      memo: {
        content: 'memo',
      },
    },
  }),
}))

describe('NodeDetail themed layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the redesigned node workbook header', async () => {
    render(
      <MemoryRouter initialEntries={['/node/1']}>
        <Routes>
          <Route path="/node/:id" element={<NodeDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '确定结婚意向' })).toBeInTheDocument()
    expect(screen.getByText('Node Workbook')).toBeInTheDocument()
    expect(screen.queryByText('← 返回')).not.toBeInTheDocument()
  })
})
