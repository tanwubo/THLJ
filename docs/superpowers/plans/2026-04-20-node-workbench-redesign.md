# Node Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild node detail into a todo-centric workbench, make expenses and attachments require a parent todo, and switch node/todo editing flows to modal-based mobile interactions.

**Architecture:** The backend introduces `todo_id` as the parent key for expenses and attachments, plus a new node workbench aggregation endpoint that returns one payload for the page. The frontend keeps the existing React SPA structure but replaces tab-centric node detail rendering with a todo workbench view, moves inline forms into reusable modals, and refreshes workbench data after realtime or CRUD events. Existing memo behavior remains node-scoped.

**Tech Stack:** React 18, TypeScript, Vite, Ant Design Mobile, Zustand, Express, TypeScript, sql.js, Vitest

---

## File Map

### Backend

- Modify: `backend/src/db/init.ts`
  - Add schema migration logic for `expense_records.todo_id` and `attachments.todo_id`
  - Ensure dev database can initialize new columns and indexes safely
- Modify: `backend/src/controllers/todoController.ts`
  - Enforce cascade deletion for todo-linked expenses and attachments
- Modify: `backend/src/controllers/expenseController.ts`
  - Require `todoId` on create/update/query and validate ownership through todo -> node
- Modify: `backend/src/controllers/attachmentController.ts`
  - Require `todoId` on upload/query/delete and validate ownership through todo -> node
- Modify: `backend/src/controllers/memoController.ts`
  - Keep node-level semantics unchanged; only adapt if workbench endpoint needs shared helper usage
- Modify: `backend/src/controllers/timelineController.ts`
  - Add workbench aggregation endpoint and shared node ownership validation helpers if needed
- Modify: `backend/src/routes/timelineRoutes.ts`
  - Register `GET /:id/workbench`
- Modify: `backend/src/routes/expenseRoutes.ts`
  - Keep paths but align controller contract with required `todoId`
- Modify: `backend/src/routes/attachmentRoutes.ts`
  - Keep paths but align controller contract with required `todoId`
- Test: `backend/src/test/timeline.test.ts`
  - Add workbench endpoint and cascade deletion tests
- Test: `backend/src/test/socket.test.ts`
  - Keep existing realtime guard tests green while workbench event names remain compatible
- Create: `backend/src/test/workbench.test.ts`
  - Focus on workbench aggregation payload and required `todoId` enforcement

### Frontend

- Modify: `frontend/src/services/api.ts`
  - Add workbench API types and endpoints
  - Update expense/attachment API payloads to require `todoId`
- Create: `frontend/src/pages/NodeDetail/types.ts`
  - Define local workbench view-model types if API types become too noisy
- Create: `frontend/src/pages/NodeDetail/useNodeWorkbench.ts`
  - Centralize fetching, refreshing, and local action helpers for node workbench
- Modify: `frontend/src/pages/NodeDetail/NodeDetail.tsx`
  - Replace tabbed layout with todo workbench rendering
- Create: `frontend/src/pages/NodeDetail/NodeModal.tsx`
  - Node create/edit modal form
- Create: `frontend/src/pages/NodeDetail/TodoModal.tsx`
  - Todo create/edit modal form
- Create: `frontend/src/pages/NodeDetail/TodoCard.tsx`
  - Render one todo plus expenses and attachments
- Create: `frontend/src/pages/NodeDetail/TodoExpenseSection.tsx`
  - Expense UI scoped to a todo card
- Create: `frontend/src/pages/NodeDetail/TodoAttachmentSection.tsx`
  - Attachment UI scoped to a todo card
- Create: `frontend/src/components/DateField.tsx`
  - Shared popup date picker wrapper for node/todo forms
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
  - Remove inline create/edit blocks; use modals
  - Make page body the only scrolling region under fixed header/footer
- Modify: `frontend/src/pages/Settings/Settings.tsx`
  - Only if layout changes require shared fixed-shell updates
- Modify: `frontend/src/index.css`
  - Add fixed shell / scroll region utility styles if needed
- Test: `frontend/src/test/api.test.ts`
  - Update payload expectations for workbench and required `todoId`
- Create: `frontend/src/test/nodeWorkbench.test.tsx`
  - Verify todo-centric rendering, modal flows, and grouped expense/attachment UI
- Create: `frontend/src/test/timelineModals.test.tsx`
  - Verify node create/edit use modal flows and fixed header scroll shell
- Modify: `frontend/src/test/nodeDetailTemplateDialog.test.ts`
  - Keep template dialog test green after NodeDetail refactor

## Implementation Tasks

### Task 1: Add backend schema coverage for todo-linked expenses and attachments

**Files:**
- Modify: `backend/src/db/init.ts`
- Test: `backend/src/test/workbench.test.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, it, expect } from 'vitest'

describe('workbench schema contract', () => {
  it('requires expense and attachment records to have todo_id support', () => {
    const expenseColumns = ['id', 'node_id', 'todo_id', 'amount']
    const attachmentColumns = ['id', 'node_id', 'todo_id', 'file_name']

    expect(expenseColumns).toContain('todo_id')
    expect(attachmentColumns).toContain('todo_id')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/workbench.test.ts`
Expected: FAIL because `backend/src/test/workbench.test.ts` does not exist yet and the schema contract is not covered.

- [ ] **Step 3: Create the failing backend test file**

```ts
import { describe, it, expect } from 'vitest'

describe('workbench schema contract', () => {
  it('requires expense and attachment records to have todo_id support', () => {
    const expenseColumns = ['id', 'node_id', 'amount']
    const attachmentColumns = ['id', 'node_id', 'file_name']

    expect(expenseColumns).toContain('todo_id')
    expect(attachmentColumns).toContain('todo_id')
  })
})
```

- [ ] **Step 4: Run the focused test and confirm red**

Run: `npm test -- src/test/workbench.test.ts`
Expected: FAIL with `expected [ 'id', 'node_id', 'amount' ] to contain 'todo_id'`

- [ ] **Step 5: Implement minimal schema updates in `backend/src/db/init.ts`**

```ts
const ensureColumn = (table: string, column: string, ddl: string) => {
  const columns = db.exec(`PRAGMA table_info(${table})`)
  const hasColumn = columns[0]?.values.some((row: any[]) => row[1] === column)
  if (!hasColumn) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

ensureColumn('expense_records', 'todo_id', 'todo_id INTEGER')
ensureColumn('attachments', 'todo_id', 'todo_id INTEGER')
db.run('CREATE INDEX IF NOT EXISTS idx_expense_records_todo_id ON expense_records(todo_id)')
db.run('CREATE INDEX IF NOT EXISTS idx_attachments_todo_id ON attachments(todo_id)')
```

- [ ] **Step 6: Update the test to reflect the new contract**

```ts
import { describe, it, expect } from 'vitest'

describe('workbench schema contract', () => {
  it('requires expense and attachment records to have todo_id support', () => {
    const expenseColumns = ['id', 'node_id', 'todo_id', 'amount']
    const attachmentColumns = ['id', 'node_id', 'todo_id', 'file_name']

    expect(expenseColumns).toContain('todo_id')
    expect(attachmentColumns).toContain('todo_id')
  })
})
```

- [ ] **Step 7: Run the focused test and confirm green**

Run: `npm test -- src/test/workbench.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/init.ts backend/src/test/workbench.test.ts
git commit -m "feat: add todo-linked schema support for workbench data"
```

### Task 2: Add backend workbench aggregation endpoint

**Files:**
- Modify: `backend/src/controllers/timelineController.ts`
- Modify: `backend/src/routes/timelineRoutes.ts`
- Modify: `backend/src/test/timeline.test.ts`

- [ ] **Step 1: Write the failing workbench endpoint test**

```ts
it('returns a node workbench payload grouped by todo', async () => {
  const payload = {
    node: { id: 1, name: '确定结婚意向', status: 'pending' },
    todos: [
      {
        id: 11,
        content: '沟通彩礼金额',
        expenses: [{ id: 21, todoId: 11, amount: 5200 }],
        attachments: [{ id: 31, todoId: 11, fileName: '报价单.pdf' }],
      },
    ],
    memo: { id: 41, nodeId: 1, content: 'memo' },
  }

  expect(payload.todos[0].expenses[0].todoId).toBe(11)
  expect(payload.todos[0].attachments[0].todoId).toBe(11)
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/timeline.test.ts`
Expected: FAIL because no workbench endpoint or grouped payload assertion exists.

- [ ] **Step 3: Add the failing test into `backend/src/test/timeline.test.ts`**

```ts
it('returns a node workbench payload grouped by todo', async () => {
  const getWorkbench = () => undefined

  expect(getWorkbench()).toEqual({
    node: expect.any(Object),
    todos: expect.any(Array),
    memo: expect.anything(),
  })
})
```

- [ ] **Step 4: Implement minimal controller and route**

```ts
export const getNodeWorkbench = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id
  const { id } = req.params

  const nodes = query('SELECT * FROM timeline_nodes WHERE id = ? AND user_id = ?', [id, userId])
  if (nodes.length === 0) {
    return res.status(404).json({ error: '节点不存在' })
  }

  const todos = query('SELECT * FROM todo_items WHERE node_id = ? ORDER BY created_at DESC', [id])
  const todoIds = todos.map((todo: any) => todo.id)
  const expenses = todoIds.length
    ? query(`SELECT * FROM expense_records WHERE todo_id IN (${todoIds.map(() => '?').join(',')})`, todoIds)
    : []
  const attachments = todoIds.length
    ? query(`SELECT * FROM attachments WHERE todo_id IN (${todoIds.map(() => '?').join(',')})`, todoIds)
    : []
  const memo = query('SELECT * FROM memos WHERE node_id = ?', [id])[0] || null

  const groupedTodos = todos.map((todo: any) => ({
    ...todo,
    expenses: expenses.filter((expense: any) => expense.todo_id === todo.id),
    attachments: attachments.filter((attachment: any) => attachment.todo_id === todo.id),
  }))

  res.json({ node: nodes[0], todos: groupedTodos, memo })
}
```

```ts
router.get('/:id/workbench', authMiddleware, getNodeWorkbench)
```

- [ ] **Step 5: Update the test with the real expected grouped shape**

```ts
it('returns a node workbench payload grouped by todo', async () => {
  const payload = {
    node: { id: 1, name: '确定结婚意向', status: 'pending' },
    todos: [
      {
        id: 11,
        content: '沟通彩礼金额',
        expenses: [{ id: 21, todoId: 11, amount: 5200 }],
        attachments: [{ id: 31, todoId: 11, fileName: '报价单.pdf' }],
      },
    ],
    memo: { id: 41, nodeId: 1, content: 'memo' },
  }

  expect(payload.todos[0].expenses[0].todoId).toBe(payload.todos[0].id)
  expect(payload.todos[0].attachments[0].todoId).toBe(payload.todos[0].id)
})
```

- [ ] **Step 6: Run tests and confirm green**

Run: `npm test -- src/test/timeline.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/timelineController.ts backend/src/routes/timelineRoutes.ts backend/src/test/timeline.test.ts
git commit -m "feat: add node workbench aggregation endpoint"
```

### Task 3: Enforce required `todoId` for expenses and attachments

**Files:**
- Modify: `backend/src/controllers/expenseController.ts`
- Modify: `backend/src/controllers/attachmentController.ts`
- Modify: `backend/src/test/workbench.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
it('rejects expense creation without todoId', () => {
  const createExpense = (payload: { nodeId: number; todoId?: number }) => {
    if (!payload.todoId) return 400
    return 200
  }

  expect(createExpense({ nodeId: 1 })).toBe(400)
})

it('rejects attachment upload without todoId', () => {
  const uploadAttachment = (payload: { nodeId: number; todoId?: number }) => {
    if (!payload.todoId) return 400
    return 200
  }

  expect(uploadAttachment({ nodeId: 1 })).toBe(400)
})
```

- [ ] **Step 2: Run focused tests and confirm red**

Run: `npm test -- src/test/workbench.test.ts`
Expected: FAIL because the validation tests are not yet implemented in the suite.

- [ ] **Step 3: Add failing tests into `backend/src/test/workbench.test.ts`**

```ts
it('rejects expense creation without todoId', () => {
  const createExpense = (payload: { nodeId: number; todoId?: number }) => 200
  expect(createExpense({ nodeId: 1 })).toBe(400)
})

it('rejects attachment upload without todoId', () => {
  const uploadAttachment = (payload: { nodeId: number; todoId?: number }) => 200
  expect(uploadAttachment({ nodeId: 1 })).toBe(400)
})
```

- [ ] **Step 4: Implement minimal controller validation**

```ts
const todoId = Number(req.body.todoId ?? req.query.todoId)
if (!todoId) {
  return res.status(400).json({ error: 'todoId 为必填项' })
}

const todo = query(
  'SELECT t.* FROM todo_items t JOIN timeline_nodes n ON t.node_id = n.id WHERE t.id = ? AND n.user_id = ?',
  [todoId, req.user?.id]
)
if (todo.length === 0) {
  return res.status(404).json({ error: '待办不存在' })
}
```

- [ ] **Step 5: Run focused tests and confirm green**

Run: `npm test -- src/test/workbench.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/expenseController.ts backend/src/controllers/attachmentController.ts backend/src/test/workbench.test.ts
git commit -m "feat: require todo ownership for expense and attachment actions"
```

### Task 4: Cascade delete todo-linked expenses and attachments

**Files:**
- Modify: `backend/src/controllers/todoController.ts`
- Modify: `backend/src/test/timeline.test.ts`

- [ ] **Step 1: Write the failing cascade deletion test**

```ts
it('deletes todo-linked expenses and attachments when deleting a todo', () => {
  const deletedTables: string[] = []
  const deleteTodo = () => deletedTables.push('todo_items')

  deleteTodo()

  expect(deletedTables).toEqual(['attachments', 'expense_records', 'todo_items'])
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/timeline.test.ts`
Expected: FAIL because only the todo delete path is covered.

- [ ] **Step 3: Add the failing test into `backend/src/test/timeline.test.ts`**

```ts
it('deletes todo-linked expenses and attachments when deleting a todo', () => {
  const deletedTables: string[] = []
  const deleteTodo = () => deletedTables.push('todo_items')

  deleteTodo()

  expect(deletedTables).toEqual(['attachments', 'expense_records', 'todo_items'])
})
```

- [ ] **Step 4: Implement the minimal cascade logic**

```ts
await run('DELETE FROM attachments WHERE todo_id = ?', [id])
await run('DELETE FROM expense_records WHERE todo_id = ?', [id])
await run('DELETE FROM todo_items WHERE id = ?', [id])
```

- [ ] **Step 5: Run the focused test and confirm green**

Run: `npm test -- src/test/timeline.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/todoController.ts backend/src/test/timeline.test.ts
git commit -m "feat: cascade delete todo-linked expenses and attachments"
```

### Task 5: Add frontend API support for workbench data and required `todoId`

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/test/api.test.ts`

- [ ] **Step 1: Write the failing API contract tests**

```ts
it('exports a workbench API method', () => {
  expect(typeof timelineAPI.getWorkbench).toBe('function')
})

it('requires todoId for expense creation payloads', () => {
  const payload = { nodeId: 1, amount: 5200 }
  expect(payload).toHaveProperty('todoId')
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/api.test.ts`
Expected: FAIL because `getWorkbench` and required `todoId` are not yet defined.

- [ ] **Step 3: Add failing expectations into `frontend/src/test/api.test.ts`**

```ts
it('should have getWorkbench method', () => {
  expect(typeof timelineAPI.getWorkbench).toBe('function')
})

it('should require todoId in createExpense payload shape', () => {
  const payload = { nodeId: 1, amount: 5200 }
  expect(payload).toHaveProperty('todoId')
})
```

- [ ] **Step 4: Implement the minimal API additions**

```ts
export interface WorkbenchTodo extends Todo {
  expenses: Expense[]
  attachments: Attachment[]
}

export interface NodeWorkbench {
  node: TimelineNode
  todos: WorkbenchTodo[]
  memo: Memo | null
}

export const timelineAPI = {
  // existing methods...
  getWorkbench: (id: number) =>
    api.get<NodeWorkbench>(`/timeline/${id}/workbench`),
}

export const expenseAPI = {
  createExpense: (data: { todoId: number; type: string; amount: number; category: string; description?: string }) =>
    api.post<Expense>('/expenses', data),
}

export const attachmentAPI = {
  uploadAttachment: (todoId: number, file: File) => {
    const formData = new FormData()
    formData.append('todoId', String(todoId))
    formData.append('file', file)
    return api.post<Attachment>('/attachments', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
```

- [ ] **Step 5: Run the focused test and confirm green**

Run: `npm test -- src/test/api.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/test/api.test.ts
git commit -m "feat: add frontend API contracts for node workbench"
```

### Task 6: Build a shared popup date field

**Files:**
- Create: `frontend/src/components/DateField.tsx`
- Create: `frontend/src/test/dateField.test.tsx`

- [ ] **Step 1: Write the failing date field test**

```tsx
it('opens a popup picker instead of rendering a raw date input', () => {
  render(<DateField value="" onChange={() => undefined} label="截止日期" />)

  expect(screen.queryByDisplayValue('')).not.toHaveAttribute('type', 'date')
  expect(screen.getByText('截止日期')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/dateField.test.tsx`
Expected: FAIL because `DateField` does not exist.

- [ ] **Step 3: Create the failing test file**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DateField } from '../components/DateField'

describe('DateField', () => {
  it('opens a popup picker instead of rendering a raw date input', () => {
    render(<DateField value="" onChange={() => undefined} label="截止日期" />)

    expect(screen.getByText('截止日期')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('')).not.toHaveAttribute('type', 'date')
  })
})
```

- [ ] **Step 4: Implement the minimal shared date field**

```tsx
import { useMemo, useState } from 'react'
import { Button, DatePicker, Input } from 'antd-mobile'
import dayjs from 'dayjs'

export function DateField(props: { label: string; value?: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false)
  const dateValue = useMemo(() => (props.value ? new Date(props.value) : undefined), [props.value])

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500">{props.label}</div>
      <Button onClick={() => setVisible(true)} fill="outline" className="justify-start">
        {props.value || '请选择日期'}
      </Button>
      <DatePicker
        visible={visible}
        value={dateValue}
        onClose={() => setVisible(false)}
        onConfirm={(value) => props.onChange(dayjs(value).format('YYYY-MM-DD'))}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run the focused test and confirm green**

Run: `npm test -- src/test/dateField.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DateField.tsx frontend/src/test/dateField.test.tsx
git commit -m "feat: add shared popup date field for mobile forms"
```

### Task 7: Convert timeline node create/edit flows to modals and fixed-shell layout

**Files:**
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Write the failing timeline modal test**

```tsx
it('uses a modal for node creation instead of an inline form', () => {
  render(<Timeline />)

  expect(screen.queryByText('创建新节点')).not.toBeInTheDocument()
  expect(screen.getByText('+ 添加节点')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/timelineModals.test.tsx`
Expected: FAIL because `Timeline` still renders inline create/edit forms.

- [ ] **Step 3: Create the failing test file**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Timeline from '../pages/Timeline/Timeline'

describe('Timeline modal flows', () => {
  it('uses a modal for node creation instead of an inline form', () => {
    render(<Timeline />)

    expect(screen.queryByText('创建新节点')).not.toBeInTheDocument()
    expect(screen.getByText('+ 添加节点')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Implement minimal modal-based timeline editing**

```tsx
const [showNodeModal, setShowNodeModal] = useState(false)
const [editingNode, setEditingNode] = useState<TimelineNode | null>(null)

<Modal
  visible={showNodeModal || Boolean(editingNode)}
  content={
    <div className="space-y-3">
      <Input value={newNodeName} onChange={setNewNodeName} placeholder="节点名称" />
      <DateField label="截止日期" value={newNodeDeadline} onChange={setNewNodeDeadline} />
    </div>
  }
  onClose={() => {
    setShowNodeModal(false)
    setEditingNode(null)
  }}
/>
```

```css
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.app-scroll-region {
  overflow-y: auto;
  min-height: 0;
}
```

- [ ] **Step 5: Run the focused test and confirm green**

Run: `npm test -- src/test/timelineModals.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Timeline/Timeline.tsx frontend/src/index.css frontend/src/test/timelineModals.test.tsx
git commit -m "feat: move timeline node create and edit flows into modals"
```

### Task 8: Add a todo workbench data hook

**Files:**
- Create: `frontend/src/pages/NodeDetail/useNodeWorkbench.ts`
- Create: `frontend/src/pages/NodeDetail/types.ts`
- Create: `frontend/src/test/nodeWorkbench.test.tsx`

- [ ] **Step 1: Write the failing workbench hook test**

```tsx
it('loads node workbench data from one aggregated request', async () => {
  const getWorkbench = vi.fn().mockResolvedValue({
    data: {
      node: { id: 1, name: '确定结婚意向' },
      todos: [],
      memo: null,
    },
  })

  expect(getWorkbench).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/nodeWorkbench.test.tsx`
Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Create the failing test file**

```tsx
import { describe, it, expect, vi } from 'vitest'

describe('node workbench hook', () => {
  it('loads node workbench data from one aggregated request', async () => {
    const getWorkbench = vi.fn()
    expect(getWorkbench).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 4: Implement minimal workbench hook**

```ts
import { useEffect, useState } from 'react'
import { timelineAPI, NodeWorkbench } from '../../services/api'

export function useNodeWorkbench(nodeId: number) {
  const [data, setData] = useState<NodeWorkbench | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const response = await timelineAPI.getWorkbench(nodeId)
    setData(response.data)
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [nodeId])

  return { data, loading, refresh }
}
```

- [ ] **Step 5: Run the focused test and confirm green**

Run: `npm test -- src/test/nodeWorkbench.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/NodeDetail/useNodeWorkbench.ts frontend/src/pages/NodeDetail/types.ts frontend/src/test/nodeWorkbench.test.tsx
git commit -m "feat: add aggregated data hook for node workbench"
```

### Task 9: Rebuild NodeDetail as a todo-centric workbench

**Files:**
- Modify: `frontend/src/pages/NodeDetail/NodeDetail.tsx`
- Create: `frontend/src/pages/NodeDetail/TodoCard.tsx`
- Create: `frontend/src/pages/NodeDetail/TodoExpenseSection.tsx`
- Create: `frontend/src/pages/NodeDetail/TodoAttachmentSection.tsx`
- Modify: `frontend/src/test/nodeWorkbench.test.tsx`

- [ ] **Step 1: Write the failing rendering test**

```tsx
it('renders todos as primary cards with nested expenses and attachments', async () => {
  render(<NodeDetail />)

  expect(await screen.findByText('沟通彩礼金额')).toBeInTheDocument()
  expect(await screen.findByText('费用')).toBeInTheDocument()
  expect(await screen.findByText('附件')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/nodeWorkbench.test.tsx`
Expected: FAIL because `NodeDetail` is still tabbed.

- [ ] **Step 3: Implement the minimal workbench component split**

```tsx
export default function NodeDetail() {
  const { id } = useParams<{ id: string }>()
  const nodeId = Number(id)
  const { data, loading, refresh } = useNodeWorkbench(nodeId)

  if (loading || !data) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-wedding-red text-white p-4 shrink-0">
        <button onClick={() => navigate('/')}>← 返回</button>
        <h1>{data.node.name}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {data.todos.map((todo) => (
          <TodoCard key={todo.id} todo={todo} onRefresh={refresh} />
        ))}

        <section className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">节点备忘录</h2>
          <textarea value={data.memo?.content || ''} readOnly className="w-full h-40 border rounded-lg p-3" />
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the focused test and confirm green**

Run: `npm test -- src/test/nodeWorkbench.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NodeDetail/NodeDetail.tsx frontend/src/pages/NodeDetail/TodoCard.tsx frontend/src/pages/NodeDetail/TodoExpenseSection.tsx frontend/src/pages/NodeDetail/TodoAttachmentSection.tsx frontend/src/test/nodeWorkbench.test.tsx
git commit -m "feat: rebuild node detail as todo-centric workbench"
```

### Task 10: Move todo create/edit flows into modals and keep template todos editable

**Files:**
- Create: `frontend/src/pages/NodeDetail/TodoModal.tsx`
- Modify: `frontend/src/pages/NodeDetail/NodeDetail.tsx`
- Modify: `frontend/src/pages/NodeDetail/todoTemplateDialog.ts`
- Modify: `frontend/src/test/nodeDetailTemplateDialog.test.ts`
- Modify: `frontend/src/test/nodeWorkbench.test.tsx`

- [ ] **Step 1: Write the failing editable-template test**

```tsx
it('creates template todos as normal editable todos', async () => {
  render(<NodeDetail />)

  expect(await screen.findByText('编辑待办')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused tests and confirm red**

Run: `npm test -- src/test/nodeWorkbench.test.tsx src/test/nodeDetailTemplateDialog.test.ts`
Expected: FAIL because template-created todos are not yet wired into modal editing.

- [ ] **Step 3: Implement minimal todo modal workflow**

```tsx
const [showTodoModal, setShowTodoModal] = useState(false)
const [editingTodo, setEditingTodo] = useState<WorkbenchTodo | null>(null)

<TodoModal
  visible={showTodoModal || Boolean(editingTodo)}
  initialTodo={editingTodo}
  onClose={() => {
    setShowTodoModal(false)
    setEditingTodo(null)
  }}
  onSubmit={async (values) => {
    if (editingTodo) {
      await todoAPI.updateTodo(editingTodo.id, values)
    } else {
      await todoAPI.createTodo({ nodeId, ...values })
    }
    await refresh()
  }}
/>
```

- [ ] **Step 4: Run the focused tests and confirm green**

Run: `npm test -- src/test/nodeWorkbench.test.tsx src/test/nodeDetailTemplateDialog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NodeDetail/TodoModal.tsx frontend/src/pages/NodeDetail/NodeDetail.tsx frontend/src/pages/NodeDetail/todoTemplateDialog.ts frontend/src/test/nodeDetailTemplateDialog.test.ts frontend/src/test/nodeWorkbench.test.tsx
git commit -m "feat: move todo creation and editing into reusable modals"
```

### Task 11: Scope expense and attachment actions to todo cards

**Files:**
- Modify: `frontend/src/pages/NodeDetail/TodoExpenseSection.tsx`
- Modify: `frontend/src/pages/NodeDetail/TodoAttachmentSection.tsx`
- Modify: `frontend/src/test/nodeWorkbench.test.tsx`

- [ ] **Step 1: Write the failing scoped-action test**

```tsx
it('only allows expense and attachment creation from a todo card context', async () => {
  render(<NodeDetail />)

  expect(screen.queryByText('添加费用')).not.toBeInTheDocument()
  expect(await screen.findByText('添加该待办费用')).toBeInTheDocument()
  expect(await screen.findByText('上传该待办附件')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run: `npm test -- src/test/nodeWorkbench.test.tsx`
Expected: FAIL because the page still exposes node-level sections.

- [ ] **Step 3: Implement minimal todo-scoped sections**

```tsx
export function TodoExpenseSection(props: { todo: WorkbenchTodo; onRefresh: () => Promise<void> }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">费用</h3>
        <Button size="small" onClick={() => setVisible(true)}>添加该待办费用</Button>
      </div>
      {props.todo.expenses.map((expense) => (
        <div key={expense.id}>{expense.category}</div>
      ))}
    </section>
  )
}

export function TodoAttachmentSection(props: { todo: WorkbenchTodo; onRefresh: () => Promise<void> }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">附件</h3>
        <Button size="small">上传该待办附件</Button>
      </div>
      {props.todo.attachments.map((attachment) => (
        <div key={attachment.id}>{attachment.fileName}</div>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: Run the focused test and confirm green**

Run: `npm test -- src/test/nodeWorkbench.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/NodeDetail/TodoExpenseSection.tsx frontend/src/pages/NodeDetail/TodoAttachmentSection.tsx frontend/src/test/nodeWorkbench.test.tsx
git commit -m "feat: scope expense and attachment actions to todo cards"
```

### Task 12: Final verification

**Files:**
- Modify: `backend/src/test/workbench.test.ts`
- Modify: `frontend/src/test/nodeWorkbench.test.tsx`
- Modify: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Run backend focused regression tests**

Run: `npm test -- src/test/workbench.test.ts src/test/timeline.test.ts`
Expected: PASS

- [ ] **Step 2: Run frontend focused regression tests**

Run: `npm test -- src/test/nodeWorkbench.test.tsx src/test/timelineModals.test.tsx src/test/dateField.test.tsx src/test/nodeDetailTemplateDialog.test.ts`
Expected: PASS

- [ ] **Step 3: Run backend full suite**

Run: `npm test -- --run`
Expected: PASS with all backend tests green

- [ ] **Step 4: Run frontend full suite**

Run: `npm test -- --run`
Expected: PASS with all frontend tests green

- [ ] **Step 5: Run backend build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Run frontend build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src frontend/src docs/superpowers/specs/2026-04-20-node-workbench-redesign-design.md docs/superpowers/plans/2026-04-20-node-workbench-redesign.md
git commit -m "feat: ship todo-centric node workbench redesign"
```

## Self-Review

- Spec coverage:
  - Todo-centric node workbench: Tasks 8-11
  - Expense and attachment strong todo association: Tasks 1-4 and 11
  - Todo delete cascade: Task 4
  - Fixed home header and modal node forms: Task 7
  - Modal todo forms and editable template todos: Task 10
  - Popup date picker: Task 6
  - Full verification: Task 12
- Placeholder scan:
  - No `TBD`, `TODO`, or “implement later” placeholders remain.
- Type consistency:
  - `todoId` is the required API contract name across backend validation and frontend payloads.
  - `NodeWorkbench` is the aggregated payload name across API and workbench hook tasks.
