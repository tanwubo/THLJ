import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { timelineAPI } from '../services/api'
import { useNodeWorkbench } from '../pages/NodeDetail/useNodeWorkbench'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    timelineAPI: {
      ...actual.timelineAPI,
      getWorkbench: vi.fn(),
    },
  }
})

describe('node workbench hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads node workbench data from one aggregated request', async () => {
    const getWorkbenchMock = vi.mocked(timelineAPI.getWorkbench)
    getWorkbenchMock.mockResolvedValue({
      data: {
        node: {
          id: 1,
          name: '确定结婚意向',
          description: null,
          status: 'pending',
          order: 1,
          deadline: null,
          created_at: '2026-04-21 10:00:00',
          updated_at: '2026-04-21 10:00:00',
        },
        todos: [
          {
            id: 11,
            node_id: 1,
            content: '沟通彩礼金额',
            status: 'pending',
            assignee_name: null,
            deadline: '2026-05-01',
            created_at: '2026-04-21 10:00:00',
            expenses: [
              {
                id: 21,
                node_id: 1,
                todo_id: 11,
                type: 'expense',
                amount: 5200,
                category: '彩礼',
                created_at: '2026-04-21 10:00:00',
              },
            ],
            attachments: [
              {
                id: 31,
                node_id: 1,
                todo_id: 11,
                file_name: '报价单.pdf',
                file_path: '/uploads/quote.pdf',
                file_size: 2048,
                file_type: 'application/pdf',
                created_at: '2026-04-21 10:00:00',
              },
            ],
          },
        ],
        memo: {
          id: 41,
          node_id: 1,
          content: 'memo',
          updated_at: '2026-04-21 10:00:00',
        },
      },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getWorkbench>>)

    const { result } = renderHook(() => useNodeWorkbench(1))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(getWorkbenchMock).toHaveBeenCalledTimes(1)
    expect(getWorkbenchMock).toHaveBeenCalledWith(1)
    expect(result.current.data?.node).toMatchObject({
      id: 1,
      name: '确定结婚意向',
      status: 'pending',
      order: 1,
      createdAt: '2026-04-21 10:00:00',
    })
    expect(result.current.data?.todos[0]).toMatchObject({
      id: 11,
      nodeId: 1,
      content: '沟通彩礼金额',
      deadline: '2026-05-01',
    })
    expect(result.current.data?.todos[0].expenses[0]).toMatchObject({
      id: 21,
      todoId: 11,
      amount: 5200,
    })
    expect(result.current.data?.todos[0].attachments[0]).toMatchObject({
      id: 31,
      todoId: 11,
      fileName: '报价单.pdf',
    })
    expect(result.current.data?.memo).toEqual({
      id: 41,
      nodeId: 1,
      content: 'memo',
      updatedAt: '2026-04-21 10:00:00',
    })
  })
})
