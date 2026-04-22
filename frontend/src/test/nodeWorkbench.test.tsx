import { act, renderHook, waitFor } from '@testing-library/react'
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
          description: undefined,
          status: 'pending',
          order: 1,
          budget: 88000,
          expenses: [
            {
              id: 51,
              nodeId: 1,
              type: 'expense',
              amount: 1314,
              category: '旧版节点支出',
              createdAt: '2026-04-20 09:00:00',
            },
          ],
          attachments: [
            {
              id: 61,
              nodeId: 1,
              fileName: '旧版报价单.pdf',
              filePath: '/uploads/legacy-quote.pdf',
              fileSize: 4096,
              fileType: 'application/pdf',
              createdAt: '2026-04-20 09:00:00',
            },
          ],
          deadline: undefined,
          progress: 0,
          createdAt: '2026-04-21 10:00:00',
          updatedAt: '2026-04-21 10:00:00',
        },
        todos: [
          {
            id: 11,
            nodeId: 1,
            content: '沟通彩礼金额',
            status: 'pending',
            assigneeName: undefined,
            deadline: '2026-05-01',
            createdAt: '2026-04-21 10:00:00',
            expenses: [
              {
                id: 21,
                nodeId: 1,
                todoId: 11,
                type: 'expense',
                amount: 5200,
                category: '彩礼',
                createdAt: '2026-04-21 10:00:00',
              },
            ],
            attachments: [
              {
                id: 31,
                nodeId: 1,
                todoId: 11,
                fileName: '报价单.pdf',
                filePath: '/uploads/quote.pdf',
                fileSize: 2048,
                fileType: 'application/pdf',
                createdAt: '2026-04-21 10:00:00',
              },
            ],
          },
        ],
        memo: {
          id: 41,
          nodeId: 1,
          content: 'memo',
          updatedAt: '2026-04-21 10:00:00',
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
      budget: 88000,
      createdAt: '2026-04-21 10:00:00',
    })
    expect(result.current.data?.node.expenses[0]).toMatchObject({
      id: 51,
      nodeId: 1,
      amount: 1314,
      category: '旧版节点支出',
    })
    expect(result.current.data?.node.attachments[0]).toMatchObject({
      id: 61,
      nodeId: 1,
      fileName: '旧版报价单.pdf',
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

  it('ignores stale out-of-order workbench responses and keeps the newest result', async () => {
    const getWorkbenchMock = vi.mocked(timelineAPI.getWorkbench)

    let resolveInitial!: (value: Awaited<ReturnType<typeof timelineAPI.getWorkbench>>) => void
    let resolveRefreshOne!: (value: Awaited<ReturnType<typeof timelineAPI.getWorkbench>>) => void
    let resolveRefreshTwo!: (value: Awaited<ReturnType<typeof timelineAPI.getWorkbench>>) => void

    getWorkbenchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInitial = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefreshOne = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefreshTwo = resolve
          }),
      )

    const { result } = renderHook(() => useNodeWorkbench(1))

    await waitFor(() => {
      expect(getWorkbenchMock).toHaveBeenCalledTimes(1)
    })

    let firstRefreshPromise!: Promise<unknown>
    let secondRefreshPromise!: Promise<unknown>
    await act(async () => {
      firstRefreshPromise = result.current.refresh()
      secondRefreshPromise = result.current.refresh()
    })

    await waitFor(() => {
      expect(getWorkbenchMock).toHaveBeenCalledTimes(3)
    })

    await act(async () => {
      resolveRefreshTwo({
        data: {
          node: {
            id: 1,
            name: '最新返回',
            status: 'in_progress',
            order: 1,
            budget: 20000,
            expenses: [],
            attachments: [],
            progress: 0,
            createdAt: '2026-04-22 10:00:00',
            updatedAt: '2026-04-22 10:00:00',
          },
          todos: [],
          memo: null,
        },
      } as Awaited<ReturnType<typeof timelineAPI.getWorkbench>>)
    })

    await waitFor(() => {
      expect(result.current.data?.node.name).toBe('最新返回')
    })

    await act(async () => {
      resolveInitial({
        data: {
          node: {
            id: 1,
            name: '过期初始返回',
            status: 'pending',
            order: 1,
            budget: 10000,
            expenses: [],
            attachments: [],
            progress: 0,
            createdAt: '2026-04-20 10:00:00',
            updatedAt: '2026-04-20 10:00:00',
          },
          todos: [],
          memo: null,
        },
      } as Awaited<ReturnType<typeof timelineAPI.getWorkbench>>)

      resolveRefreshOne({
        data: {
          node: {
            id: 1,
            name: '过期刷新返回',
            status: 'pending',
            order: 1,
            budget: 15000,
            expenses: [],
            attachments: [],
            progress: 0,
            createdAt: '2026-04-21 10:00:00',
            updatedAt: '2026-04-21 10:00:00',
          },
          todos: [],
          memo: null,
        },
      } as Awaited<ReturnType<typeof timelineAPI.getWorkbench>>)

      await Promise.all([firstRefreshPromise, secondRefreshPromise])
    })

    expect(result.current.data?.node.name).toBe('最新返回')
    expect(result.current.data?.node.budget).toBe(20000)
    expect(result.current.loading).toBe(false)
  })
})
