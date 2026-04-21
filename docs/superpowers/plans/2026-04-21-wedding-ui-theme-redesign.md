# Wedding UI Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the frontend main flow into a themed, mobile-first "high-end wedding planning booklet" UI with a default ceremony-red theme and a persistent theme switcher.

**Architecture:** Introduce a small theme layer at the app root using React context plus CSS custom properties, then rebuild the shared app shell and page surfaces to consume semantic tokens instead of hard-coded Tailwind colors. Keep existing API calls and page logic intact, but route visual structure through reusable layout components so the login, timeline, statistics, node detail, and settings pages share one design language.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, antd-mobile, Vitest, Testing Library

---

## File Structure

### New files

- `frontend/src/theme/themes.ts`
  Defines the theme keys, theme labels, storage key, and token maps for `ceremony-red` and `champagne-light`.
- `frontend/src/theme/ThemeProvider.tsx`
  Owns theme state, localStorage persistence, root `data-theme` sync, and exposes `useTheme()`.
- `frontend/src/theme/useTheme.ts`
  Re-export hook wrapper if the provider file becomes crowded.
- `frontend/src/components/layout/AppShell.tsx`
  Shared page shell with background layers, max width, safe-area spacing, and optional bottom navigation.
- `frontend/src/components/layout/BrandHeader.tsx`
  Reusable branded top section for timeline, statistics, node detail, and settings.
- `frontend/src/components/layout/BottomNav.tsx`
  SVG-based bottom nav for timeline / statistics / settings.
- `frontend/src/components/ui/SurfaceCard.tsx`
  Shared card container for page sections and list items.
- `frontend/src/components/ui/StatusPill.tsx`
  Shared semantic status label for pending / in-progress / completed / cancelled.
- `frontend/src/components/ui/ThemePreviewCard.tsx`
  Clickable preview used in settings for theme selection.
- `frontend/src/test/themeProvider.test.tsx`
  Verifies default theme, persisted theme, and root attribute sync.
- `frontend/src/test/appShell.test.tsx`
  Verifies shared shell renders nav and branded header content without emoji regressions.

### Modified files

- `frontend/src/main.tsx`
  Wrap the app with the new theme provider.
- `frontend/src/index.css`
  Add font imports, CSS custom properties, root theme definitions, base typography, utility classes, and shared component-level surface styles.
- `frontend/tailwind.config.js`
  Reduce reliance on hard-coded wedding colors and optionally add font families / semantic shadows that align with the token system.
- `frontend/src/App.tsx`
  Update loading and protected-route fallback styling to consume shared theme utilities.
- `frontend/src/pages/Login/Login.tsx`
  Redesign into brand entry page using themed surfaces.
- `frontend/src/pages/Timeline/Timeline.tsx`
  Rebuild into the main themed workbench and remove emoji/status hard-coding.
- `frontend/src/pages/Statistics/Statistics.tsx`
  Convert stats page to themed overview layout with shared header, cards, and bottom nav.
- `frontend/src/pages/NodeDetail/NodeDetail.tsx`
  Align detail workbench with themed shell, cards, and status treatments.
- `frontend/src/pages/Settings/Settings.tsx`
  Add the theme switcher section and move the page to the shared shell.
- `frontend/src/test/timelineModals.test.tsx`
  Update expectations if the redesigned timeline changes labels or button placement while preserving behavior.
- `frontend/src/test/nodeWorkbench.test.tsx`
  Keep existing workbench behavior coverage passing after layout changes.

### Existing files to inspect while implementing

- `frontend/src/store/authStore.ts`
  Do not move theme state here; keep it scoped to the provider.
- `frontend/src/components/DateField.tsx`
  Ensure it still visually fits the new token system when used inside dialogs.
- `frontend/src/test/setup.ts`
  Already mocks `localStorage` and `matchMedia`; extend only if theme tests need `document.documentElement.dataset`.

---

### Task 1: Build the theme foundation

**Files:**
- Create: `frontend/src/theme/themes.ts`
- Create: `frontend/src/theme/ThemeProvider.tsx`
- Create: `frontend/src/theme/useTheme.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/test/themeProvider.test.tsx`

- [ ] **Step 1: Write the failing test for default and persisted theme behavior**

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider'
import { useTheme } from '../theme/useTheme'
import { THEME_STORAGE_KEY } from '../theme/themes'

function ThemeProbe() {
  const { theme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme('champagne-light')}>switch</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to ceremony-red and writes the root dataset', () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue(null)

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('ceremony-red')
    expect(document.documentElement.dataset.theme).toBe('ceremony-red')
  })

  it('hydrates the persisted theme and updates localStorage on change', async () => {
    vi.mocked(window.localStorage.getItem).mockReturnValue('champagne-light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('champagne-light')
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run frontend/src/test/themeProvider.test.tsx`

Expected: FAIL with module resolution errors for `ThemeProvider`, `useTheme`, or `themes`.

- [ ] **Step 3: Add the theme definitions and provider**

```ts
// frontend/src/theme/themes.ts
export const THEME_STORAGE_KEY = 'wedding-manager-theme'

export const themeOrder = ['ceremony-red', 'champagne-light'] as const
export type ThemeName = (typeof themeOrder)[number]

export type ThemeDefinition = {
  label: string
  description: string
  preview: { hero: string; surface: string; accent: string }
}

export const themes: Record<ThemeName, ThemeDefinition> = {
  'ceremony-red': {
    label: '雅红金',
    description: '中式雅致、酒红主调、克制金色强调',
    preview: { hero: '#6f1022', surface: '#fff9f2', accent: '#c8a062' },
  },
  'champagne-light': {
    label: '奶油香槟',
    description: '轻盈暖白、香槟金、柔和玫瑰色点缀',
    preview: { hero: '#e9dccb', surface: '#fffdf9', accent: '#b78b5d' },
  },
}

export function isThemeName(value: string | null): value is ThemeName {
  return value !== null && value in themes
}
```

```tsx
// frontend/src/theme/ThemeProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { isThemeName, THEME_STORAGE_KEY, themeOrder, type ThemeName } from './themes'

type ThemeContextValue = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  availableThemes: typeof themeOrder
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(): ThemeName {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeName(stored) ? stored : 'ceremony-red'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, availableThemes: themeOrder }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
```

```ts
// frontend/src/theme/useTheme.ts
export { useThemeContext as useTheme } from './ThemeProvider'
```

```tsx
// frontend/src/main.tsx
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ThemeProvider } from './theme/ThemeProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ThemeProvider>,
)
```

```css
/* frontend/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Playfair+Display:wght@600;700&display=swap');

:root {
  --bg-base: #f7f1eb;
  --bg-muted: #efe5d9;
  --bg-elevated: rgba(255, 251, 246, 0.92);
  --bg-hero: linear-gradient(180deg, #7a1328 0%, #56101f 100%);
  --text-primary: #25161a;
  --text-secondary: #70545a;
  --text-muted: #9a8086;
  --text-on-brand: #fff8f1;
  --brand-primary: #7f1730;
  --brand-primary-soft: #f3d9dc;
  --brand-accent: #c8a062;
  --border-soft: rgba(122, 85, 63, 0.16);
  --shadow-card: 0 18px 40px rgba(103, 47, 56, 0.12);
}

:root[data-theme='champagne-light'] {
  --bg-base: #f5efe6;
  --bg-muted: #eee4d7;
  --bg-elevated: rgba(255, 253, 249, 0.94);
  --bg-hero: linear-gradient(180deg, #efe0d1 0%, #dfc6af 100%);
  --text-primary: #31231c;
  --text-secondary: #6f5a4a;
  --text-muted: #98816d;
  --text-on-brand: #2d2119;
  --brand-primary: #b88752;
  --brand-primary-soft: #f1e4d3;
  --brand-accent: #d2a67a;
  --border-soft: rgba(130, 95, 61, 0.14);
  --shadow-card: 0 18px 40px rgba(118, 91, 67, 0.12);
}

body {
  font-family: 'Noto Sans SC', sans-serif;
  background: var(--bg-base);
  color: var(--text-primary);
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run frontend/src/test/themeProvider.test.tsx`

Expected: PASS with 2 passing tests for default and persisted theme behavior.

- [ ] **Step 5: Commit the theme foundation**

```bash
git add frontend/src/theme/themes.ts frontend/src/theme/ThemeProvider.tsx frontend/src/theme/useTheme.ts frontend/src/main.tsx frontend/src/index.css frontend/src/test/themeProvider.test.tsx
git commit -m "feat: add themed frontend foundation"
```

### Task 2: Build the shared shell and reusable themed primitives

**Files:**
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/BrandHeader.tsx`
- Create: `frontend/src/components/layout/BottomNav.tsx`
- Create: `frontend/src/components/ui/SurfaceCard.tsx`
- Create: `frontend/src/components/ui/StatusPill.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/test/appShell.test.tsx`

- [ ] **Step 1: Write the failing test for shared shell rendering**

```tsx
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppShell from '../components/layout/AppShell'
import BrandHeader from '../components/layout/BrandHeader'

describe('AppShell', () => {
  it('renders a brand header and text-based bottom navigation', () => {
    render(
      <MemoryRouter>
        <AppShell
          header={
            <BrandHeader
              eyebrow="Wedding Manager"
              title="婚礼筹备"
              subtitle="主工作台"
            />
          }
          withBottomNav
        >
          <div>content</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '婚礼筹备' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /时间线/ })).toBeInTheDocument()
    expect(screen.queryByText('📋')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run frontend/src/test/appShell.test.tsx`

Expected: FAIL because the layout components do not exist yet.

- [ ] **Step 3: Implement the shared shell and semantic UI primitives**

```tsx
// frontend/src/components/ui/SurfaceCard.tsx
import type { PropsWithChildren } from 'react'

type SurfaceCardProps = PropsWithChildren<{ className?: string }>

export default function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  return <section className={`surface-card ${className}`.trim()}>{children}</section>
}
```

```tsx
// frontend/src/components/ui/StatusPill.tsx
const labelMap = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
} as const

export default function StatusPill({ status }: { status: keyof typeof labelMap }) {
  return <span className={`status-pill status-pill--${status}`}>{labelMap[status]}</span>
}
```

```tsx
// frontend/src/components/layout/BottomNav.tsx
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: '时间线' },
  { to: '/statistics', label: '统计' },
  { to: '/settings', label: '设置' },
]

export default function BottomNav() {
  return (
    <nav aria-label="主导航" className="bottom-nav">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
        >
          <span className="bottom-nav__icon" aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

```tsx
// frontend/src/components/layout/BrandHeader.tsx
type BrandHeaderProps = {
  eyebrow: string
  title: string
  subtitle?: string
  aside?: React.ReactNode
}

export default function BrandHeader({ eyebrow, title, subtitle, aside }: BrandHeaderProps) {
  return (
    <header className="brand-header">
      <div>
        <p className="brand-header__eyebrow">{eyebrow}</p>
        <h1 className="brand-header__title">{title}</h1>
        {subtitle ? <p className="brand-header__subtitle">{subtitle}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </header>
  )
}
```

```tsx
// frontend/src/components/layout/AppShell.tsx
import type { PropsWithChildren, ReactNode } from 'react'
import BottomNav from './BottomNav'

type AppShellProps = PropsWithChildren<{
  header?: ReactNode
  withBottomNav?: boolean
  contentClassName?: string
}>

export default function AppShell({ children, header, withBottomNav, contentClassName = '' }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true" />
      {header ? <div className="app-shell__header">{header}</div> : null}
      <main className={`app-shell__content ${contentClassName}`.trim()}>{children}</main>
      {withBottomNav ? <BottomNav /> : null}
    </div>
  )
}
```

```tsx
// frontend/src/App.tsx protected route fallback
if (!_hasHydrated) {
  return <div className="app-loading-screen">加载中...</div>
}
```

```css
/* frontend/src/index.css additions */
.app-shell {
  min-height: 100dvh;
  background:
    radial-gradient(circle at top, rgba(200, 160, 98, 0.18), transparent 36%),
    var(--bg-base);
  color: var(--text-primary);
}

.surface-card {
  border: 1px solid var(--border-soft);
  background: var(--bg-elevated);
  border-radius: 28px;
  box-shadow: var(--shadow-card);
}

.bottom-nav {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.status-pill--completed { background: rgba(61, 128, 95, 0.14); color: #255c42; }
.status-pill--in_progress { background: rgba(80, 110, 168, 0.14); color: #28457a; }
.status-pill--pending { background: rgba(186, 139, 71, 0.16); color: #7a531d; }
.status-pill--cancelled { background: rgba(120, 107, 107, 0.12); color: #5d5353; }
```

- [ ] **Step 4: Run the shell test and a quick existing auth test**

Run: `npm test -- --run frontend/src/test/appShell.test.tsx frontend/src/test/authStore.test.ts`

Expected: PASS for the new shell test and PASS for the existing auth store test to confirm no app-root regression.

- [ ] **Step 5: Commit the shared primitives**

```bash
git add frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/BrandHeader.tsx frontend/src/components/layout/BottomNav.tsx frontend/src/components/ui/SurfaceCard.tsx frontend/src/components/ui/StatusPill.tsx frontend/src/App.tsx frontend/src/index.css frontend/src/test/appShell.test.tsx
git commit -m "feat: add shared themed app shell"
```

### Task 3: Redesign login, timeline, and statistics with shared themed surfaces

**Files:**
- Modify: `frontend/src/pages/Login/Login.tsx`
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
- Modify: `frontend/src/pages/Statistics/Statistics.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/test/timelineModals.test.tsx`

- [ ] **Step 1: Write or update the failing timeline interaction test to keep behavior stable through the redesign**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Timeline from '../pages/Timeline/Timeline'
import { timelineAPI } from '../services/api'

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    timelineAPI: {
      ...actual.timelineAPI,
      getTimeline: vi.fn(),
      createNode: vi.fn(),
    },
  }
})

describe('Timeline redesign', () => {
  beforeEach(() => {
    vi.mocked(timelineAPI.getTimeline).mockResolvedValue({ data: { nodes: [] } } as any)
  })

  it('keeps the create-node flow reachable from the redesigned page', async () => {
    render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    )

    await screen.findByText('还没有任何节点')
    fireEvent.click(screen.getByRole('button', { name: '创建第一个节点' }))

    await waitFor(() => {
      expect(screen.getByText('创建节点')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run the focused page regression test**

Run: `npm test -- --run frontend/src/test/timelineModals.test.tsx`

Expected: FAIL if labels or reachable controls are not yet aligned with the redesign plan.

- [ ] **Step 3: Implement the page redesigns using the shared shell**

```tsx
// Login.tsx layout sketch
return (
  <div className="auth-page">
    <div className="auth-page__hero">
      <p className="auth-page__eyebrow">Wedding Manager</p>
      <h1 className="auth-page__title">婚嫁管家</h1>
      <p className="auth-page__subtitle">以高定计划册的方式，记录每一程筹备。</p>
    </div>
    <SurfaceCard className="auth-page__card">
      <Tabs ... />
      {/* keep the same login/register handlers and controlled inputs */}
    </SurfaceCard>
  </div>
)
```

```tsx
// Timeline.tsx sketch
return (
  <AppShell
    withBottomNav
    header={
      <BrandHeader
        eyebrow="Ceremony Planner"
        title="婚礼时间线"
        subtitle={`${user?.username ?? ''}${partnerId ? ' · 已绑定筹备' : ' · 单人筹备'}`}
        aside={<button className="brand-ghost-button" onClick={handleLogout}>退出</button>}
      />
    }
  >
    <SurfaceCard className="timeline-overview-card">
      <div className="timeline-overview-card__stat">
        <span>节点总数</span>
        <strong>{nodes.length}</strong>
      </div>
      <button className="brand-primary-button" onClick={openCreateModal}>创建节点</button>
    </SurfaceCard>

    {nodes.length === 0 ? (
      <SurfaceCard className="timeline-empty-state">
        <p>还没有任何节点</p>
        <button className="brand-primary-button" onClick={openCreateModal}>创建第一个节点</button>
      </SurfaceCard>
    ) : (
      <div className="timeline-node-list">
        {nodes.map((node) => (
          <SurfaceCard key={node.id} className="timeline-node-card">
            <div className="timeline-node-card__header">
              <div>
                <h2>{node.name}</h2>
                {node.description ? <p>{node.description}</p> : null}
              </div>
              <StatusPill status={node.status as 'pending' | 'in_progress' | 'completed' | 'cancelled'} />
            </div>
          </SurfaceCard>
        ))}
      </div>
    )}
  </AppShell>
)
```

```tsx
// Statistics.tsx sketch
return (
  <AppShell
    withBottomNav
    header={
      <BrandHeader
        eyebrow="Planning Overview"
        title="筹备概览"
        subtitle={`${user?.username ?? ''}${partnerId ? ' · 双人同步中' : ' · 单人模式'}`}
      />
    }
  >
    <SurfaceCard className="stats-hero-card">{/* circular progress + summary */}</SurfaceCard>
    <div className="stats-grid">
      <SurfaceCard>{/* completed */}</SurfaceCard>
      <SurfaceCard>{/* in progress */}</SurfaceCard>
      <SurfaceCard>{/* pending */}</SurfaceCard>
      <SurfaceCard>{/* cancelled */}</SurfaceCard>
    </div>
  </AppShell>
)
```

```css
/* index.css additions for page-specific surfaces */
.auth-page { min-height: 100dvh; padding: 24px; display: grid; align-content: center; gap: 24px; }
.timeline-node-card__header,
.stats-grid { display: grid; gap: 16px; }
.brand-primary-button { background: var(--brand-primary); color: var(--text-on-brand); }
.brand-ghost-button { border: 1px solid rgba(255,255,255,0.24); color: var(--text-on-brand); }
```

- [ ] **Step 4: Run targeted tests and a frontend build**

Run: `npm test -- --run frontend/src/test/timelineModals.test.tsx frontend/src/test/authStore.test.ts frontend/src/test/api.test.ts && npm run build`

Expected: PASS for the targeted tests, then PASS for the Vite build with no TypeScript errors.

- [ ] **Step 5: Commit the first page redesign batch**

```bash
git add frontend/src/pages/Login/Login.tsx frontend/src/pages/Timeline/Timeline.tsx frontend/src/pages/Statistics/Statistics.tsx frontend/src/index.css frontend/src/test/timelineModals.test.tsx
git commit -m "feat: redesign login timeline and statistics"
```

### Task 4: Redesign node detail and settings, and wire the theme switcher into product settings

**Files:**
- Create: `frontend/src/components/ui/ThemePreviewCard.tsx`
- Modify: `frontend/src/pages/NodeDetail/NodeDetail.tsx`
- Modify: `frontend/src/pages/Settings/Settings.tsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/test/nodeWorkbench.test.tsx`
- Test: `frontend/src/test/themeProvider.test.tsx`

- [ ] **Step 1: Extend tests to cover the settings-based theme switcher**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Settings from '../pages/Settings/Settings'
import { ThemeProvider } from '../theme/ThemeProvider'
import { useAuthStore } from '../store/authStore'

describe('Settings theme switcher', () => {
  it('allows switching to champagne-light from the settings screen', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'alice', inviteCode: 'ABCD', partnerId: null } as any,
    })

    render(
      <ThemeProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: /奶油香槟/ }))
    expect(document.documentElement.dataset.theme).toBe('champagne-light')
  })
})
```

- [ ] **Step 2: Run node workbench and theme tests to verify the gap**

Run: `npm test -- --run frontend/src/test/nodeWorkbench.test.tsx frontend/src/test/themeProvider.test.tsx`

Expected: FAIL for the new theme-switcher assertion until settings consumes the provider.

- [ ] **Step 3: Implement the settings switcher and node detail redesign**

```tsx
// frontend/src/components/ui/ThemePreviewCard.tsx
import type { ThemeName } from '../../theme/themes'

type ThemePreviewCardProps = {
  themeKey: ThemeName
  title: string
  description: string
  selected: boolean
  swatches: string[]
  onSelect: (theme: ThemeName) => void
}

export default function ThemePreviewCard(props: ThemePreviewCardProps) {
  return (
    <button
      type="button"
      className={`theme-preview-card${props.selected ? ' theme-preview-card--active' : ''}`}
      onClick={() => props.onSelect(props.themeKey)}
    >
      <div className="theme-preview-card__swatches">
        {props.swatches.map((swatch) => <span key={swatch} style={{ background: swatch }} />)}
      </div>
      <strong>{props.title}</strong>
      <span>{props.description}</span>
    </button>
  )
}
```

```tsx
// Settings.tsx sketch
const { theme, setTheme } = useTheme()

return (
  <AppShell
    withBottomNav
    header={<BrandHeader eyebrow="Preferences" title="设置" subtitle={user?.username} />}
  >
    <SurfaceCard>
      <h2>外观主题</h2>
      <div className="theme-preview-grid">
        <ThemePreviewCard
          themeKey="ceremony-red"
          title="雅红金"
          description="中式雅致、酒红主调"
          swatches={['#7f1730', '#fff9f2', '#c8a062']}
          selected={theme === 'ceremony-red'}
          onSelect={setTheme}
        />
        <ThemePreviewCard
          themeKey="champagne-light"
          title="奶油香槟"
          description="轻盈柔和、香槟暖白"
          swatches={['#e9dccb', '#fffdf9', '#b88752']}
          selected={theme === 'champagne-light'}
          onSelect={setTheme}
        />
      </div>
    </SurfaceCard>
  </AppShell>
)
```

```tsx
// NodeDetail.tsx sketch
return (
  <AppShell
    header={
      <BrandHeader
        eyebrow="Node Workbook"
        title={data.node.name}
        subtitle={data.node.description || '围绕这个阶段集中推进待办、预算与备注'}
        aside={<StatusPill status={data.node.status as 'pending' | 'in_progress' | 'completed' | 'cancelled'} />}
      />
    }
  >
    <SurfaceCard className="node-summary-grid">{/* todo, income, balance */}</SurfaceCard>
    <SurfaceCard>{/* todo actions + list */}</SurfaceCard>
    <SurfaceCard>{/* memo */}</SurfaceCard>
    <SurfaceCard>{/* node actions */}</SurfaceCard>
  </AppShell>
)
```

- [ ] **Step 4: Run targeted tests and a frontend build**

Run: `npm test -- --run frontend/src/test/nodeWorkbench.test.tsx frontend/src/test/themeProvider.test.tsx frontend/src/test/authStore.test.ts && npm run build`

Expected: PASS for the targeted tests, then PASS for the frontend build.

- [ ] **Step 5: Commit the second page redesign batch**

```bash
git add frontend/src/components/ui/ThemePreviewCard.tsx frontend/src/pages/NodeDetail/NodeDetail.tsx frontend/src/pages/Settings/Settings.tsx frontend/src/index.css frontend/src/test/themeProvider.test.tsx frontend/src/test/nodeWorkbench.test.tsx
git commit -m "feat: redesign node detail and settings"
```

### Task 5: Final polish, accessibility cleanup, and regression verification

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Timeline/Timeline.tsx`
- Modify: `frontend/src/pages/Statistics/Statistics.tsx`
- Modify: `frontend/src/pages/Settings/Settings.tsx`
- Modify: `frontend/src/pages/Login/Login.tsx`
- Modify: `frontend/src/pages/NodeDetail/NodeDetail.tsx`
- Test: `frontend/src/test/themeProvider.test.tsx`
- Test: `frontend/src/test/timelineModals.test.tsx`
- Test: `frontend/src/test/nodeWorkbench.test.tsx`

- [ ] **Step 1: Add the final regression and accessibility checklist to code**

```css
/* index.css final pass */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

.focus-ring:focus-visible {
  outline: 2px solid var(--brand-accent);
  outline-offset: 2px;
}
```

```ts
// tailwind.config.js final semantic extension
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Run the full frontend test suite**

Run: `npm test`

Expected: PASS for all frontend Vitest cases, including auth, API, runtime, timeline modal, node detail, and realtime refresh coverage.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS with a generated Vite production bundle and no TypeScript errors.

- [ ] **Step 4: Manually verify the main flow in the browser**

Run: `npm run dev`

Expected:
- Login page shows branded hero and readable form card.
- Timeline page uses the new brand header, shared nav, and no emoji icons.
- Statistics page keeps readable metrics in both themes.
- Node detail page preserves todo, memo, and status operations.
- Settings page theme switcher updates the entire app immediately and persists after refresh.

- [ ] **Step 5: Commit the final polish**

```bash
git add frontend/src/index.css frontend/tailwind.config.js frontend/src/App.tsx frontend/src/pages/Login/Login.tsx frontend/src/pages/Timeline/Timeline.tsx frontend/src/pages/Statistics/Statistics.tsx frontend/src/pages/NodeDetail/NodeDetail.tsx frontend/src/pages/Settings/Settings.tsx
git commit -m "feat: finalize wedding themed ui polish"
```
