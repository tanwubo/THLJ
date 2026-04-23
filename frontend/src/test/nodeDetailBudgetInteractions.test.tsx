import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Dialog, Toast } from 'antd-mobile'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NodeDetail from '../pages/NodeDetail/NodeDetail'
import TodoAttachmentSection from '../pages/NodeDetail/TodoAttachmentSection'
import TodoExpenseSection from '../pages/NodeDetail/TodoExpenseSection'
import { attachmentAPI, expenseAPI, timelineAPI, todoAPI } from '../services/api'
import type { NodeWorkbenchData, WorkbenchTodo } from '../pages/NodeDetail/types'

const mockEmitRealtimeEvent = vi.fn()
const refreshMock = vi.fn().mockResolvedValue(undefined)
const useNodeWorkbenchMock = vi.fn()

vi.mock('../hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: () => undefined,
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    partnerId: 2,
    emitRealtimeEvent: mockEmitRealtimeEvent,
  }),
}))

vi.mock('../pages/NodeDetail/useNodeWorkbench', () => ({
  useNodeWorkbench: (nodeId: number) => useNodeWorkbenchMock(nodeId),
}))

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    timelineAPI: {
      ...actual.timelineAPI,
      updateNode: vi.fn(),
      deleteNode: vi.fn(),
    },
    todoAPI: {
      ...actual.todoAPI,
      updateTodoStatus: vi.fn(),
      deleteTodo: vi.fn(),
      createTodo: vi.fn(),
      updateTodo: vi.fn(),
    },
    expenseAPI: {
      ...actual.expenseAPI,
      createExpense: vi.fn(),
      deleteExpense: vi.fn(),
    },
    attachmentAPI: {
      ...actual.attachmentAPI,
      deleteAttachment: vi.fn(),
      uploadAttachment: vi.fn(),
    },
  }
})

function buildTodo(overrides: Partial<WorkbenchTodo> = {}): WorkbenchTodo {
  return {
    id: 11,
    nodeId: 1,
    content: '确认酒店合同',
    status: 'pending',
    createdAt: '2026-04-22 10:00:00',
    expenses: [],
    attachments: [],
    ...overrides,
  }
}

function buildWorkbench(overrides: Partial<NodeWorkbenchData> = {}): NodeWorkbenchData {
  return {
    node: {
      id: 1,
      name: '确定结婚意向',
      description: '阶段说明',
      status: 'pending',
      order: 1,
      budget: 10000,
      deadline: '2026-05-01',
      progress: 10,
      createdAt: '2026-04-22 10:00:00',
      updatedAt: '2026-04-22 10:00:00',
      expenses: [],
      attachments: [],
    },
    todos: [
      buildTodo({
        expenses: [
          {
            id: 21,
            nodeId: 1,
            todoId: 11,
            type: 'expense',
            amount: 8500,
            category: '支出',
            createdAt: '2026-04-22 10:00:00',
          },
        ],
      }),
    ],
    memo: null,
    ...overrides,
  }
}

function renderNodeDetail() {
  render(
    <MemoryRouter initialEntries={['/node/1']}>
      <Routes>
        <Route path="/node/:id" element={<NodeDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('node detail budget interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useNodeWorkbenchMock.mockReturnValue({
      loading: false,
      refresh: refreshMock,
      data: buildWorkbench(),
    })
    vi.spyOn(Dialog, 'confirm').mockResolvedValue(true as never)
    vi.spyOn(Dialog, 'show').mockImplementation((config: any) => {
      config?.onClose?.()
    })
    vi.spyOn(Toast, 'show').mockImplementation(() => undefined)
    vi.mocked(timelineAPI.updateNode).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof timelineAPI.updateNode>>)
    vi.mocked(todoAPI.updateTodoStatus).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof todoAPI.updateTodoStatus>>)
    vi.mocked(expenseAPI.createExpense).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof expenseAPI.createExpense>>)
    vi.mocked(attachmentAPI.deleteAttachment).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof attachmentAPI.deleteAttachment>>)
  })

  it('enters budget inline edit mode with focused selected input and saves on enter', async () => {
    renderNodeDetail()

    fireEvent.click(screen.getByText('¥10000'))

    const input = screen.getByDisplayValue('10000') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(input.value.length)

    fireEvent.change(input, { target: { value: '12000' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(timelineAPI.updateNode).toHaveBeenCalledWith(1, { budget: 12000 })
    })
  })

  it('suppresses the blur follow-up after an enter-triggered budget save', async () => {
    renderNodeDetail()

    fireEvent.click(screen.getByText('¥10000'))
    const input = screen.getByDisplayValue('10000')
    fireEvent.change(input, { target: { value: '12000' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(timelineAPI.updateNode).toHaveBeenCalledTimes(1)
    })
    expect(timelineAPI.updateNode).toHaveBeenCalledWith(1, { budget: 12000 })
  })

  it('saves an empty budget input as zero and cancels inline budget editing with escape', async () => {
    renderNodeDetail()

    fireEvent.click(screen.getByText('¥10000'))
    const input = screen.getByDisplayValue('10000')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(timelineAPI.updateNode).not.toHaveBeenCalled()
    expect(screen.getByText('¥10000')).toBeInTheDocument()

    fireEvent.click(screen.getByText('¥10000'))
    const emptyInput = screen.getByDisplayValue('10000')
    fireEvent.change(emptyInput, { target: { value: '' } })
    fireEvent.blur(emptyInput)

    await waitFor(() => {
      expect(timelineAPI.updateNode).toHaveBeenCalledWith(1, { budget: 0 })
    })
  })

  it('shows the exact validation message when budget is not a valid non-negative number', async () => {
    renderNodeDetail()

    fireEvent.click(screen.getByText('¥10000'))
    const input = screen.getByDisplayValue('10000')
    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(Toast.show).toHaveBeenCalledWith('预算必须是大于等于 0 的数字')
    expect(timelineAPI.updateNode).not.toHaveBeenCalled()
  })

  it('accepts decimal budget input and renders it without distortion', async () => {
    renderNodeDetail()

    fireEvent.click(screen.getByText('¥10000'))
    const input = screen.getByDisplayValue('10000')
    expect(input).toHaveAttribute('inputmode', 'decimal')
    fireEvent.change(input, { target: { value: '123.45' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(timelineAPI.updateNode).toHaveBeenCalledWith(1, { budget: 123.45 })
    })
    expect(Toast.show).not.toHaveBeenCalledWith('预算必须是大于等于 0 的数字')
  })

  it('highlights total expense when spending exceeds eighty percent of budget', async () => {
    renderNodeDetail()

    const totalExpense = screen.getByTestId('node-total-expense')
    expect(totalExpense).toHaveClass('stats-metric-card--warning')
  })

  it('prompts to complete the node when the last unfinished todo is marked done', async () => {
    useNodeWorkbenchMock.mockReturnValue({
      loading: false,
      refresh: refreshMock,
      data: buildWorkbench({
        todos: [
          buildTodo({
            status: 'pending',
            expenses: [],
          }),
        ],
      }),
    })

    renderNodeDetail()

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(todoAPI.updateTodoStatus).toHaveBeenCalledWith(11, 'completed')
    })
    expect(Dialog.show).toHaveBeenCalled()
    const dialogConfig = vi.mocked(Dialog.show).mock.calls[0][0]
    expect(dialogConfig.actions?.[0].text).toBe('确定')
    expect(dialogConfig.actions?.[1].text).toBe('取消')
    dialogConfig.actions?.[0].onClick?.()
    await waitFor(() => {
      expect(timelineAPI.updateNode).toHaveBeenCalledWith(1, { status: 'completed' })
    })
  })

  it('does not complete node when user clicks cancel in the confirmation dialog', async () => {
    useNodeWorkbenchMock.mockReturnValue({
      loading: false,
      refresh: refreshMock,
      data: buildWorkbench({
        todos: [
          buildTodo({
            status: 'pending',
            expenses: [],
          }),
        ],
      }),
    })

    renderNodeDetail()

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(todoAPI.updateTodoStatus).toHaveBeenCalledWith(11, 'completed')
    })
    expect(Dialog.show).toHaveBeenCalled()
    const dialogConfig = vi.mocked(Dialog.show).mock.calls[0][0]
    dialogConfig.actions?.[1].onClick?.()
    expect(timelineAPI.updateNode).not.toHaveBeenCalled()
  })

  it('refreshes the todo state even when the follow-up node completion update fails', async () => {
    useNodeWorkbenchMock.mockReturnValue({
      loading: false,
      refresh: refreshMock,
      data: buildWorkbench({
        todos: [
          buildTodo({
            status: 'pending',
            expenses: [],
          }),
        ],
      }),
    })
    vi.mocked(timelineAPI.updateNode).mockRejectedValueOnce({
      response: { data: { error: '节点状态更新失败' } },
    } as never)

    renderNodeDetail()

    fireEvent.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(todoAPI.updateTodoStatus).toHaveBeenCalledWith(11, 'completed')
    })
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled()
    })
  })

  it('does not show a failure toast when todo delete confirmation is cancelled', async () => {
    vi.spyOn(Dialog, 'confirm').mockRejectedValueOnce(new Error('cancelled'))

    renderNodeDetail()

    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(todoAPI.deleteTodo).not.toHaveBeenCalled()
    })
    expect(Toast.show).not.toHaveBeenCalledWith('删除失败')
  })

  it('does not show a failure toast when node delete confirmation is cancelled', async () => {
    vi.spyOn(Dialog, 'confirm').mockRejectedValueOnce(new Error('cancelled'))

    renderNodeDetail()

    fireEvent.click(screen.getByRole('button', { name: '删除节点' }))

    await waitFor(() => {
      expect(timelineAPI.deleteNode).not.toHaveBeenCalled()
    })
    expect(Toast.show).not.toHaveBeenCalledWith('删除失败')
  })
})

describe('todo expense section interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Toast, 'show').mockImplementation(() => undefined)
    vi.mocked(expenseAPI.createExpense).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof expenseAPI.createExpense>>)
  })

  it('shows only a type toggle and amount field in the add expense popup', async () => {
    render(
      <TodoExpenseSection
        todo={buildTodo()}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '添加该待办费用' }))

    expect(await screen.findByPlaceholderText('金额')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('分类')).toBeNull()
    expect(screen.queryByPlaceholderText('描述（可选）')).toBeNull()
  })

  it('requires a finite amount greater than zero before saving an expense', async () => {
    render(
      <TodoExpenseSection
        todo={buildTodo()}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '添加该待办费用' }))
    fireEvent.change(await screen.findByPlaceholderText('金额'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    expect(expenseAPI.createExpense).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('金额'), { target: { value: '88.5' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(expenseAPI.createExpense).toHaveBeenCalledWith({
        todoId: 11,
        type: 'expense',
        amount: 88.5,
      })
    })
  })

  it('does not show a failure toast when expense delete confirmation is cancelled', async () => {
    vi.spyOn(Dialog, 'confirm').mockRejectedValueOnce(new Error('cancelled'))

    render(
      <TodoExpenseSection
        todo={buildTodo({
          expenses: [
            {
              id: 21,
              nodeId: 1,
              todoId: 11,
              type: 'expense',
              amount: 88,
              category: '支出',
              createdAt: '2026-04-22 10:00:00',
            },
          ],
        })}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(expenseAPI.deleteExpense).not.toHaveBeenCalled()
    })
    expect(Toast.show).not.toHaveBeenCalledWith('删除失败')
  })
})

describe('todo attachment section interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Dialog, 'confirm').mockResolvedValue(true as never)
    vi.spyOn(Toast, 'show').mockImplementation(() => undefined)
    vi.mocked(attachmentAPI.deleteAttachment).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof attachmentAPI.deleteAttachment>>)
  })

  it('opens a larger preview for image attachments', async () => {
    render(
      <TodoAttachmentSection
        todo={buildTodo({
          attachments: [
            {
              id: 31,
              nodeId: 1,
              todoId: 11,
              fileName: '现场图.jpg',
              filePath: '/uploads/photo.jpg',
              fileSize: 1024,
              fileType: 'image/jpeg',
              createdAt: '2026-04-22 10:00:00',
            },
          ],
        })}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '预览附件 现场图.jpg' }))

    expect(await screen.findByRole('img', { name: '现场图.jpg' })).toBeInTheDocument()
  })

  it('downloads non-image attachments and does not trigger download when deleting', async () => {
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
      <TodoAttachmentSection
        todo={buildTodo({
          attachments: [
            {
              id: 32,
              nodeId: 1,
              todoId: 11,
              fileName: '报价单.pdf',
              filePath: '/uploads/quote.pdf',
              fileSize: 2048,
              fileType: 'application/pdf',
              createdAt: '2026-04-22 10:00:00',
            },
          ],
        })}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '下载附件 报价单.pdf' }))

    expect(clickMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(attachmentAPI.deleteAttachment).toHaveBeenCalledWith(32)
    })
    expect(clickMock).toHaveBeenCalledTimes(1)
  })

  it('keeps open and delete as sibling controls instead of nesting buttons', async () => {
    render(
      <TodoAttachmentSection
        todo={buildTodo({
          attachments: [
            {
              id: 32,
              nodeId: 1,
              todoId: 11,
              fileName: '报价单.pdf',
              filePath: '/uploads/quote.pdf',
              fileSize: 2048,
              fileType: 'application/pdf',
              createdAt: '2026-04-22 10:00:00',
            },
          ],
        })}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    const downloadButton = screen.getByRole('button', { name: '下载附件 报价单.pdf' })
    const deleteButton = screen.getByRole('button', { name: '删除' })

    expect(downloadButton.contains(deleteButton)).toBe(false)
    expect(deleteButton.contains(downloadButton)).toBe(false)
  })

  it('does not show a failure toast when attachment delete confirmation is cancelled', async () => {
    vi.spyOn(Dialog, 'confirm').mockRejectedValueOnce(new Error('cancelled'))

    render(
      <TodoAttachmentSection
        todo={buildTodo({
          attachments: [
            {
              id: 32,
              nodeId: 1,
              todoId: 11,
              fileName: '报价单.pdf',
              filePath: '/uploads/quote.pdf',
              fileSize: 2048,
              fileType: 'application/pdf',
              createdAt: '2026-04-22 10:00:00',
            },
          ],
        })}
        expanded
        onToggle={vi.fn()}
        onRefresh={refreshMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(attachmentAPI.deleteAttachment).not.toHaveBeenCalled()
    })
    expect(Toast.show).not.toHaveBeenCalledWith('删除失败')
  })
})
