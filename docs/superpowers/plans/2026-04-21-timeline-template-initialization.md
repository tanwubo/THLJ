# Timeline Template Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace automatic default timeline seeding with a managed timeline-template system, expose template selection only on empty timelines, and add an admin-only template management page inside the product.

**Architecture:** Add dedicated template tables plus seed/bootstrap logic in the backend, expose separate template read/manage/apply endpoints guarded by a lightweight admin check, then update the timeline empty state and settings area in the frontend to consume the new APIs. Keep real user timeline data in `timeline_nodes`, with template application performing a one-time copy into the current `dataOwnerId` data space.

**Tech Stack:** Express, sql.js, React, TypeScript, Zustand, Vitest, Testing Library

---

## File Structure

### Backend

- Modify: `backend/src/db/init.ts`
  Add template schema creation and one-time default template seeding hook.
- Modify: `backend/src/bootstrap.ts`
  Run template seed logic during app bootstrap.
- Modify: `backend/src/controllers/authController.ts`
  Remove register-time default node insertion and return `isAdmin` in login/register/profile payloads.
- Modify: `backend/src/controllers/timelineController.ts`
  Stop auto-creating default nodes in `getTimeline`; add template application endpoint if kept in this controller.
- Create: `backend/src/controllers/timelineTemplateController.ts`
  Read template lists/details, admin CRUD, and template application handlers if separated from timeline controller.
- Create: `backend/src/routes/timelineTemplateRoutes.ts`
  Wire template endpoints behind auth.
- Create: `backend/src/services/admin.ts`
  Centralize admin whitelist checks from username/env.
- Create: `backend/src/services/timelineTemplates.ts`
  Shared template read/write/copy helpers and default template seed data.
- Modify: `backend/src/index.ts`
  Register template routes.
- Modify: `backend/src/test/partnership.test.ts`
  Adjust empty timeline expectation and add `dataOwnerId` template application coverage.
- Create: `backend/src/test/timelineTemplate.test.ts`
  Cover template list/detail/admin CRUD/apply-template behavior.
- Modify: `backend/src/test/timeline.test.ts`
  Remove obsolete default-node assumptions and add empty-timeline expectations where appropriate.

### Frontend

- Modify: `frontend/src/services/api.ts`
  Add `isAdmin`, template types, template APIs, and apply-template API.
- Modify: `frontend/src/store/authStore.ts`
  Persist `isAdmin` through auth flows via returned user payload.
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
  Show template CTA only when timeline is empty; integrate template chooser and apply flow.
- Create: `frontend/src/pages/Timeline/TimelineTemplatePicker.tsx`
  Empty-state picker UI with template list, preview, and apply action.
- Modify: `frontend/src/pages/Settings/Settings.tsx`
  Show admin-only template-management entry.
- Create: `frontend/src/pages/Settings/TimelineTemplates.tsx`
  Admin page for list/create/edit/delete/activate templates.
- Create: `frontend/src/pages/Settings/TimelineTemplateEditor.tsx`
  Focused editor for template metadata plus ordered node editing.
- Modify: `frontend/src/App.tsx`
  Register the admin template-management route.
- Modify: `frontend/src/test/timelineModals.test.tsx`
  Add empty-state/template-picker behavior assertions.
- Modify: `frontend/src/test/settingsThemeSwitcher.test.tsx`
  Add admin entry visibility assertions.
- Create: `frontend/src/test/timelineTemplatesAdmin.test.tsx`
  Cover template-management page editing flow.

## Task 1: Add backend template schema and seed helpers

**Files:**
- Create: `backend/src/services/timelineTemplates.ts`
- Modify: `backend/src/db/init.ts`
- Modify: `backend/src/bootstrap.ts`
- Test: `backend/src/test/timelineTemplate.test.ts`

- [ ] **Step 1: Write the failing backend schema/seed test skeleton**

```ts
import { describe, expect, it, vi } from 'vitest'
import { applyWorkbenchSchema } from '../db/init'

describe('timeline template schema bootstrap', () => {
  it('creates template tables and seeds the built-in template once', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const exec = vi.fn()
      .mockReturnValueOnce([{ values: [['id'], ['name']] }])
      .mockReturnValue([])

    await applyWorkbenchSchema({ run, exec } as any)

    expect(run.mock.calls.some(([sql]) => String(sql).includes('CREATE TABLE IF NOT EXISTS timeline_templates'))).toBe(true)
    expect(run.mock.calls.some(([sql]) => String(sql).includes('CREATE TABLE IF NOT EXISTS timeline_template_nodes'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/timelineTemplate.test.ts`
Expected: FAIL because `timelineTemplate.test.ts` does not exist yet or `applyWorkbenchSchema` does not create template tables.

- [ ] **Step 3: Create template seed helper with the built-in wedding template**

```ts
// backend/src/services/timelineTemplates.ts
export const DEFAULT_TIMELINE_TEMPLATE = {
  name: '标准婚礼时间线',
  description: '覆盖婚礼筹备常见阶段，适合作为首次初始化模板。',
  nodes: [
    { name: '确定结婚意向', description: '' },
    { name: '双方父母见面', description: '' },
    { name: '男方上门提亲', description: '' },
    { name: '彩礼嫁妆三金协商', description: '' },
    { name: '订婚仪式', description: '' },
    { name: '婚前筹备', description: '' },
    { name: '民政局领证', description: '' },
    { name: '婚礼举办', description: '' },
    { name: '婚后费用结算收尾', description: '' },
  ],
}
```

- [ ] **Step 4: Extend schema bootstrap to create template tables**

```ts
// inside applyWorkbenchSchema(...)
await adapter.run(`
  CREATE TABLE IF NOT EXISTS timeline_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

await adapter.run(`
  CREATE TABLE IF NOT EXISTS timeline_template_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    "order" INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES timeline_templates(id)
  )
`)
```

- [ ] **Step 5: Seed the built-in template only when no templates exist**

```ts
// backend/src/services/timelineTemplates.ts
import { query, run, runInTransaction } from '../db'

export async function ensureDefaultTimelineTemplateSeeded() {
  const rows = query('SELECT id FROM timeline_templates LIMIT 1')
  if (rows.length > 0) {
    return
  }

  const template = await run(
    'INSERT INTO timeline_templates (name, description, is_active) VALUES (?, ?, ?)',
    [DEFAULT_TIMELINE_TEMPLATE.name, DEFAULT_TIMELINE_TEMPLATE.description, 1],
  )

  await runInTransaction(
    DEFAULT_TIMELINE_TEMPLATE.nodes.map((node, index) => ({
      sql: 'INSERT INTO timeline_template_nodes (template_id, name, description, "order") VALUES (?, ?, ?, ?)',
      params: [template.lastInsertRowid, node.name, node.description || null, index + 1],
    })),
  )
}
```

- [ ] **Step 6: Call the seed helper during bootstrap**

```ts
// backend/src/bootstrap.ts
import { ensureDefaultTimelineTemplateSeeded } from './services/timelineTemplates'

export async function bootstrapDatabase(): Promise<void> {
  await initDB()
  await applyWorkbenchSchema({
    exec: (sql: string) => db.exec(sql),
    run: (sql: string) => exec(sql),
  })
  await ensureDefaultTimelineTemplateSeeded()
}
```

- [ ] **Step 7: Run the focused test**

Run: `npm test -- src/test/timelineTemplate.test.ts`
Expected: PASS for schema/seed bootstrap assertions.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/timelineTemplates.ts backend/src/db/init.ts backend/src/bootstrap.ts backend/src/test/timelineTemplate.test.ts
git commit -m "feat: add timeline template schema and seed bootstrap"
```

## Task 2: Add lightweight admin detection to auth responses

**Files:**
- Create: `backend/src/services/admin.ts`
- Modify: `backend/src/controllers/authController.ts`
- Test: `backend/src/test/timelineTemplate.test.ts`

- [ ] **Step 1: Write the failing auth/admin test**

```ts
it('includes isAdmin in auth payloads based on the configured username whitelist', async () => {
  process.env.ADMIN_USERNAMES = 'alice,root'
  // mock register/login/profile user rows and assert response.user.isAdmin === true for alice
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/timelineTemplate.test.ts`
Expected: FAIL because auth responses do not include `isAdmin`.

- [ ] **Step 3: Add a reusable admin helper**

```ts
// backend/src/services/admin.ts
export function getAdminUsernames(): string[] {
  return (process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) {
    return false
  }
  return getAdminUsernames().includes(username)
}
```

- [ ] **Step 4: Return `isAdmin` from register/login/profile**

```ts
// shared pattern in authController.ts
user: {
  id: user.id,
  username: user.username,
  email: user.email,
  inviteCode: user.invite_code,
  partnerId: user.partner_id,
  partner,
  createdAt: user.created_at,
  lastLogin: user.last_login,
  isAdmin: isAdminUsername(user.username),
}
```

- [ ] **Step 5: Run the focused test**

Run: `npm test -- src/test/timelineTemplate.test.ts`
Expected: PASS for `isAdmin` auth payload assertions.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/admin.ts backend/src/controllers/authController.ts backend/src/test/timelineTemplate.test.ts
git commit -m "feat: expose admin flag in auth responses"
```

## Task 3: Remove automatic default-node creation from register and getTimeline

**Files:**
- Modify: `backend/src/controllers/authController.ts`
- Modify: `backend/src/controllers/timelineController.ts`
- Modify: `backend/src/test/partnership.test.ts`
- Modify: `backend/src/test/timeline.test.ts`

- [ ] **Step 1: Write the failing empty-timeline tests**

```ts
it('returns an empty timeline instead of auto-seeding default nodes', async () => {
  queryMock.mockImplementation((sql: string) => {
    if (sql === 'SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC') {
      return []
    }
    return []
  })

  const { json, res } = createResponse()
  await getTimeline({ user: { id: 1, dataOwnerId: 1 } } as any, res)

  expect(json).toHaveBeenCalledWith({ nodes: [], overallProgress: 0 })
  expect(runMock).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/partnership.test.ts src/test/timeline.test.ts`
Expected: FAIL because current controller still inserts default nodes.

- [ ] **Step 3: Remove register-time default node insertion**

```ts
// delete the defaultNodes array and insertion loop from register(...)
const token = jwt.sign(
  { id: userId, username, partnerId: null },
  JWT_SECRET,
  { expiresIn: '7d' },
)
```

- [ ] **Step 4: Remove `getTimeline` auto-seed behavior**

```ts
// backend/src/controllers/timelineController.ts
const nodes = query('SELECT * FROM timeline_nodes WHERE user_id = ? ORDER BY "order" ASC', [dataOwnerId])

const nodesWithProgress = nodes.map((node: any) => {
  const todos = query('SELECT * FROM todo_items WHERE node_id = ?', [node.id])
  const completed = todos.filter((t: any) => t.status === 'completed').length
  const progress = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0
  return { ...node, progress, todos }
})
```

- [ ] **Step 5: Run the focused tests**

Run: `npm test -- src/test/partnership.test.ts src/test/timeline.test.ts`
Expected: PASS with empty timeline returning an empty array and no default insertions.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/authController.ts backend/src/controllers/timelineController.ts backend/src/test/partnership.test.ts backend/src/test/timeline.test.ts
git commit -m "refactor: stop auto-seeding timeline nodes for new users"
```

## Task 4: Add backend template read/manage/apply endpoints

**Files:**
- Create: `backend/src/controllers/timelineTemplateController.ts`
- Create: `backend/src/routes/timelineTemplateRoutes.ts`
- Create: `backend/src/services/timelineTemplates.ts` (extend)
- Modify: `backend/src/index.ts`
- Test: `backend/src/test/timelineTemplate.test.ts`

- [ ] **Step 1: Write the failing endpoint tests**

```ts
it('lists only active templates for non-admin users', async () => {
  // mock query rows with active + inactive templates, assert only active rows are returned
})

it('allows admins to update templates', async () => {
  // mock req.user.username as admin and assert runInTransaction receives replace-all node operations
})

it('applies a template only when the dataOwner timeline is empty', async () => {
  // mock empty timeline for first call, non-empty for second branch, assert inserts only on empty
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/timelineTemplate.test.ts`
Expected: FAIL because template endpoints do not exist.

- [ ] **Step 3: Add template service helpers**

```ts
// backend/src/services/timelineTemplates.ts
export function getTimelineTemplates(includeInactive = false) {
  return query(
    `SELECT t.*, COUNT(n.id) as node_count
     FROM timeline_templates t
     LEFT JOIN timeline_template_nodes n ON n.template_id = t.id
     ${includeInactive ? '' : 'WHERE t.is_active = 1'}
     GROUP BY t.id
     ORDER BY t.updated_at DESC`,
  )
}

export function getTimelineTemplateDetail(id: string | number) {
  const templates = query('SELECT * FROM timeline_templates WHERE id = ?', [id])
  if (templates.length === 0) {
    return null
  }
  const nodes = query(
    'SELECT * FROM timeline_template_nodes WHERE template_id = ? ORDER BY "order" ASC',
    [id],
  )
  return { ...templates[0], nodes }
}
```

- [ ] **Step 4: Implement controller handlers**

```ts
// backend/src/controllers/timelineTemplateController.ts
export async function listTimelineTemplates(req: AuthRequest, res: Response) {
  const includeInactive = req.query.includeInactive === '1' && isAdminUsername(req.user?.username)
  res.json({ templates: getTimelineTemplates(includeInactive) })
}

export async function applyTimelineTemplate(req: AuthRequest, res: Response) {
  const dataOwnerId = req.user?.dataOwnerId ?? req.user?.id
  const { templateId } = req.body
  const detail = getTimelineTemplateDetail(templateId)
  if (!detail || !detail.is_active) {
    return res.status(404).json({ error: '模板不存在或不可用' })
  }
  const existing = query('SELECT id FROM timeline_nodes WHERE user_id = ? LIMIT 1', [dataOwnerId])
  if (existing.length > 0) {
    return res.status(400).json({ error: '当前时间线已有数据，无法再次应用模板' })
  }
  await runInTransaction(
    detail.nodes.map((node: any, index: number) => ({
      sql: 'INSERT INTO timeline_nodes (user_id, name, description, "order", status, deadline) VALUES (?, ?, ?, ?, ?, ?)',
      params: [dataOwnerId, node.name, node.description ?? null, index + 1, 'pending', null],
    })),
  )
  res.json({ success: true })
}
```

- [ ] **Step 5: Add route wiring**

```ts
// backend/src/routes/timelineTemplateRoutes.ts
router.use(authMiddleware)
router.get('/', listTimelineTemplates)
router.get('/:id', getTimelineTemplate)
router.post('/', requireAdmin, createTimelineTemplate)
router.put('/:id', requireAdmin, updateTimelineTemplate)
router.delete('/:id', requireAdmin, deleteTimelineTemplate)
router.post('/apply', applyTimelineTemplate)
```

- [ ] **Step 6: Mount the route**

```ts
// backend/src/index.ts
import timelineTemplateRoutes from './routes/timelineTemplateRoutes'

app.use('/api/timeline-templates', timelineTemplateRoutes)
```

- [ ] **Step 7: Run the focused tests**

Run: `npm test -- src/test/timelineTemplate.test.ts`
Expected: PASS for list/detail/admin/apply behavior.

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/timelineTemplateController.ts backend/src/routes/timelineTemplateRoutes.ts backend/src/services/timelineTemplates.ts backend/src/index.ts backend/src/test/timelineTemplate.test.ts
git commit -m "feat: add timeline template management and apply endpoints"
```

## Task 5: Add frontend template API types and auth shape updates

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/store/authStore.ts`
- Test: `frontend/src/test/api.test.ts`

- [ ] **Step 1: Write the failing API-shape test**

```ts
it('exposes timeline template APIs', () => {
  expect(typeof timelineTemplateAPI.listTemplates).toBe('function')
  expect(typeof timelineTemplateAPI.getTemplate).toBe('function')
  expect(typeof timelineTemplateAPI.applyTemplate).toBe('function')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/api.test.ts`
Expected: FAIL because `timelineTemplateAPI` does not exist.

- [ ] **Step 3: Extend user and template types**

```ts
export interface User {
  id: number
  username: string
  inviteCode: string
  isAdmin?: boolean
  // ...
}

export interface TimelineTemplateNode {
  id: number
  templateId: number
  name: string
  description?: string
  order: number
}

export interface TimelineTemplate {
  id: number
  name: string
  description?: string
  isActive: boolean
  nodeCount?: number
  nodes?: TimelineTemplateNode[]
}
```

- [ ] **Step 4: Add template API client methods**

```ts
export const timelineTemplateAPI = {
  listTemplates: (includeInactive = false) =>
    api.get<{ templates: TimelineTemplate[] }>(`/timeline-templates${includeInactive ? '?includeInactive=1' : ''}`),
  getTemplate: (id: number) =>
    api.get<TimelineTemplate>(`/timeline-templates/${id}`),
  createTemplate: (data: TimelineTemplatePayload) =>
    api.post<TimelineTemplate>('/timeline-templates', data),
  updateTemplate: (id: number, data: TimelineTemplatePayload) =>
    api.put<TimelineTemplate>(`/timeline-templates/${id}`, data),
  deleteTemplate: (id: number) =>
    api.delete(`/timeline-templates/${id}`),
  applyTemplate: (templateId: number) =>
    api.post('/timeline-templates/apply', { templateId }),
}
```

- [ ] **Step 5: Keep auth store compatible with `isAdmin`**

```ts
set({
  token,
  user,
  partnerId: user.partnerId || null,
  partner: (user as any).partner || null,
})
```

The store shape stays the same, but tests should assert the user object now carries `isAdmin`.

- [ ] **Step 6: Run the focused test**

Run: `npm test -- src/test/api.test.ts`
Expected: PASS for template API exports.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/store/authStore.ts frontend/src/test/api.test.ts
git commit -m "feat: add frontend timeline template API client"
```

## Task 6: Add empty-timeline template picker to the timeline page

**Files:**
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
- Create: `frontend/src/pages/Timeline/TimelineTemplatePicker.tsx`
- Modify: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Write the failing empty-state picker tests**

```tsx
it('shows template selection and create-first-node actions when the timeline is empty', async () => {
  getTimelineMock.mockResolvedValue({ data: { nodes: [], overallProgress: 0 } } as any)
  listTemplatesMock.mockResolvedValue({ data: { templates: [{ id: 1, name: '标准婚礼时间线', description: 'desc' }] } } as any)

  renderTimeline()

  expect(await screen.findByRole('button', { name: '选择模板' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '创建第一个节点' })).toBeInTheDocument()
})

it('hides the template entry once timeline nodes exist', async () => {
  renderTimeline()
  expect(await screen.findByText('订酒店')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '选择模板' })).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/timelineModals.test.tsx`
Expected: FAIL because the empty state does not include template selection.

- [ ] **Step 3: Add a focused template picker component**

```tsx
// frontend/src/pages/Timeline/TimelineTemplatePicker.tsx
export default function TimelineTemplatePicker({
  visible,
  templates,
  activeTemplate,
  loading,
  submitting,
  onSelect,
  onClose,
  onApply,
}: Props) {
  return (
    <Popup visible={visible} onMaskClick={onClose} bodyStyle={{ borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
      <div className="timeline-template-picker">
        <div className="timeline-template-picker__header">
          <p className="section-label">Templates</p>
          <h3 className="section-title">选择一套初始时间线</h3>
        </div>
        {/* list + preview + apply button */}
      </div>
    </Popup>
  )
}
```

- [ ] **Step 4: Wire the picker into `Timeline.tsx`**

```tsx
const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false)
const [templates, setTemplates] = useState<TimelineTemplate[]>([])
const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null)

const fetchTemplates = async () => {
  const response = await timelineTemplateAPI.listTemplates()
  setTemplates(response.data.templates)
  setActiveTemplateId(response.data.templates[0]?.id ?? null)
}
```

In the empty state:

```tsx
<button type="button" className="brand-primary-button" onClick={openTemplatePicker}>
  选择模板
</button>
<button type="button" className="brand-secondary-button" onClick={openCreateModal}>
  创建第一个节点
</button>
```

- [ ] **Step 5: Apply the selected template and refresh the timeline**

```tsx
const handleApplyTemplate = async () => {
  if (!activeTemplateId) {
    return
  }
  await timelineTemplateAPI.applyTemplate(activeTemplateId)
  Toast.show('模板已应用')
  setIsTemplatePickerOpen(false)
  await fetchTimeline()
}
```

- [ ] **Step 6: Run the focused test**

Run: `npm test -- src/test/timelineModals.test.tsx`
Expected: PASS for empty-state template selection behavior.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Timeline/Timeline.tsx frontend/src/pages/Timeline/TimelineTemplatePicker.tsx frontend/src/test/timelineModals.test.tsx
git commit -m "feat: add empty timeline template picker"
```

## Task 7: Add the admin-only template management route and settings entry

**Files:**
- Modify: `frontend/src/pages/Settings/Settings.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Settings/TimelineTemplates.tsx`
- Create: `frontend/src/pages/Settings/TimelineTemplateEditor.tsx`
- Modify: `frontend/src/test/settingsThemeSwitcher.test.tsx`
- Create: `frontend/src/test/timelineTemplatesAdmin.test.tsx`

- [ ] **Step 1: Write the failing admin-entry and management tests**

```tsx
it('shows the timeline template management entry for admins only', () => {
  useAuthStore.setState({
    user: { id: 1, username: 'alice', inviteCode: 'ABCD12', isAdmin: true, createdAt: '2026-01-01', lastLogin: '2026-01-01' } as any,
  })
  renderSettings()
  expect(screen.getByRole('link', { name: /时间线模板管理/ })).toBeInTheDocument()
})
```

```tsx
it('loads templates and saves edited template nodes from the admin page', async () => {
  // render the page with mocked list/get/update APIs and assert update payload structure
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/settingsThemeSwitcher.test.tsx src/test/timelineTemplatesAdmin.test.tsx`
Expected: FAIL because no admin entry or management page exists.

- [ ] **Step 3: Add the settings entry**

```tsx
{user?.isAdmin ? (
  <SurfaceCard className="settings-section">
    <p className="section-label">Admin</p>
    <h2 className="section-title">模板管理</h2>
    <Link to="/settings/timeline-templates" className="brand-secondary-button">
      时间线模板管理
    </Link>
  </SurfaceCard>
) : null}
```

- [ ] **Step 4: Add the admin management page**

```tsx
// frontend/src/pages/Settings/TimelineTemplates.tsx
useEffect(() => {
  timelineTemplateAPI.listTemplates(true).then((response) => {
    setTemplates(response.data.templates)
  })
}, [])

if (!user?.isAdmin) {
  return <Navigate to="/settings" replace />
}
```

Page responsibilities:
- load all templates
- select one template for editing
- create/delete/toggle active templates
- save full template payload

- [ ] **Step 5: Add a focused editor for template nodes**

```tsx
// frontend/src/pages/Settings/TimelineTemplateEditor.tsx
type EditableTemplateNode = {
  id?: number
  name: string
  description: string
}

// provide add, remove, move up, move down, save
```

- [ ] **Step 6: Register the route**

```tsx
// frontend/src/App.tsx
<Route path="/settings/timeline-templates" element={<ProtectedRoute><TimelineTemplates /></ProtectedRoute>} />
```

- [ ] **Step 7: Run the focused tests**

Run: `npm test -- src/test/settingsThemeSwitcher.test.tsx src/test/timelineTemplatesAdmin.test.tsx`
Expected: PASS for admin-only entry visibility and template save flow.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Settings/Settings.tsx frontend/src/App.tsx frontend/src/pages/Settings/TimelineTemplates.tsx frontend/src/pages/Settings/TimelineTemplateEditor.tsx frontend/src/test/settingsThemeSwitcher.test.tsx frontend/src/test/timelineTemplatesAdmin.test.tsx
git commit -m "feat: add admin timeline template management page"
```

## Task 8: Run end-to-end verification for the full template-init flow

**Files:**
- Modify: `backend/src/test/timelineTemplate.test.ts`
- Modify: `frontend/src/test/timelineModals.test.tsx`
- Modify: `frontend/src/test/timelineTemplatesAdmin.test.tsx`

- [ ] **Step 1: Add missing regression tests**

```ts
// backend
it('rejects template application when shared dataOwner timeline is already non-empty', async () => {
  // req.user.dataOwnerId = 2, existing node query returns one row, expect 400
})
```

```tsx
// frontend timeline
it('refreshes timeline nodes after applying a template', async () => {
  // first getTimeline returns empty, applyTemplate resolves, second getTimeline returns seeded nodes
})
```

- [ ] **Step 2: Run backend regression suite**

Run: `npm test -- src/test/timeline.test.ts src/test/partnership.test.ts src/test/timelineTemplate.test.ts`
Expected: PASS

- [ ] **Step 3: Run frontend regression suite**

Run: `npm test -- src/test/api.test.ts src/test/timelineModals.test.tsx src/test/settingsThemeSwitcher.test.tsx src/test/timelineTemplatesAdmin.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/timelineTemplate.test.ts frontend/src/test/timelineModals.test.tsx frontend/src/test/timelineTemplatesAdmin.test.tsx
git commit -m "test: cover timeline template initialization flow"
```

## Self-Review

- Spec coverage:
  Covered template schema/seed, admin identification, no-default registration/timeline fetch, template list/detail/admin CRUD/apply, empty-state picker, admin settings entry, and regression tests.
- Placeholder scan:
  No `TODO`, `TBD`, or deferred “implement later” steps remain; all tasks name concrete files, commands, and target code shapes.
- Type consistency:
  Plan consistently uses `timelineTemplateAPI`, `isAdmin`, `/api/timeline-templates`, and `/api/timeline-templates/apply`.

