import { fireEvent, render, screen, within } from '@testing-library/react'
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
        budget: 60000,
        expenses: [
          {
            id: 71,
            nodeId: 1,
            todoId: 0,
            type: 'expense',
            amount: 5200,
            category: '旧版节点支出',
            createdAt: '2026-04-22 09:00:00',
          },
        ],
        attachments: [
          {
            id: 81,
            nodeId: 1,
            todoId: 0,
            fileName: '旧版合同.pdf',
            filePath: '/uploads/legacy-contract.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
            createdAt: '2026-04-22 09:00:00',
          },
        ],
      },
      todos: [
        {
          id: 11,
          nodeId: 1,
          content: '确认预算',
          status: 'completed',
          createdAt: '2026-04-22 10:00:00',
          expenses: [
            {
              id: 21,
              nodeId: 1,
              todoId: 11,
              type: 'expense',
              amount: 12000,
              category: '支出',
              createdAt: '2026-04-22 10:00:00',
            },
            {
              id: 22,
              nodeId: 1,
              todoId: 11,
              type: 'income',
              amount: 8000,
              category: '收入',
              createdAt: '2026-04-22 10:00:00',
            },
          ],
          attachments: [],
        },
      ],
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

  it('shows only budget, total expense, and total income in the summary', async () => {
    render(
      <MemoryRouter initialEntries={['/node/1']}>
        <Routes>
          <Route path="/node/:id" element={<NodeDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const summary = screen.getByText('预算').closest('.node-summary-grid')

    expect(summary).not.toBeNull()
    expect(within(summary as HTMLElement).getByText('预算')).toBeInTheDocument()
    expect(within(summary as HTMLElement).getByText('总支出')).toBeInTheDocument()
    expect(within(summary as HTMLElement).getByText('总收入')).toBeInTheDocument()
    expect(within(summary as HTMLElement).queryByText('结余')).not.toBeInTheDocument()
    expect(within(summary as HTMLElement).queryByText('待办')).not.toBeInTheDocument()
    expect(within(summary as HTMLElement).queryByText('已完成')).not.toBeInTheDocument()
  })

  it('shows legacy node-level expenses and attachments for compatibility', async () => {
    render(
      <MemoryRouter initialEntries={['/node/1']}>
        <Routes>
          <Route path="/node/:id" element={<NodeDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('兼容旧版节点记录')).toBeInTheDocument()
    expect(screen.getByText('旧版节点支出')).toBeInTheDocument()
    expect(screen.getByText('旧版合同.pdf')).toBeInTheDocument()
  })

  it('lets users open legacy node-level attachments from the compatibility section', async () => {
    const clickMock = vi.fn()
    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy.mockImplementation(((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { value: clickMock })
      }
      return element
    }) as typeof document.createElement)

    render(
      <MemoryRouter initialEntries={['/node/1']}>
        <Routes>
          <Route path="/node/:id" element={<NodeDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '下载附件 旧版合同.pdf' }))

    expect(clickMock).toHaveBeenCalledTimes(1)
  })
})
