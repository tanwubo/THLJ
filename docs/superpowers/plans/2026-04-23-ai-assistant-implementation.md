# AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a confirmed-write AI assistant that parses natural language into node, todo, or expense drafts, shows the user a confirmation UI, then calls existing create APIs.

**Architecture:** Backend owns model provider selection, compact user context loading, provider calls, and strict output validation. Frontend owns the floating entry, drawer conversation, missing-field selection, confirmation card, and final persistence through existing APIs.

**Tech Stack:** Express, TypeScript, Vitest, sql.js, React 18, Vite, antd-mobile, axios, Testing Library.

---

## Scope Check

The approved spec spans backend AI parsing and frontend user interaction, but these are sequential pieces of one user-facing flow. Keep them in one plan because the backend parse endpoint is not useful without the confirmation UI, and the UI depends on the parse response shape.

## File Structure

- Create `backend/src/services/ai/types.ts`: shared AI request, context, draft, result, provider, and error types.
- Create `backend/src/services/ai/validation.ts`: deterministic validation and category fallback for provider output.
- Create `backend/src/services/ai/context.ts`: load the authenticated data owner's nodes and todos for prompt context and ID validation.
- Create `backend/src/services/ai/providers/openaiProvider.ts`: OpenAI Responses API adapter using `fetch`.
- Create `backend/src/services/ai/providers/minimaxProvider.ts`: MiniMax OpenAI-compatible chat completions adapter using `fetch`.
- Create `backend/src/services/ai/providerFactory.ts`: environment-driven provider creation.
- Create `backend/src/services/ai/aiCommandService.ts`: parse orchestration, context building, provider call, validation, friendly errors.
- Create `backend/src/controllers/aiController.ts`: Express controller for `POST /api/ai/parse-command`.
- Create `backend/src/routes/aiRoutes.ts`: authenticated route wrapper.
- Modify `backend/src/index.ts`: mount `/api/ai`.
- Create `backend/src/test/aiValidation.test.ts`: validation unit tests.
- Create `backend/src/test/aiProviders.test.ts`: provider adapter and factory tests with mocked `fetch`.
- Create `backend/src/test/aiController.test.ts`: controller and service tests, including no-write assertions.
- Modify `frontend/src/services/api.ts`: add AI request/response types and `aiAPI.parseCommand`.
- Create `frontend/src/components/ai/AIAssistantFloatingEntry.tsx`: global floating entry and drawer state.
- Create `frontend/src/components/ai/AiConfirmationCard.tsx`: render ready, missing-input, unsupported, and error states.
- Create `frontend/src/components/ai/aiDraftActions.ts`: map confirmed drafts to existing create APIs and realtime events.
- Modify `frontend/src/components/layout/AppShell.tsx`: render the AI entry on authenticated shells.
- Modify `frontend/src/index.css`: add AI entry and drawer styles using the confirmed ivory, champagne, ink green, rosewood direction.
- Create `frontend/src/test/aiApi.test.ts`: API client tests.
- Create `frontend/src/test/aiAssistant.test.tsx`: floating entry, parse, confirmation, missing-input, unsupported, and error tests.

---

### Task 1: Backend AI Types And Validation

**Files:**
- Create: `backend/src/services/ai/types.ts`
- Create: `backend/src/services/ai/validation.ts`
- Test: `backend/src/test/aiValidation.test.ts`

- [ ] **Step 1: Write the failing validation tests**

Create `backend/src/test/aiValidation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { validateAiParseResult } from '../services/ai/validation'
import type { AiCommandContext, AiParseResult } from '../services/ai/types'

const context: AiCommandContext = {
  today: '2026-04-23',
  page: 'timeline',
  currentNodeId: null,
  nodes: [
    {
      id: 13,
      name: '婚宴',
      todos: [
        { id: 91, content: '确认菜单' },
        { id: 92, content: '支付酒店定金' },
      ],
    },
    {
      id: 18,
      name: '婚纱照',
      todos: [{ id: 88, content: '选片' }],
    },
  ],
}

describe('validateAiParseResult', () => {
  it('accepts a ready create node draft with normalized deadline', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_node',
        fields: { name: '拍婚纱照', deadline: '2026-10-01' },
      },
      summary: '将新增节点：拍婚纱照，截止 2026-10-01',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result).toEqual({
      status: 'ready',
      draft: {
        actionType: 'create_node',
        fields: { name: '拍婚纱照', deadline: '2026-10-01' },
      },
      summary: '将新增节点：拍婚纱照，截止 2026-10-01',
      missingFields: [],
      candidates: {},
    })
  })

  it('converts a missing node todo draft to needs_input with node candidates', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_todo',
        fields: { content: '确认菜单' },
      },
      summary: '识别到待办：确认菜单。请选择要添加到哪个节点。',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('needs_input')
    expect(result.missingFields).toEqual(['nodeId'])
    expect(result.candidates.nodes).toEqual([
      { id: 13, name: '婚宴' },
      { id: 18, name: '婚纱照' },
    ])
  })

  it('rejects invented nodeId values by requiring user selection', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_todo',
        fields: { nodeId: 999, content: '确认菜单' },
      },
      summary: '将在节点新增待办：确认菜单',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('needs_input')
    expect(result.missingFields).toEqual(['nodeId'])
    expect(result.draft.fields).toEqual({ content: '确认菜单' })
  })

  it('converts an expense with only nodeId to needs_input with todos under that node', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_expense',
        fields: {
          nodeId: 13,
          nodeName: '婚宴',
          type: 'expense',
          amount: 5000,
          category: '婚宴',
          description: '定金',
        },
      },
      summary: '识别到一笔婚宴支出 ¥5000。请选择要挂到哪个待办。',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('needs_input')
    expect(result.missingFields).toEqual(['todoId'])
    expect(result.candidates.todos).toEqual([
      { id: 91, content: '确认菜单', nodeId: 13, nodeName: '婚宴' },
      { id: 92, content: '支付酒店定金', nodeId: 13, nodeName: '婚宴' },
    ])
  })

  it('falls back invalid expense categories to existing defaults', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'create_expense',
        fields: {
          todoId: 88,
          todoName: '选片',
          type: 'expense',
          amount: 3000,
          category: '摄影费用',
          description: '摄影费用',
        },
      },
      summary: '将在婚纱照 / 选片下记录支出：¥3000',
      missingFields: [],
      candidates: {},
    }, context)

    expect(result.status).toBe('ready')
    expect(result.draft.fields.category).toBe('其他支出')
  })

  it('returns unsupported for unsupported action types', () => {
    const result = validateAiParseResult({
      status: 'ready',
      draft: {
        actionType: 'delete_node',
        fields: { name: '婚宴' },
      },
      summary: '暂不支持删除节点',
      missingFields: [],
      candidates: {},
    } as unknown as AiParseResult, context)

    expect(result).toEqual({
      status: 'unsupported',
      draft: null,
      summary: '暂不支持这个操作。当前只支持新增节点、待办和费用。',
      missingFields: [],
      candidates: {},
    })
  })
})
```

- [ ] **Step 2: Run the validation tests to verify they fail**

Run:

```powershell
cd backend
npm test -- src/test/aiValidation.test.ts
```

Expected: FAIL because `../services/ai/validation` and `../services/ai/types` do not exist.

- [ ] **Step 3: Create the AI type definitions**

Create `backend/src/services/ai/types.ts`:

```ts
export type AiPage = 'timeline' | 'node-detail' | 'statistics' | 'settings' | 'unknown'
export type AiStatus = 'ready' | 'needs_input' | 'unsupported'
export type AiActionType = 'create_node' | 'create_todo' | 'create_expense'
export type ExpenseType = 'income' | 'expense'

export interface AiParseRequest {
  message: string
  page: AiPage
  currentNodeId?: number | null
}

export interface AiContextTodo {
  id: number
  content: string
}

export interface AiContextNode {
  id: number
  name: string
  todos: AiContextTodo[]
}

export interface AiCommandContext {
  today: string
  page: AiPage
  currentNodeId: number | null
  nodes: AiContextNode[]
}

export interface AiCandidateNode {
  id: number
  name: string
}

export interface AiCandidateTodo {
  id: number
  content: string
  nodeId: number
  nodeName: string
}

export type AiDraftFields = {
  name?: string
  description?: string
  deadline?: string
  budget?: number
  nodeId?: number
  nodeName?: string
  content?: string
  todoId?: number
  todoName?: string
  type?: ExpenseType
  amount?: number
  category?: string
}

export interface AiDraft {
  actionType: AiActionType
  fields: AiDraftFields
}

export interface AiParseResult {
  status: AiStatus
  draft: AiDraft | null
  summary: string
  missingFields: string[]
  candidates: {
    nodes?: AiCandidateNode[]
    todos?: AiCandidateTodo[]
  }
}

export interface AiProvider {
  parseCommand(input: AiParseRequest, context: AiCommandContext): Promise<AiParseResult>
}

export class AiProviderError extends Error {
  constructor(message: string, public readonly code: 'config' | 'timeout' | 'network' | 'malformed') {
    super(message)
    this.name = 'AiProviderError'
  }
}
```

- [ ] **Step 4: Implement validation**

Create `backend/src/services/ai/validation.ts`:

```ts
import type {
  AiCandidateNode,
  AiCandidateTodo,
  AiCommandContext,
  AiDraft,
  AiDraftFields,
  AiParseResult,
  ExpenseType,
} from './types'

const supportedActions = new Set(['create_node', 'create_todo', 'create_expense'])
const supportedStatuses = new Set(['ready', 'needs_input', 'unsupported'])
const datePattern = /^\d{4}-\d{2}-\d{2}$/

const expenseCategories = {
  income: ['彩礼', '礼金', '嫁妆回礼', '其他收入'],
  expense: ['婚宴', '婚庆', '婚车', '婚纱摄影', '三金/五金', '酒店预订', '婚车车队', '蜜月旅行', '其他支出'],
} satisfies Record<ExpenseType, string[]>

function unsupported(): AiParseResult {
  return {
    status: 'unsupported',
    draft: null,
    summary: '暂不支持这个操作。当前只支持新增节点、待办和费用。',
    missingFields: [],
    candidates: {},
  }
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed || undefined
}

function cleanPositiveNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined
  }
  return numberValue
}

function cleanNonNegativeNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return undefined
  }
  return numberValue
}

function cleanDate(value: unknown): string | undefined {
  const text = cleanString(value)
  if (!text || !datePattern.test(text)) {
    return undefined
  }
  return text
}

function getNodeCandidates(context: AiCommandContext): AiCandidateNode[] {
  return context.nodes.map((node) => ({ id: node.id, name: node.name }))
}

function getTodoCandidates(context: AiCommandContext, nodeId?: number): AiCandidateTodo[] {
  return context.nodes
    .filter((node) => nodeId === undefined || node.id === nodeId)
    .flatMap((node) => node.todos.map((todo) => ({
      id: todo.id,
      content: todo.content,
      nodeId: node.id,
      nodeName: node.name,
    })))
}

function findNode(context: AiCommandContext, nodeId: unknown) {
  const id = Number(nodeId)
  if (!Number.isInteger(id)) {
    return undefined
  }
  return context.nodes.find((node) => node.id === id)
}

function findTodo(context: AiCommandContext, todoId: unknown) {
  const id = Number(todoId)
  if (!Number.isInteger(id)) {
    return undefined
  }
  for (const node of context.nodes) {
    const todo = node.todos.find((item) => item.id === id)
    if (todo) {
      return { todo, node }
    }
  }
  return undefined
}

function withNeedsInput(draft: AiDraft, missingFields: string[], candidates: AiParseResult['candidates'], summary: string): AiParseResult {
  return {
    status: 'needs_input',
    draft,
    summary,
    missingFields,
    candidates,
  }
}

function normalizeNodeDraft(fields: AiDraftFields): AiParseResult {
  const name = cleanString(fields.name)
  if (!name) {
    return withNeedsInput(
      { actionType: 'create_node', fields: {} },
      ['name'],
      {},
      '请补充节点名称。',
    )
  }

  const cleaned: AiDraftFields = { name }
  const description = cleanString(fields.description)
  const deadline = cleanDate(fields.deadline)
  const budget = fields.budget === undefined ? undefined : cleanNonNegativeNumber(fields.budget)

  if (description) cleaned.description = description
  if (deadline) cleaned.deadline = deadline
  if (budget !== undefined) cleaned.budget = budget

  return {
    status: 'ready',
    draft: { actionType: 'create_node', fields: cleaned },
    summary: deadline ? `将新增节点：${name}，截止 ${deadline}` : `将新增节点：${name}`,
    missingFields: [],
    candidates: {},
  }
}

function normalizeTodoDraft(fields: AiDraftFields, context: AiCommandContext): AiParseResult {
  const content = cleanString(fields.content)
  const selectedNode = findNode(context, fields.nodeId)
  const cleaned: AiDraftFields = {}
  if (content) cleaned.content = content

  if (!content) {
    return withNeedsInput(
      { actionType: 'create_todo', fields: cleaned },
      ['content'],
      {},
      '请补充待办内容。',
    )
  }

  if (!selectedNode) {
    return withNeedsInput(
      { actionType: 'create_todo', fields: cleaned },
      ['nodeId'],
      { nodes: getNodeCandidates(context) },
      `识别到待办：${content}。请选择要添加到哪个节点。`,
    )
  }

  cleaned.nodeId = selectedNode.id
  cleaned.nodeName = selectedNode.name
  const deadline = cleanDate(fields.deadline)
  if (deadline) cleaned.deadline = deadline

  return {
    status: 'ready',
    draft: { actionType: 'create_todo', fields: cleaned },
    summary: deadline
      ? `将在${selectedNode.name}节点新增待办：${content}，截止 ${deadline}`
      : `将在${selectedNode.name}节点新增待办：${content}`,
    missingFields: [],
    candidates: {},
  }
}

function normalizeExpenseDraft(fields: AiDraftFields, context: AiCommandContext): AiParseResult {
  const type = fields.type === 'income' ? 'income' : 'expense'
  const amount = cleanPositiveNumber(fields.amount)
  const matchedTodo = findTodo(context, fields.todoId)
  const selectedNode = findNode(context, fields.nodeId)
  const cleaned: AiDraftFields = { type }

  if (amount !== undefined) cleaned.amount = amount
  const description = cleanString(fields.description)
  if (description) cleaned.description = description
  const category = cleanString(fields.category)
  cleaned.category = category && expenseCategories[type].includes(category)
    ? category
    : type === 'income'
      ? '其他收入'
      : '其他支出'

  if (amount === undefined) {
    return withNeedsInput(
      { actionType: 'create_expense', fields: cleaned },
      ['amount'],
      {},
      '请补充费用金额。',
    )
  }

  if (!matchedTodo) {
    if (selectedNode) {
      cleaned.nodeId = selectedNode.id
      cleaned.nodeName = selectedNode.name
    }
    return withNeedsInput(
      { actionType: 'create_expense', fields: cleaned },
      ['todoId'],
      { todos: getTodoCandidates(context, selectedNode?.id) },
      `识别到一笔${type === 'income' ? '收入' : '支出'} ¥${amount}。请选择要挂到哪个待办。`,
    )
  }

  cleaned.todoId = matchedTodo.todo.id
  cleaned.todoName = matchedTodo.todo.content
  cleaned.nodeId = matchedTodo.node.id
  cleaned.nodeName = matchedTodo.node.name

  return {
    status: 'ready',
    draft: { actionType: 'create_expense', fields: cleaned },
    summary: `将在${matchedTodo.node.name} / ${matchedTodo.todo.content}下记录${type === 'income' ? '收入' : '支出'}：¥${amount}，分类：${cleaned.category}`,
    missingFields: [],
    candidates: {},
  }
}

export function validateAiParseResult(raw: unknown, context: AiCommandContext): AiParseResult {
  const result = raw as Partial<AiParseResult> | null
  if (!result || !supportedStatuses.has(String(result.status))) {
    return unsupported()
  }

  if (result.status === 'unsupported') {
    return unsupported()
  }

  const draft = result.draft as AiDraft | null
  if (!draft || !supportedActions.has(String(draft.actionType))) {
    return unsupported()
  }

  const fields = (draft.fields ?? {}) as AiDraftFields
  if (draft.actionType === 'create_node') {
    return normalizeNodeDraft(fields)
  }
  if (draft.actionType === 'create_todo') {
    return normalizeTodoDraft(fields, context)
  }
  return normalizeExpenseDraft(fields, context)
}
```

- [ ] **Step 5: Run validation tests to verify they pass**

Run:

```powershell
cd backend
npm test -- src/test/aiValidation.test.ts
```

Expected: PASS for all `validateAiParseResult` tests.

- [ ] **Step 6: Commit backend validation**

Run:

```powershell
git add backend/src/services/ai/types.ts backend/src/services/ai/validation.ts backend/src/test/aiValidation.test.ts
git commit -m "feat: add AI parse validation"
```

Expected: commit succeeds.

---

### Task 2: Backend Providers And Context Loading

**Files:**
- Create: `backend/src/services/ai/context.ts`
- Create: `backend/src/services/ai/providers/openaiProvider.ts`
- Create: `backend/src/services/ai/providers/minimaxProvider.ts`
- Create: `backend/src/services/ai/providerFactory.ts`
- Test: `backend/src/test/aiProviders.test.ts`

- [ ] **Step 1: Write failing provider and context tests**

Create `backend/src/test/aiProviders.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAiCommandContext } from '../services/ai/context'
import { createAiProvider } from '../services/ai/providerFactory'
import { createOpenAiProvider } from '../services/ai/providers/openaiProvider'
import { createMiniMaxProvider } from '../services/ai/providers/minimaxProvider'

vi.mock('../db', () => ({
  query: vi.fn(),
}))

import { query } from '../db'

const context = {
  today: '2026-04-23',
  page: 'timeline' as const,
  currentNodeId: null,
  nodes: [],
}

describe('AI context and providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    delete process.env.AI_PROVIDER
    delete process.env.AI_MODEL
    delete process.env.AI_API_KEY
    delete process.env.AI_BASE_URL
    delete process.env.AI_TIMEOUT_MS
  })

  it('builds compact node and todo context for the data owner', () => {
    const queryMock = query as unknown as ReturnType<typeof vi.fn>
    queryMock.mockImplementation((sql: string, params: unknown[]) => {
      if (sql === 'SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC') {
        expect(params).toEqual([99])
        return [
          { id: 13, name: '婚宴' },
          { id: 18, name: '婚纱照' },
        ]
      }
      if (sql === 'SELECT id, node_id, content FROM todo_items WHERE node_id IN (?,?) ORDER BY node_id ASC, created_at DESC') {
        expect(params).toEqual([13, 18])
        return [
          { id: 91, node_id: 13, content: '确认菜单' },
          { id: 88, node_id: 18, content: '选片' },
        ]
      }
      return []
    })

    expect(buildAiCommandContext({
      dataOwnerId: 99,
      page: 'timeline',
      currentNodeId: null,
      today: '2026-04-23',
    })).toEqual({
      today: '2026-04-23',
      page: 'timeline',
      currentNodeId: null,
      nodes: [
        { id: 13, name: '婚宴', todos: [{ id: 91, content: '确认菜单' }] },
        { id: 18, name: '婚纱照', todos: [{ id: 88, content: '选片' }] },
      ],
    })
  })

  it('creates an OpenAI provider from environment variables', () => {
    process.env.AI_PROVIDER = 'openai'
    process.env.AI_MODEL = 'gpt-4.1-mini'
    process.env.AI_API_KEY = 'test-key'

    expect(createAiProvider().name).toBe('openai')
  })

  it('creates a MiniMax provider from environment variables', () => {
    process.env.AI_PROVIDER = 'minimax'
    process.env.AI_MODEL = 'MiniMax-M2.7'
    process.env.AI_API_KEY = 'test-key'
    process.env.AI_BASE_URL = 'https://api.minimax.io/v1'

    expect(createAiProvider().name).toBe('minimax')
  })

  it('maps OpenAI structured output text to an AI parse result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  status: 'ready',
                  draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
                  summary: '将新增节点：拍婚纱照，截止 2026-10-01',
                  missingFields: [],
                  candidates: {},
                }),
              },
            ],
          },
        ],
      }),
    })

    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 15000,
      fetchImpl: fetchMock,
    })

    const result = await provider.parseCommand({ message: '增加一个10月1日拍婚纱照的节点', page: 'timeline' }, context)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    )
    expect(result.draft?.fields.name).toBe('拍婚纱照')
  })

  it('maps MiniMax chat completion content to an AI parse result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'ready',
                draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
                summary: '将新增节点：拍婚纱照，截止 2026-10-01',
                missingFields: [],
                candidates: {},
              }),
            },
          },
        ],
      }),
    })

    const provider = createMiniMaxProvider({
      apiKey: 'test-key',
      model: 'MiniMax-M2.7',
      baseUrl: 'https://api.minimax.io/v1',
      timeoutMs: 15000,
      fetchImpl: fetchMock,
    })

    const result = await provider.parseCommand({ message: '增加一个10月1日拍婚纱照的节点', page: 'timeline' }, context)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimax.io/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.summary).toContain('拍婚纱照')
  })
})
```

- [ ] **Step 2: Run provider tests to verify they fail**

Run:

```powershell
cd backend
npm test -- src/test/aiProviders.test.ts
```

Expected: FAIL because context and provider files do not exist.

- [ ] **Step 3: Implement context loading**

Create `backend/src/services/ai/context.ts`:

```ts
import { query } from '../../db'
import type { AiCommandContext, AiPage } from './types'

type BuildContextInput = {
  dataOwnerId: number
  page: AiPage
  currentNodeId: number | null
  today: string
}

export function buildAiCommandContext(input: BuildContextInput): AiCommandContext {
  const nodes = query(
    'SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC',
    [input.dataOwnerId],
  ) as Array<{ id: number; name: string }>

  if (nodes.length === 0) {
    return {
      today: input.today,
      page: input.page,
      currentNodeId: input.currentNodeId,
      nodes: [],
    }
  }

  const placeholders = nodes.map(() => '?').join(',')
  const todos = query(
    `SELECT id, node_id, content FROM todo_items WHERE node_id IN (${placeholders}) ORDER BY node_id ASC, created_at DESC`,
    nodes.map((node) => node.id),
  ) as Array<{ id: number; node_id: number; content: string }>

  return {
    today: input.today,
    page: input.page,
    currentNodeId: input.currentNodeId,
    nodes: nodes.map((node) => ({
      id: Number(node.id),
      name: node.name,
      todos: todos
        .filter((todo) => Number(todo.node_id) === Number(node.id))
        .map((todo) => ({ id: Number(todo.id), content: todo.content })),
    })),
  }
}
```

- [ ] **Step 4: Implement provider shared helpers and OpenAI adapter**

Create `backend/src/services/ai/providers/openaiProvider.ts`:

```ts
import type { AiCommandContext, AiParseRequest, AiParseResult, AiProvider } from '../types'
import { AiProviderError } from '../types'

type ProviderOptions = {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

function buildSystemPrompt(context: AiCommandContext): string {
  return [
    '你是婚礼筹备应用的指令解析器，只输出 JSON。',
    `今天是 ${context.today}，不完整日期使用当前年；如果日期早于今天则顺延到下一年。`,
    '只支持 create_node、create_todo、create_expense。',
    'nodeId 和 todoId 只能从提供的 context 中选择，不能编造。',
    `当前页面：${context.page}；当前节点：${context.currentNodeId ?? '无'}。`,
    `context: ${JSON.stringify({ nodes: context.nodes })}`,
  ].join('\n')
}

function extractJsonText(payload: any): string {
  if (typeof payload.output_text === 'string') {
    return payload.output_text
  }

  const text = payload.output
    ?.flatMap((item: any) => item.content ?? [])
    ?.find((content: any) => typeof content.text === 'string')
    ?.text

  if (typeof text !== 'string') {
    throw new AiProviderError('OpenAI 返回内容格式异常', 'malformed')
  }
  return text
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AiProviderError('AI 服务请求超时', 'timeout')
    }
    throw new AiProviderError('AI 服务网络异常', 'network')
  } finally {
    clearTimeout(timeout)
  }
}

export function createOpenAiProvider(options: ProviderOptions): AiProvider & { name: 'openai' } {
  return {
    name: 'openai',
    async parseCommand(input: AiParseRequest, context: AiCommandContext): Promise<AiParseResult> {
      const fetchImpl = options.fetchImpl ?? fetch
      const response = await fetchWithTimeout(fetchImpl, `${options.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          input: [
            { role: 'system', content: buildSystemPrompt(context) },
            { role: 'user', content: input.message },
          ],
          text: {
            format: {
              type: 'json_object',
            },
          },
        }),
      }, options.timeoutMs)

      if (!response.ok) {
        throw new AiProviderError(`OpenAI 请求失败：${response.status}`, 'network')
      }

      try {
        return JSON.parse(extractJsonText(await response.json())) as AiParseResult
      } catch (error) {
        if (error instanceof AiProviderError) {
          throw error
        }
        throw new AiProviderError('OpenAI 返回了无法解析的 JSON', 'malformed')
      }
    },
  }
}
```

- [ ] **Step 5: Implement MiniMax adapter**

Create `backend/src/services/ai/providers/minimaxProvider.ts`:

```ts
import type { AiCommandContext, AiParseRequest, AiParseResult, AiProvider } from '../types'
import { AiProviderError } from '../types'

type ProviderOptions = {
  apiKey: string
  model: string
  baseUrl: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}

function buildSystemPrompt(context: AiCommandContext): string {
  return [
    '你是婚礼筹备应用的指令解析器，只输出 JSON，不要输出 Markdown。',
    `今天是 ${context.today}，不完整日期使用当前年；如果日期早于今天则顺延到下一年。`,
    '只支持 create_node、create_todo、create_expense。',
    'nodeId 和 todoId 只能从提供的 context 中选择，不能编造。',
    `当前页面：${context.page}；当前节点：${context.currentNodeId ?? '无'}。`,
    `context: ${JSON.stringify({ nodes: context.nodes })}`,
  ].join('\n')
}

async function fetchWithTimeout(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AiProviderError('AI 服务请求超时', 'timeout')
    }
    throw new AiProviderError('AI 服务网络异常', 'network')
  } finally {
    clearTimeout(timeout)
  }
}

export function createMiniMaxProvider(options: ProviderOptions): AiProvider & { name: 'minimax' } {
  return {
    name: 'minimax',
    async parseCommand(input: AiParseRequest, context: AiCommandContext): Promise<AiParseResult> {
      const fetchImpl = options.fetchImpl ?? fetch
      const response = await fetchWithTimeout(fetchImpl, `${options.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: 'system', content: buildSystemPrompt(context) },
            { role: 'user', content: input.message },
          ],
        }),
      }, options.timeoutMs)

      if (!response.ok) {
        throw new AiProviderError(`MiniMax 请求失败：${response.status}`, 'network')
      }

      try {
        const payload = await response.json()
        const text = payload.choices?.[0]?.message?.content
        if (typeof text !== 'string') {
          throw new AiProviderError('MiniMax 返回内容格式异常', 'malformed')
        }
        return JSON.parse(text) as AiParseResult
      } catch (error) {
        if (error instanceof AiProviderError) {
          throw error
        }
        throw new AiProviderError('MiniMax 返回了无法解析的 JSON', 'malformed')
      }
    },
  }
}
```

- [ ] **Step 6: Implement provider factory**

Create `backend/src/services/ai/providerFactory.ts`:

```ts
import type { AiProvider } from './types'
import { AiProviderError } from './types'
import { createMiniMaxProvider } from './providers/minimaxProvider'
import { createOpenAiProvider } from './providers/openaiProvider'

type NamedAiProvider = AiProvider & { name: 'openai' | 'minimax' }

export function createAiProvider(): NamedAiProvider {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
  const apiKey = process.env.AI_API_KEY
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 15000)

  if (!apiKey) {
    throw new AiProviderError('AI_API_KEY 未配置', 'config')
  }

  if (provider === 'openai') {
    return createOpenAiProvider({
      apiKey,
      model: process.env.AI_MODEL || 'gpt-4.1-mini',
      baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
      timeoutMs,
    })
  }

  if (provider === 'minimax') {
    return createMiniMaxProvider({
      apiKey,
      model: process.env.AI_MODEL || 'MiniMax-M2.7',
      baseUrl: (process.env.AI_BASE_URL || 'https://api.minimax.io/v1').replace(/\/$/, ''),
      timeoutMs,
    })
  }

  throw new AiProviderError(`不支持的 AI_PROVIDER：${provider}`, 'config')
}
```

- [ ] **Step 7: Run provider tests to verify they pass**

Run:

```powershell
cd backend
npm test -- src/test/aiProviders.test.ts
```

Expected: PASS for context, provider factory, OpenAI adapter, and MiniMax adapter tests.

- [ ] **Step 8: Commit backend providers**

Run:

```powershell
git add backend/src/services/ai/context.ts backend/src/services/ai/providerFactory.ts backend/src/services/ai/providers/openaiProvider.ts backend/src/services/ai/providers/minimaxProvider.ts backend/src/test/aiProviders.test.ts
git commit -m "feat: add AI provider adapters"
```

Expected: commit succeeds.

---

### Task 3: Backend Parse Endpoint

**Files:**
- Create: `backend/src/services/ai/aiCommandService.ts`
- Create: `backend/src/controllers/aiController.ts`
- Create: `backend/src/routes/aiRoutes.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/test/aiController.test.ts`

- [ ] **Step 1: Write failing controller/service tests**

Create `backend/src/test/aiController.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseAiCommand } from '../controllers/aiController'
import { parseCommandForUser } from '../services/ai/aiCommandService'

vi.mock('../db', () => ({
  query: vi.fn(),
  run: vi.fn(),
}))

vi.mock('../services/ai/providerFactory', () => ({
  createAiProvider: vi.fn(),
}))

import { query, run } from '../db'
import { createAiProvider } from '../services/ai/providerFactory'

describe('AI parse endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2026-04-23T08:00:00.000Z'))
  })

  it('returns a validated ready draft and does not write data', async () => {
    const queryMock = query as unknown as ReturnType<typeof vi.fn>
    queryMock.mockImplementation((sql: string) => {
      if (sql === 'SELECT id, name FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC, id ASC') {
        return [{ id: 13, name: '婚宴' }]
      }
      if (sql === 'SELECT id, node_id, content FROM todo_items WHERE node_id IN (?) ORDER BY node_id ASC, created_at DESC') {
        return [{ id: 91, node_id: 13, content: '确认菜单' }]
      }
      return []
    })

    const provider = {
      parseCommand: vi.fn().mockResolvedValue({
        status: 'ready',
        draft: {
          actionType: 'create_todo',
          fields: { nodeId: 13, nodeName: '婚宴', content: '确认菜单', deadline: '2026-09-20' },
        },
        summary: '将在婚宴节点新增待办：确认菜单，截止 2026-09-20',
        missingFields: [],
        candidates: {},
      }),
    }
    ;(createAiProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(provider)

    const result = await parseCommandForUser({
      userId: 1,
      dataOwnerId: 99,
      body: {
        message: '给婚宴节点增加一个9月20日前确认菜单的待办',
        page: 'timeline',
        currentNodeId: null,
      },
    })

    expect(result.status).toBe('ready')
    expect(result.draft?.fields.nodeId).toBe(13)
    expect(run).not.toHaveBeenCalled()
  })

  it('controller validates required message', async () => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await parseAiCommand({
      body: { message: '', page: 'timeline' },
      user: { id: 1, dataOwnerId: 99 },
    } as any, { json, status } as any)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ error: '请输入要解析的内容' })
  })

  it('maps provider configuration errors to friendly 503 responses', async () => {
    ;(createAiProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw Object.assign(new Error('AI_API_KEY 未配置'), { code: 'config' })
    })

    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })

    await parseAiCommand({
      body: { message: '增加节点', page: 'timeline' },
      user: { id: 1, dataOwnerId: 99 },
    } as any, { json, status } as any)

    expect(status).toHaveBeenCalledWith(503)
    expect(json).toHaveBeenCalledWith({ error: 'AI 服务暂不可用，请稍后再试' })
  })
})
```

- [ ] **Step 2: Run endpoint tests to verify they fail**

Run:

```powershell
cd backend
npm test -- src/test/aiController.test.ts
```

Expected: FAIL because service, controller, and route files do not exist.

- [ ] **Step 3: Implement parse service**

Create `backend/src/services/ai/aiCommandService.ts`:

```ts
import { buildAiCommandContext } from './context'
import { createAiProvider } from './providerFactory'
import { validateAiParseResult } from './validation'
import { AiProviderError, type AiPage, type AiParseResult } from './types'

type ParseCommandForUserInput = {
  userId: number
  dataOwnerId: number
  body: {
    message?: unknown
    page?: unknown
    currentNodeId?: unknown
  }
}

const validPages = new Set(['timeline', 'node-detail', 'statistics', 'settings', 'unknown'])

export class AiCommandValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiCommandValidationError'
  }
}

function normalizePage(page: unknown): AiPage {
  return validPages.has(String(page)) ? String(page) as AiPage : 'unknown'
}

function normalizeCurrentNodeId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}

function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function parseCommandForUser(input: ParseCommandForUserInput): Promise<AiParseResult> {
  const message = typeof input.body.message === 'string' ? input.body.message.trim() : ''
  if (!message) {
    throw new AiCommandValidationError('请输入要解析的内容')
  }

  const request = {
    message,
    page: normalizePage(input.body.page),
    currentNodeId: normalizeCurrentNodeId(input.body.currentNodeId),
  }

  const context = buildAiCommandContext({
    dataOwnerId: input.dataOwnerId,
    page: request.page,
    currentNodeId: request.currentNodeId,
    today: todayInShanghai(),
  })

  try {
    const provider = createAiProvider()
    const rawResult = await provider.parseCommand(request, context)
    return validateAiParseResult(rawResult, context)
  } catch (error) {
    if (error instanceof AiProviderError || error instanceof Error) {
      throw error
    }
    throw new AiProviderError('AI 服务异常', 'network')
  }
}
```

- [ ] **Step 4: Implement controller and route**

Create `backend/src/controllers/aiController.ts`:

```ts
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { parseCommandForUser, AiCommandValidationError } from '../services/ai/aiCommandService'
import { AiProviderError } from '../services/ai/types'

export const parseAiCommand = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const dataOwnerId = req.user?.dataOwnerId ?? userId
    if (!userId || !dataOwnerId) {
      return res.status(401).json({ error: '未授权访问，请先登录' })
    }

    const result = await parseCommandForUser({
      userId,
      dataOwnerId,
      body: req.body ?? {},
    })

    res.json(result)
  } catch (error: any) {
    if (error instanceof AiCommandValidationError) {
      return res.status(400).json({ error: error.message })
    }
    if (error instanceof AiProviderError || ['config', 'timeout', 'network', 'malformed'].includes(error?.code)) {
      return res.status(503).json({ error: 'AI 服务暂不可用，请稍后再试' })
    }
    console.error('AI 指令解析失败:', error)
    res.status(500).json({ error: 'AI 指令解析失败' })
  }
}
```

Create `backend/src/routes/aiRoutes.ts`:

```ts
import express from 'express'
import { parseAiCommand } from '../controllers/aiController'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

router.use(authMiddleware)
router.post('/parse-command', parseAiCommand)

export default router
```

- [ ] **Step 5: Mount the route**

Modify `backend/src/index.ts` imports and route registrations:

```ts
import aiRoutes from './routes/aiRoutes'
```

Add below the existing route registrations:

```ts
app.use('/api/ai', aiRoutes)
```

- [ ] **Step 6: Run endpoint tests to verify they pass**

Run:

```powershell
cd backend
npm test -- src/test/aiController.test.ts
```

Expected: PASS for service and controller tests.

- [ ] **Step 7: Run backend test suite**

Run:

```powershell
cd backend
npm test
```

Expected: PASS for the backend suite.

- [ ] **Step 8: Commit backend endpoint**

Run:

```powershell
git add backend/src/services/ai/aiCommandService.ts backend/src/controllers/aiController.ts backend/src/routes/aiRoutes.ts backend/src/index.ts backend/src/test/aiController.test.ts
git commit -m "feat: expose AI parse endpoint"
```

Expected: commit succeeds.

---

### Task 4: Frontend AI API Types

**Files:**
- Modify: `frontend/src/services/api.ts`
- Test: `frontend/src/test/aiApi.test.ts`

- [ ] **Step 1: Write failing frontend API test**

Create `frontend/src/test/aiApi.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

const postMock = vi.fn()

vi.mock('axios', () => ({
  default: {
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      post: postMock,
    }),
  },
}))

describe('aiAPI', () => {
  it('posts parse commands to the AI endpoint', async () => {
    const { aiAPI } = await import('../services/api')
    postMock.mockResolvedValue({
      data: {
        status: 'ready',
        draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      },
    })

    const response = await aiAPI.parseCommand({
      message: '增加一个10月1日拍婚纱照的节点',
      page: 'timeline',
      currentNodeId: null,
    })

    expect(postMock).toHaveBeenCalledWith('/ai/parse-command', {
      message: '增加一个10月1日拍婚纱照的节点',
      page: 'timeline',
      currentNodeId: null,
    })
    expect(response.data.draft.fields.name).toBe('拍婚纱照')
  })
})
```

- [ ] **Step 2: Run API test to verify it fails**

Run:

```powershell
cd frontend
npm test -- src/test/aiApi.test.ts
```

Expected: FAIL because `aiAPI` is not exported.

- [ ] **Step 3: Add AI types and API client**

Modify `frontend/src/services/api.ts` near the other exported interfaces:

```ts
export type AiPage = 'timeline' | 'node-detail' | 'statistics' | 'settings' | 'unknown'
export type AiStatus = 'ready' | 'needs_input' | 'unsupported'
export type AiActionType = 'create_node' | 'create_todo' | 'create_expense'

export interface AiParseCommandRequest {
  message: string
  page: AiPage
  currentNodeId?: number | null
}

export interface AiDraftFields {
  name?: string
  description?: string
  deadline?: string
  budget?: number
  nodeId?: number
  nodeName?: string
  content?: string
  todoId?: number
  todoName?: string
  type?: 'income' | 'expense'
  amount?: number
  category?: string
}

export interface AiDraft {
  actionType: AiActionType
  fields: AiDraftFields
}

export interface AiParseCommandResponse {
  status: AiStatus
  draft: AiDraft | null
  summary: string
  missingFields: string[]
  candidates: {
    nodes?: Array<{ id: number; name: string }>
    todos?: Array<{ id: number; content: string; nodeId: number; nodeName: string }>
  }
}

export const aiAPI = {
  parseCommand: (data: AiParseCommandRequest) =>
    api.post<AiParseCommandResponse>('/ai/parse-command', data),
}
```

- [ ] **Step 4: Run frontend API test to verify it passes**

Run:

```powershell
cd frontend
npm test -- src/test/aiApi.test.ts
```

Expected: PASS for `aiAPI.parseCommand`.

- [ ] **Step 5: Commit frontend API client**

Run:

```powershell
git add frontend/src/services/api.ts frontend/src/test/aiApi.test.ts
git commit -m "feat: add AI API client"
```

Expected: commit succeeds.

---

### Task 5: Frontend Confirmation Actions

**Files:**
- Create: `frontend/src/components/ai/aiDraftActions.ts`
- Test: `frontend/src/test/aiAssistant.test.tsx`

- [ ] **Step 1: Write failing action tests**

Create the first section of `frontend/src/test/aiAssistant.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiParseCommandResponse } from '../services/api'
import { confirmAiDraft } from '../components/ai/aiDraftActions'

describe('confirmAiDraft', () => {
  it('creates a node from a ready node draft', async () => {
    const timelineAPI = { createNode: vi.fn().mockResolvedValue({}) }
    const todoAPI = { createTodo: vi.fn() }
    const expenseAPI = { createExpense: vi.fn() }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      },
      timelineAPI,
      todoAPI,
      expenseAPI,
      emitRealtimeEvent,
    })

    expect(timelineAPI.createNode).toHaveBeenCalledWith({ name: '拍婚纱照', deadline: '2026-10-01' })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('node_update', 'created')
  })

  it('creates a todo from a ready todo draft', async () => {
    const todoAPI = { createTodo: vi.fn().mockResolvedValue({}) }
    const emitRealtimeEvent = vi.fn()

    await confirmAiDraft({
      result: {
        status: 'ready',
        draft: { actionType: 'create_todo', fields: { nodeId: 13, content: '确认菜单', deadline: '2026-09-20' } },
        summary: '将在婚宴节点新增待办：确认菜单，截止 2026-09-20',
        missingFields: [],
        candidates: {},
      },
      timelineAPI: { createNode: vi.fn() },
      todoAPI,
      expenseAPI: { createExpense: vi.fn() },
      emitRealtimeEvent,
    })

    expect(todoAPI.createTodo).toHaveBeenCalledWith({ nodeId: 13, content: '确认菜单', deadline: '2026-09-20' })
    expect(emitRealtimeEvent).toHaveBeenCalledWith('todo_update', 'created', { nodeId: 13 })
  })

  it('creates an expense from a ready expense draft', async () => {
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
      timelineAPI: { createNode: vi.fn() },
      todoAPI: { createTodo: vi.fn() },
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
    expect(emitRealtimeEvent).toHaveBeenCalledWith('expense_update', 'created', { todoId: 88 })
  })

  it('rejects drafts that are not ready', async () => {
    const result: AiParseCommandResponse = {
      status: 'needs_input',
      draft: { actionType: 'create_todo', fields: { content: '确认菜单' } },
      summary: '请选择节点',
      missingFields: ['nodeId'],
      candidates: { nodes: [{ id: 13, name: '婚宴' }] },
    }

    await expect(confirmAiDraft({
      result,
      timelineAPI: { createNode: vi.fn() },
      todoAPI: { createTodo: vi.fn() },
      expenseAPI: { createExpense: vi.fn() },
      emitRealtimeEvent: vi.fn(),
    })).rejects.toThrow('请先补全信息')
  })
})
```

- [ ] **Step 2: Run action tests to verify they fail**

Run:

```powershell
cd frontend
npm test -- src/test/aiAssistant.test.tsx
```

Expected: FAIL because `aiDraftActions.ts` does not exist.

- [ ] **Step 3: Implement draft confirmation actions**

Create `frontend/src/components/ai/aiDraftActions.ts`:

```ts
import type { AiParseCommandResponse } from '../../services/api'

type ConfirmAiDraftInput = {
  result: AiParseCommandResponse
  timelineAPI: {
    createNode: (data: { name: string; description?: string; deadline?: string; budget?: number }) => Promise<unknown>
  }
  todoAPI: {
    createTodo: (data: { nodeId: number; content: string; deadline?: string }) => Promise<unknown>
  }
  expenseAPI: {
    createExpense: (data: { todoId: number; type: string; amount: number; category?: string; description?: string }) => Promise<unknown>
  }
  emitRealtimeEvent: (event: string, action: string, payload?: any) => void
}

export async function confirmAiDraft(input: ConfirmAiDraftInput) {
  const draft = input.result.draft
  if (input.result.status !== 'ready' || !draft) {
    throw new Error('请先补全信息')
  }

  if (draft.actionType === 'create_node') {
    const name = draft.fields.name?.trim()
    if (!name) {
      throw new Error('节点名称不能为空')
    }
    await input.timelineAPI.createNode({
      name,
      description: draft.fields.description,
      deadline: draft.fields.deadline,
      budget: draft.fields.budget,
    })
    input.emitRealtimeEvent('node_update', 'created')
    return
  }

  if (draft.actionType === 'create_todo') {
    if (!draft.fields.nodeId || !draft.fields.content?.trim()) {
      throw new Error('待办信息不完整')
    }
    await input.todoAPI.createTodo({
      nodeId: draft.fields.nodeId,
      content: draft.fields.content.trim(),
      deadline: draft.fields.deadline,
    })
    input.emitRealtimeEvent('todo_update', 'created', { nodeId: draft.fields.nodeId })
    return
  }

  if (!draft.fields.todoId || !draft.fields.type || !draft.fields.amount) {
    throw new Error('费用信息不完整')
  }
  await input.expenseAPI.createExpense({
    todoId: draft.fields.todoId,
    type: draft.fields.type,
    amount: draft.fields.amount,
    category: draft.fields.category,
    description: draft.fields.description,
  })
  input.emitRealtimeEvent('expense_update', 'created', { todoId: draft.fields.todoId })
}
```

- [ ] **Step 4: Run action tests to verify they pass**

Run:

```powershell
cd frontend
npm test -- src/test/aiAssistant.test.tsx
```

Expected: PASS for `confirmAiDraft` tests.

- [ ] **Step 5: Commit confirmation actions**

Run:

```powershell
git add frontend/src/components/ai/aiDraftActions.ts frontend/src/test/aiAssistant.test.tsx
git commit -m "feat: add AI draft confirmation actions"
```

Expected: commit succeeds.

---

### Task 6: Frontend AI Floating Entry And Drawer

**Files:**
- Create: `frontend/src/components/ai/AiConfirmationCard.tsx`
- Create: `frontend/src/components/ai/AIAssistantFloatingEntry.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/test/aiAssistant.test.tsx`

- [ ] **Step 1: Append failing UI tests**

Append these tests to `frontend/src/test/aiAssistant.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AIAssistantFloatingEntry from '../components/ai/AIAssistantFloatingEntry'

const parseCommand = vi.fn()
const createNode = vi.fn()
const createTodo = vi.fn()
const createExpense = vi.fn()
const emitRealtimeEvent = vi.fn()

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    aiAPI: { parseCommand },
    timelineAPI: { ...actual.timelineAPI, createNode },
    todoAPI: { ...actual.todoAPI, createTodo },
    expenseAPI: { ...actual.expenseAPI, createExpense },
  }
})

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ emitRealtimeEvent }),
}))

describe('AIAssistantFloatingEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the AI drawer from a circular entry', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AIAssistantFloatingEntry />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI 对话入口/ }))

    expect(screen.getByText('一句话添加节点/待办/费用')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('例如：增加一个10月1日拍婚纱照的节点')).toBeInTheDocument()
  })

  it('parses a node command and confirms creation', async () => {
    parseCommand.mockResolvedValue({
      data: {
        status: 'ready',
        draft: { actionType: 'create_node', fields: { name: '拍婚纱照', deadline: '2026-10-01' } },
        summary: '将新增节点：拍婚纱照，截止 2026-10-01',
        missingFields: [],
        candidates: {},
      },
    })
    createNode.mockResolvedValue({})

    render(
      <MemoryRouter initialEntries={['/']}>
        <AIAssistantFloatingEntry />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI 对话入口/ }))
    fireEvent.change(screen.getByPlaceholderText('例如：增加一个10月1日拍婚纱照的节点'), {
      target: { value: '增加一个10月1日拍婚纱照的节点' },
    })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))

    expect(await screen.findByText('将新增节点：拍婚纱照，截止 2026-10-01')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '确认添加' }))

    await waitFor(() => {
      expect(createNode).toHaveBeenCalledWith({ name: '拍婚纱照', deadline: '2026-10-01' })
    })
    expect(screen.getByText('创建成功')).toBeInTheDocument()
  })

  it('lets the user choose a node when nodeId is missing', async () => {
    parseCommand.mockResolvedValue({
      data: {
        status: 'needs_input',
        draft: { actionType: 'create_todo', fields: { content: '确认菜单' } },
        summary: '识别到待办：确认菜单。请选择要添加到哪个节点。',
        missingFields: ['nodeId'],
        candidates: { nodes: [{ id: 13, name: '婚宴' }] },
      },
    })
    createTodo.mockResolvedValue({})

    render(
      <MemoryRouter initialEntries={['/']}>
        <AIAssistantFloatingEntry />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI 对话入口/ }))
    fireEvent.change(screen.getByPlaceholderText('例如：增加一个10月1日拍婚纱照的节点'), {
      target: { value: '增加一个确认菜单的待办' },
    })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))

    fireEvent.click(await screen.findByRole('button', { name: '选择 婚宴' }))
    fireEvent.click(screen.getByRole('button', { name: '确认添加' }))

    await waitFor(() => {
      expect(createTodo).toHaveBeenCalledWith({ nodeId: 13, content: '确认菜单', deadline: undefined })
    })
  })

  it('passes currentNodeId on node detail pages', async () => {
    parseCommand.mockResolvedValue({
      data: {
        status: 'unsupported',
        draft: null,
        summary: '暂不支持这个操作。当前只支持新增节点、待办和费用。',
        missingFields: [],
        candidates: {},
      },
    })

    render(
      <MemoryRouter initialEntries={['/node/18']}>
        <Routes>
          <Route path="/node/:id" element={<AIAssistantFloatingEntry />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI 对话入口/ }))
    fireEvent.change(screen.getByPlaceholderText('例如：增加一个10月1日拍婚纱照的节点'), {
      target: { value: '查一下预算' },
    })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))

    await waitFor(() => {
      expect(parseCommand).toHaveBeenCalledWith({
        message: '查一下预算',
        page: 'node-detail',
        currentNodeId: 18,
      })
    })
  })

  it('keeps original input available after parse errors', async () => {
    parseCommand.mockRejectedValue({ response: { data: { error: 'AI 服务暂不可用，请稍后再试' } } })

    render(
      <MemoryRouter initialEntries={['/']}>
        <AIAssistantFloatingEntry />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI 对话入口/ }))
    fireEvent.change(screen.getByPlaceholderText('例如：增加一个10月1日拍婚纱照的节点'), {
      target: { value: '增加一个10月1日拍婚纱照的节点' },
    })
    fireEvent.click(screen.getByRole('button', { name: '解析' }))

    expect(await screen.findByText('AI 服务暂不可用，请稍后再试')).toBeInTheDocument()
    expect(screen.getByDisplayValue('增加一个10月1日拍婚纱照的节点')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run:

```powershell
cd frontend
npm test -- src/test/aiAssistant.test.tsx
```

Expected: FAIL because UI components do not exist.

- [ ] **Step 3: Implement confirmation card**

Create `frontend/src/components/ai/AiConfirmationCard.tsx`:

```tsx
import type { AiParseCommandResponse } from '../../services/api'

type AiConfirmationCardProps = {
  result: AiParseCommandResponse
  onSelectNode: (nodeId: number, nodeName: string) => void
  onSelectTodo: (todoId: number, todoName: string, nodeId: number, nodeName: string) => void
  onConfirm: () => void
  confirming: boolean
}

export default function AiConfirmationCard({
  result,
  onSelectNode,
  onSelectTodo,
  onConfirm,
  confirming,
}: AiConfirmationCardProps) {
  if (result.status === 'unsupported') {
    return (
      <div className="ai-confirmation-card ai-confirmation-card--muted">
        <p>{result.summary}</p>
      </div>
    )
  }

  const draft = result.draft
  if (!draft) {
    return null
  }

  return (
    <div className="ai-confirmation-card">
      <p className="section-label">AI Draft</p>
      <h3 className="section-title">
        {draft.actionType === 'create_node' ? '新增节点' : draft.actionType === 'create_todo' ? '新增待办' : '新增费用'}
      </h3>
      <p className="section-copy">{result.summary}</p>

      {result.candidates.nodes?.length ? (
        <div className="ai-choice-list" aria-label="选择目标节点">
          {result.candidates.nodes.map((node) => (
            <button key={node.id} type="button" onClick={() => onSelectNode(node.id, node.name)}>
              选择 {node.name}
            </button>
          ))}
        </div>
      ) : null}

      {result.candidates.todos?.length ? (
        <div className="ai-choice-list" aria-label="选择目标待办">
          {result.candidates.todos.map((todo) => (
            <button key={todo.id} type="button" onClick={() => onSelectTodo(todo.id, todo.content, todo.nodeId, todo.nodeName)}>
              选择 {todo.nodeName} / {todo.content}
            </button>
          ))}
        </div>
      ) : null}

      <dl className="ai-field-list">
        {Object.entries(draft.fields).map(([key, value]) => (
          value === undefined || value === null ? null : (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          )
        ))}
      </dl>

      <button
        type="button"
        className="brand-primary-button ai-confirm-button"
        onClick={onConfirm}
        disabled={result.status !== 'ready' || confirming}
      >
        {confirming ? '创建中...' : '确认添加'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Implement floating entry and drawer**

Create `frontend/src/components/ai/AIAssistantFloatingEntry.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Popup, Toast } from 'antd-mobile'
import { useLocation, useParams } from 'react-router-dom'
import { aiAPI, expenseAPI, timelineAPI, todoAPI, type AiParseCommandResponse } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import AiConfirmationCard from './AiConfirmationCard'
import { confirmAiDraft } from './aiDraftActions'

function useAiPageContext() {
  const location = useLocation()
  const params = useParams()
  return useMemo(() => {
    if (location.pathname === '/') {
      return { page: 'timeline' as const, currentNodeId: null }
    }
    if (location.pathname.startsWith('/node/')) {
      const nodeId = Number(params.id)
      return { page: 'node-detail' as const, currentNodeId: Number.isInteger(nodeId) ? nodeId : null }
    }
    if (location.pathname.startsWith('/statistics')) {
      return { page: 'statistics' as const, currentNodeId: null }
    }
    if (location.pathname.startsWith('/settings')) {
      return { page: 'settings' as const, currentNodeId: null }
    }
    return { page: 'unknown' as const, currentNodeId: null }
  }, [location.pathname, params.id])
}

export default function AIAssistantFloatingEntry() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<AiParseCommandResponse | null>(null)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pageContext = useAiPageContext()
  const { emitRealtimeEvent } = useAuthStore()

  const parse = async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      Toast.show('请输入要添加的内容')
      return
    }
    setParsing(true)
    setError('')
    try {
      const response = await aiAPI.parseCommand({
        message: trimmed,
        page: pageContext.page,
        currentNodeId: pageContext.currentNodeId,
      })
      setResult(response.data)
    } catch (parseError: any) {
      setError(parseError.response?.data?.error || 'AI 解析失败，请稍后再试')
    } finally {
      setParsing(false)
    }
  }

  const updateResultFields = (fields: Record<string, unknown>, ready: boolean) => {
    setResult((current) => {
      if (!current?.draft) {
        return current
      }
      return {
        ...current,
        status: ready ? 'ready' : current.status,
        draft: {
          ...current.draft,
          fields: { ...current.draft.fields, ...fields },
        },
        missingFields: ready ? [] : current.missingFields,
      }
    })
  }

  const confirm = async () => {
    if (!result) {
      return
    }
    setConfirming(true)
    try {
      await confirmAiDraft({
        result,
        timelineAPI,
        todoAPI,
        expenseAPI,
        emitRealtimeEvent,
      })
      setResult(null)
      setMessage('')
      Toast.show('创建成功')
      setError('')
    } catch (confirmError: any) {
      setError(confirmError.message || '创建失败')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="ai-floating-entry"
        aria-label="AI 对话入口，一句话添加节点待办费用"
        onClick={() => setVisible(true)}
      >
        <span>AI</span>
        <small>一句话</small>
      </button>

      <Popup
        visible={visible}
        onMaskClick={() => setVisible(false)}
        bodyClassName="ai-assistant-popup"
        bodyStyle={{ borderTopLeftRadius: 30, borderTopRightRadius: 30 }}
      >
        <section className="ai-assistant-drawer">
          <div className="ai-assistant-drawer__handle" aria-hidden="true" />
          <header className="ai-assistant-drawer__header">
            <div>
              <p className="section-label">AI Assistant</p>
              <h2 className="section-title">一句话添加节点/待办/费用</h2>
              <p className="section-copy">我会先整理成草稿，确认后才会创建。</p>
            </div>
            <button type="button" className="brand-secondary-button" onClick={() => setVisible(false)}>
              关闭
            </button>
          </header>

          <div className="ai-input-panel">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="例如：增加一个10月1日拍婚纱照的节点"
              className="themed-textarea"
            />
            <button type="button" className="brand-primary-button" onClick={parse} disabled={parsing}>
              {parsing ? '解析中...' : '解析'}
            </button>
          </div>

          {error ? <div className="ai-error-message">{error}</div> : null}
          {result ? (
            <AiConfirmationCard
              result={result}
              confirming={confirming}
              onSelectNode={(nodeId, nodeName) => updateResultFields({ nodeId, nodeName }, true)}
              onSelectTodo={(todoId, todoName, nodeId, nodeName) => updateResultFields({ todoId, todoName, nodeId, nodeName }, true)}
              onConfirm={confirm}
            />
          ) : null}
        </section>
      </Popup>
    </>
  )
}
```

- [ ] **Step 5: Render assistant from AppShell**

Modify `frontend/src/components/layout/AppShell.tsx`:

```tsx
import type { PropsWithChildren, ReactNode } from 'react'
import AIAssistantFloatingEntry from '../ai/AIAssistantFloatingEntry'
import BottomNav from './BottomNav'

type AppShellProps = PropsWithChildren<{
  header?: ReactNode
  withBottomNav?: boolean
  contentClassName?: string
}>

export default function AppShell({ children, header, withBottomNav = false, contentClassName = '' }: AppShellProps) {
  const contentClasses = ['app-shell__content', contentClassName].filter(Boolean).join(' ')

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true" />
      {header ? <div className="app-shell__header">{header}</div> : null}
      <main className={contentClasses}>{children}</main>
      <AIAssistantFloatingEntry />
      {withBottomNav ? <BottomNav /> : null}
    </div>
  )
}
```

- [ ] **Step 6: Add AI styles**

Append to `frontend/src/index.css` before the media queries:

```css
.ai-floating-entry {
  position: fixed;
  right: max(18px, calc((100vw - 980px) / 2 + 22px));
  bottom: calc(112px + env(safe-area-inset-bottom));
  z-index: 12;
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(200, 160, 98, 0.42);
  border-radius: 999px;
  background:
    radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.46), transparent 24%),
    linear-gradient(145deg, #0f3d34 0%, #092a25 100%);
  color: #fff8f1;
  box-shadow: 0 18px 40px rgba(15, 61, 52, 0.28);
}

.ai-floating-entry span {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.25rem;
  line-height: 1;
}

.ai-floating-entry small {
  margin-top: -14px;
  font-size: 0.72rem;
  color: rgba(255, 248, 241, 0.82);
}

.ai-assistant-drawer {
  min-height: 72dvh;
  max-height: 90dvh;
  display: grid;
  gap: 18px;
  overflow-y: auto;
  padding: 16px 20px calc(22px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at top right, rgba(200, 160, 98, 0.2), transparent 30%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.99) 0%, rgba(246, 238, 229, 0.98) 100%);
  color: var(--text-primary);
}

.ai-assistant-drawer__handle {
  width: 54px;
  height: 5px;
  margin: 0 auto;
  border-radius: 999px;
  background: rgba(15, 61, 52, 0.18);
}

.ai-assistant-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.ai-input-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(15, 61, 52, 0.12);
  border-radius: 24px;
  background: rgba(255, 253, 249, 0.9);
}

.ai-error-message {
  padding: 12px 14px;
  border: 1px solid rgba(127, 23, 48, 0.14);
  border-radius: 18px;
  background: rgba(127, 23, 48, 0.08);
  color: #7f1730;
}

.ai-confirmation-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(15, 61, 52, 0.14);
  border-radius: 26px;
  background:
    radial-gradient(circle at top right, rgba(200, 160, 98, 0.14), transparent 26%),
    rgba(255, 253, 249, 0.94);
  box-shadow: 0 16px 36px rgba(62, 22, 30, 0.1);
}

.ai-confirmation-card--muted {
  border-style: dashed;
  color: var(--text-secondary);
}

.ai-choice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-choice-list button {
  min-height: 40px;
  padding: 0 13px;
  border: 1px solid rgba(15, 61, 52, 0.16);
  border-radius: 999px;
  background: rgba(15, 61, 52, 0.08);
  color: #0f3d34;
}

.ai-field-list {
  display: grid;
  gap: 8px;
}

.ai-field-list div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-top: 1px solid rgba(112, 84, 90, 0.1);
}

.ai-field-list dt {
  color: var(--text-secondary);
}

.ai-field-list dd {
  color: var(--text-primary);
  font-weight: 600;
}

.ai-confirm-button {
  width: 100%;
}
```

- [ ] **Step 7: Run UI tests to verify they pass**

Run:

```powershell
cd frontend
npm test -- src/test/aiAssistant.test.tsx
```

Expected: PASS for action and UI tests.

- [ ] **Step 8: Run frontend suite and build**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: PASS for tests and successful Vite build.

- [ ] **Step 9: Commit frontend assistant UI**

Run:

```powershell
git add frontend/src/components/ai/AiConfirmationCard.tsx frontend/src/components/ai/AIAssistantFloatingEntry.tsx frontend/src/components/layout/AppShell.tsx frontend/src/index.css frontend/src/test/aiAssistant.test.tsx
git commit -m "feat: add AI assistant drawer"
```

Expected: commit succeeds.

---

### Task 7: Final Integration Verification

**Files:**
- Modify only if verification exposes a concrete failure in files from Tasks 1-6.

- [ ] **Step 1: Run complete backend verification**

Run:

```powershell
cd backend
npm test
npm run build
```

Expected: backend tests pass and TypeScript build succeeds.

- [ ] **Step 2: Run complete frontend verification**

Run:

```powershell
cd frontend
npm test
npm run build
```

Expected: frontend tests pass and TypeScript/Vite build succeeds.

- [ ] **Step 3: Manual smoke test with disabled provider**

Run the backend without `AI_API_KEY`, start the frontend, log in, open the AI drawer, and submit:

```text
增加一个10月1日拍婚纱照的节点
```

Expected: the drawer shows `AI 服务暂不可用，请稍后再试`, keeps the original text in the input, and no node is created.

- [ ] **Step 4: Manual smoke test with configured provider**

Set these environment variables for OpenAI or MiniMax, then restart the backend:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
AI_API_KEY=real-key
AI_BASE_URL=
AI_TIMEOUT_MS=15000
```

Submit:

```text
增加一个10月1日拍婚纱照的节点
```

Expected: confirmation card shows `新增节点`, `拍婚纱照`, and `2026-10-01`. Clicking `确认添加` creates the node and shows `创建成功`.

- [ ] **Step 5: Manual smoke test for missing target selection**

Submit:

```text
增加一个确认菜单的待办
```

Expected: the drawer asks for a target node. Selecting a node enables `确认添加`; confirmation creates a todo under that node.

- [ ] **Step 6: Commit verification fixes if any files changed**

If a concrete verification failure required code changes, run:

```powershell
git add backend frontend
git commit -m "fix: stabilize AI assistant integration"
```

Expected: commit succeeds only when verification required changes. If no files changed, skip this commit.

---

## Self-Review

Spec coverage:

- Circular floating AI entry: Task 6.
- Conversation drawer and clear AI entry copy: Task 6.
- Provider switching by environment variables for OpenAI and MiniMax: Task 2.
- Parse-confirm-write architecture with no direct model writes: Tasks 1, 3, 5, 6.
- Create node, todo, and expense drafts: Tasks 1, 5, 6.
- `nodeId` and `todoId` loaded from user context and validated against data owner: Tasks 1, 2, 3.
- Date normalization contract and current-date prompt context: Tasks 2 and 3.
- `POST /api/ai/parse-command`: Task 3.
- Frontend calls existing create APIs: Task 5.
- Friendly error handling and input preservation: Tasks 3 and 6.
- End-to-end examples from the design document: Task 1 tests, Task 6 tests, Task 7 smoke tests.

Placeholder scan:

- No placeholder markers are intentionally left in this plan.
- Every file creation step includes concrete code.
- Every test step includes command and expected result.

Type consistency:

- Backend and frontend both use `AiParseResult`/`AiParseCommandResponse` with `status`, `draft`, `summary`, `missingFields`, and `candidates`.
- Action names are consistently `create_node`, `create_todo`, and `create_expense`.
- Draft field names are consistently `nodeId`, `todoId`, `deadline`, `amount`, `category`, `description`, `name`, and `content`.
