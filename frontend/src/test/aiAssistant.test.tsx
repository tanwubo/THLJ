import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiParseCommandResponse } from '../services/api'
import { aiAPI, expenseAPI, timelineAPI, todoAPI } from '../services/api'
import AIAssistantFloatingEntry from '../components/ai/AIAssistantFloatingEntry'
import { confirmAiDraft } from '../components/ai/aiDraftActions'

const mocks = vi.hoisted(() => ({
  parseCommand: vi.fn(),
  createNode: vi.fn(),
  createTodo: vi.fn(),
  createExpense: vi.fn(),
  emitRealtimeEvent: vi.fn(),
}))

vi.mock('../services/api', () => ({
  aiAPI: {
    parseCommand: mocks.parseCommand,
  },
  timelineAPI: {
    createNode: mocks.createNode,
  },
  todoAPI: {
    createTodo: mocks.createTodo,
  },
  expenseAPI: {
    createExpense: mocks.createExpense,
  },
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    emitRealtimeEvent: mocks.emitRealtimeEvent,
  }),
}))

function renderAssistant(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AIAssistantFloatingEntry />} />
        <Route path="/node/:id" element={<AIAssistantFloatingEntry />} />
        <Route path="/statistics" element={<AIAssistantFloatingEntry />} />
        <Route path="/settings/*" element={<AIAssistantFloatingEntry />} />
      </Routes>
    </MemoryRouter>
  )
}

async function openAssistant() {
  const entry = screen.getByRole('button', { name: /AI 对话入口/ })
  expect(entry).toHaveClass('ai-floating-entry')
  fireEvent.click(entry)
  expect(await screen.findByRole('dialog', { name: '一句话添加节点/待办/费用' })).toBeInTheDocument()
  expect(screen.getByText(/AI 会先生成草稿/)).toBeInTheDocument()
  return screen.getByLabelText('请输入要解析的 AI 指令') as HTMLTextAreaElement
}

describe('AIAssistantFloatingEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createNode.mockResolvedValue({})
    mocks.createTodo.mockResolvedValue({})
    mocks.createExpense.mockResolvedValue({})
  })

  it('opens an accessible drawer from a circular floating button', async () => {
    renderAssistant()

    const textarea = await openAssistant()

    expect(textarea).toBeInTheDocument()
  })

  it('confirms a ready create-node parse result', async () => {
    mocks.parseCommand.mockResolvedValue({
      data: {
        status: 'ready',
        draft: {
          actionType: 'create_node',
          fields: { name: '拍婚纱照', deadline: '2026-10-01' },
        },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      } satisfies AiParseCommandResponse,
    })
    renderAssistant()
    const textarea = await openAssistant()

    fireEvent.change(textarea, { target: { value: '增加一个10月1日拍婚纱照的节点' } })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))
    expect(await screen.findByText('将新增节点：拍婚纱照，截止 2026-10-01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }))

    await waitFor(() => {
      expect(timelineAPI.createNode).toHaveBeenCalledWith({
        name: '拍婚纱照',
        deadline: '2026-10-01',
      })
    })
    expect(await screen.findByText('创建成功')).toBeInTheDocument()
  })

  it('selects a candidate node before confirming a todo draft', async () => {
    mocks.parseCommand.mockResolvedValue({
      data: {
        status: 'needs_input',
        draft: {
          actionType: 'create_todo',
          fields: { content: '确认菜单' },
        },
        summary: '请选择要添加待办的节点',
        missingFields: ['nodeId'],
        candidates: { nodes: [{ id: 13, name: '婚宴' }] },
      } satisfies AiParseCommandResponse,
    })
    renderAssistant()
    const textarea = await openAssistant()

    fireEvent.change(textarea, { target: { value: '婚宴增加确认菜单待办' } })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))
    fireEvent.click(await screen.findByRole('button', { name: '选择 婚宴' }))
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }))

    await waitFor(() => {
      expect(todoAPI.createTodo).toHaveBeenCalledWith({
        nodeId: 13,
        content: '确认菜单',
        deadline: undefined,
      })
    })
  })

  it('keeps an expense draft incomplete after selecting only a candidate node', async () => {
    mocks.parseCommand.mockResolvedValue({
      data: {
        status: 'needs_input',
        draft: {
          actionType: 'create_expense',
          fields: { type: 'expense', amount: 3000, category: '婚纱摄影' },
        },
        summary: '请选择要记录费用的待办',
        missingFields: ['todoId'],
        candidates: { nodes: [{ id: 13, name: '婚宴' }] },
      } satisfies AiParseCommandResponse,
    })
    renderAssistant()
    const textarea = await openAssistant()

    fireEvent.change(textarea, { target: { value: '婚宴记录摄影费用3000' } })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))
    fireEvent.click(await screen.findByRole('button', { name: '选择 婚宴' }))

    const confirmButton = screen.getByRole('button', { name: '确认添加' })
    expect(confirmButton).toBeDisabled()
    fireEvent.click(confirmButton)
    expect(expenseAPI.createExpense).not.toHaveBeenCalled()
  })

  it('sends node detail page context when opened on a node route', async () => {
    mocks.parseCommand.mockResolvedValue({
      data: {
        status: 'unsupported',
        draft: null,
        summary: '暂不支持',
        missingFields: [],
        candidates: {},
      } satisfies AiParseCommandResponse,
    })
    renderAssistant('/node/18')
    const textarea = await openAssistant()

    fireEvent.change(textarea, { target: { value: '添加待办' } })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))

    await waitFor(() => {
      expect(aiAPI.parseCommand).toHaveBeenCalledWith({
        message: '添加待办',
        page: 'node-detail',
        currentNodeId: 18,
      })
    })
  })

  it('shows parse API errors and keeps the original input value', async () => {
    mocks.parseCommand.mockRejectedValue({
      response: { data: { error: '节点不存在' } },
    })
    renderAssistant()
    const textarea = await openAssistant()

    fireEvent.change(textarea, { target: { value: '给不存在节点添加待办' } })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))

    expect(await screen.findByText('节点不存在')).toBeInTheDocument()
    expect(textarea).toHaveValue('给不存在节点添加待办')
  })
})

describe('confirmAiDraft', () => {
  it('creates a node from a ready node draft', async () => {
    const timelineAPI = { createNode: vi.fn().mockResolvedValue({}) }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: {
          actionType: 'create_node',
          fields: { name: '拍婚纱照', deadline: '2026-10-01' },
        },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(timelineAPI.createNode).toHaveBeenCalledWith({
      name: '拍婚纱照',
      deadline: '2026-10-01',
    })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('node_update', 'created')
  })

  it('creates a todo from a ready todo draft', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn().mockResolvedValue({}) }
    const expenseAPI = { createExpense: vi.fn() }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: {
          actionType: 'create_todo',
          fields: { nodeId: 13, content: '确认菜单', deadline: '2026-09-20' },
        },
        summary: '将在婚宴节点新增待办：确认菜单，截止 2026-09-20',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(todoAPI.createTodo).toHaveBeenCalledWith({
      nodeId: 13,
      content: '确认菜单',
      deadline: '2026-09-20',
    })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('todo_update', 'created', {
      nodeId: 13,
    })
  })

  it('creates an expense from a ready expense draft', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn().mockResolvedValue({}) }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: {
          actionType: 'create_expense',
          fields: {
            todoId: 88,
            type: 'expense',
            amount: 3000,
            category: '婚纱摄影',
            description: '摄影费用',
          },
        },
        summary: '将在婚纱照 / 选片下记录支出：¥3000，分类：婚纱摄影',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(expenseAPI.createExpense).toHaveBeenCalledWith({
      todoId: 88,
      type: 'expense',
      amount: 3000,
      category: '婚纱摄影',
      description: '摄影费用',
    })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('expense_update', 'created', {
      todoId: 88,
    })
  })

  it('rejects a ready expense draft with zero amount', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }

    await expect(
      confirmAiDraft({
        result: {
          status: 'ready',
          draft: {
            actionType: 'create_expense',
            fields: {
              todoId: 88,
              type: 'expense',
              amount: 0,
              category: '婚纱摄影',
              description: '摄影费用',
            },
          },
          summary: '将在婚纱照 / 选片下记录支出：¥0，分类：婚纱摄影',
          missingFields: [],
          candidates: {},
        },
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('费用信息不完整')
    expect(expenseAPI.createExpense).not.toHaveBeenCalled()
  })

  it('rejects a ready node draft with blank name', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }

    await expect(
      confirmAiDraft({
        result: {
          status: 'ready',
          draft: {
            actionType: 'create_node',
            fields: { name: '   ', deadline: '2026-10-01' },
          },
          summary: '将新增节点：   ，截止 2026-10-01',
          missingFields: [],
          candidates: {},
        },
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('节点名称不能为空')
    expect(timelineAPI.createNode).not.toHaveBeenCalled()
  })

  it('rejects a ready todo draft with blank content', async () => {
    const timelineAPI = { createNode: vi.fn() }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }

    await expect(
      confirmAiDraft({
        result: {
          status: 'ready',
          draft: {
            actionType: 'create_todo',
            fields: { nodeId: 13, content: '   ', deadline: '2026-09-20' },
          },
          summary: '将在婚宴节点新增待办：   ，截止 2026-09-20',
          missingFields: [],
          candidates: {},
        },
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('待办信息不完整')
    expect(todoAPI.createTodo).not.toHaveBeenCalled()
  })

  it('rejects drafts that are not ready', async () => {
    const result: AiParseCommandResponse = {
      status: 'needs_input',
      draft: {
        actionType: 'create_todo',
        fields: { content: '确认菜单' },
      },
      summary: '请选择节点',
      missingFields: ['nodeId'],
      candidates: { nodes: [{ id: 13, name: '婚宴' }] },
    }

    await expect(
      confirmAiDraft({
        result,
        timelineAPI: { createNode: vi.fn() },
        todoAPI: { createTodo: vi.fn() },
        expenseAPI: { createExpense: vi.fn() },
        emitRealtimeEvent: vi.fn(),
      })
    ).rejects.toThrow('请先补全信息')
  })
})
