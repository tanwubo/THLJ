# Timeline Node Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework timeline node cards so name, deadline, and status are inline-editable with clear hover/focus affordances, while a three-dot menu owns full-edit and delete actions.

**Architecture:** Keep the existing `Timeline.tsx` page as the orchestration point, but split card interactions by hit target: the card shell navigates to node detail, and three dedicated interactive zones stop propagation and persist field-specific updates through the existing `timelineAPI.updateNode` endpoint. Preserve the current create/edit modal flow, but restyle the dialog and extend full edit to include status so the modal remains the complete-edit surface.

**Tech Stack:** React 18, TypeScript, antd-mobile, Vitest, Testing Library

---

## File Structure

### Modified files

- `frontend/src/pages/Timeline/Timeline.tsx`
  Rebuild the node card hit areas, inline editing state, three-dot actions menu, inline deadline picker, and themed complete-edit modal state.
- `frontend/src/components/ui/StatusPill.tsx`
  Export the shared status label map so the card dropdown and modal status picker use the same source of truth.
- `frontend/src/index.css`
  Add hover/focus animations for inline hotspots, menu and picker surfaces, and theme-aligned dialog styling.
- `frontend/src/test/timelineModals.test.tsx`
  Cover click routing, inline name save, inline status save, and the three-dot menu opening the full-edit path.

---

### Task 1: Lock the new card behavior with tests

**Files:**
- Modify: `frontend/src/test/timelineModals.test.tsx`
- Test: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Add failing tests for click routing and inline editing**

```tsx
it('routes card clicks so only the non-inline area opens node detail', async () => {
  renderTimeline()

  expect(await screen.findByText('订酒店')).toBeInTheDocument()
  fireEvent.click(screen.getByText('确认宴会厅'))
  expect(mockNavigate).toHaveBeenCalledWith('/node/1')

  mockNavigate.mockClear()
  fireEvent.click(screen.getByLabelText('编辑节点名称'))
  expect(mockNavigate).not.toHaveBeenCalled()
})

it('saves the node name after inline editing on blur', async () => {
  renderTimeline()

  fireEvent.click(await screen.findByLabelText('编辑节点名称'))
  fireEvent.change(screen.getByDisplayValue('订酒店'), { target: { value: '订婚礼酒店' } })
  fireEvent.blur(screen.getByDisplayValue('订婚礼酒店'))

  await waitFor(() => {
    expect(updateNodeMock).toHaveBeenCalledWith(1, {
      name: '订婚礼酒店',
      description: '确认宴会厅',
      deadline: '2026-05-01',
      status: 'pending',
    })
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run src/test/timelineModals.test.tsx`

Expected: FAIL because the old card still treats the entire surface as a single detail-navigation target and still exposes the legacy inline edit/delete buttons.

- [ ] **Step 3: Add the status dropdown and three-dot menu assertions**

```tsx
it('opens a status dropdown and saves the selected status inline', async () => {
  renderTimeline()

  fireEvent.click(await screen.findByLabelText('编辑节点状态'))
  fireEvent.click(await screen.findByRole('button', { name: '进行中' }))

  await waitFor(() => {
    expect(updateNodeMock).toHaveBeenCalledWith(1, {
      name: '订酒店',
      description: '确认宴会厅',
      deadline: '2026-05-01',
      status: 'in_progress',
    })
  })
})

it('opens a three-dot menu with full edit and delete actions', async () => {
  renderTimeline()

  fireEvent.click(await screen.findByLabelText('更多操作'))
  expect(screen.getByRole('button', { name: '完整编辑' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '删除节点' })).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the focused test again**

Run: `npm test -- --run src/test/timelineModals.test.tsx`

Expected: FAIL on the new inline status and actions menu assertions until production code is updated.

---

### Task 2: Rebuild the timeline card interactions

**Files:**
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
- Modify: `frontend/src/components/ui/StatusPill.tsx`
- Test: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Add a shared payload builder for partial node saves**

```ts
const buildUpdatePayload = (
  node: TimelineNode,
  overrides: Partial<Pick<TimelineNode, 'name' | 'description' | 'deadline' | 'status'>>,
) => ({
  name: (overrides.name ?? node.name).trim(),
  description: (overrides.description ?? node.description ?? '').trim() || undefined,
  deadline: overrides.deadline ?? node.deadline ?? undefined,
  status: overrides.status ?? node.status,
})
```

- [ ] **Step 2: Add focused state for inline name editing, status dropdown, action menu, and deadline picker**

```ts
const [inlineNameState, setInlineNameState] = useState<InlineNameState | null>(null)
const [statusMenuNodeId, setStatusMenuNodeId] = useState<number | null>(null)
const [actionsMenuNodeId, setActionsMenuNodeId] = useState<number | null>(null)
const [deadlinePickerNodeId, setDeadlinePickerNodeId] = useState<number | null>(null)
```

- [ ] **Step 3: Replace the old card buttons with target-specific interactive zones**

```tsx
<div className="timeline-node-card__shell" role="button" tabIndex={0} onClick={() => handleNodeClick(node.id)}>
  <button type="button" aria-label="编辑节点名称" onClick={(event) => startInlineNameEdit(node, event)}>
    {node.name}
  </button>
  <button type="button" aria-label="编辑节点状态" onClick={(event) => toggleStatusMenu(node.id, event)}>
    <StatusPill status={node.status} />
  </button>
  <button type="button" aria-label="更多操作" onClick={(event) => toggleActionsMenu(node.id, event)}>
    <span aria-hidden="true">•••</span>
  </button>
</div>
```

- [ ] **Step 4: Run the focused test to verify the new behavior passes**

Run: `npm test -- --run src/test/timelineModals.test.tsx`

Expected: PASS for the new inline-editing tests and PASS for the existing create/edit dialog coverage.

---

### Task 3: Theme the inline panels and complete-edit modal

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
- Test: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Add motion and affordance styles for interactive zones and floating menus**

```css
.timeline-interactive-zone {
  border-radius: 18px;
  transition: transform 180ms ease, border-color 180ms ease, background-color 180ms ease;
}

.timeline-interactive-zone:hover,
.timeline-interactive-zone:focus-visible,
.timeline-interactive-zone--active {
  border-color: rgba(127, 23, 48, 0.16);
  background: rgba(127, 23, 48, 0.06);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Add a themed inline deadline picker panel and status menu surface**

```css
.timeline-floating-menu {
  border-radius: 20px;
  background: rgba(255, 251, 246, 0.98);
  box-shadow: 0 18px 42px rgba(62, 22, 30, 0.18);
}

.timeline-inline-panel__date-input {
  min-height: 52px;
  border-radius: 18px;
  border: 1px solid rgba(127, 23, 48, 0.16);
}
```

- [ ] **Step 3: Restyle the antd-mobile dialog shell and add full-edit status controls**

```css
.adm-dialog-wrap .adm-dialog {
  background:
    radial-gradient(circle at top right, rgba(200, 160, 98, 0.18), transparent 28%),
    rgba(255, 251, 246, 0.98);
  border-radius: 30px;
}
```

```tsx
<div className="timeline-node-dialog__status-options">
  {STATUS_OPTIONS.map((status) => (
    <button
      key={status}
      type="button"
      className={editForm.status === status ? 'timeline-node-dialog__status-option timeline-node-dialog__status-option--active' : 'timeline-node-dialog__status-option'}
      onClick={() => setEditForm((current) => ({ ...current, status }))}
    >
      {statusLabelMap[status]}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Run the focused test and a production build**

Run: `npm test -- --run src/test/timelineModals.test.tsx && npm run build`

Expected: PASS for timeline modal tests and PASS for the frontend build with no TypeScript errors.
