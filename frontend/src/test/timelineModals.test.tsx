import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Timeline from '../pages/Timeline/Timeline'
import { timelineAPI } from '../services/api'

const mockNavigate = vi.fn()
const mockEmitRealtimeEvent = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    NavLink: ({ children, to, className }: { children: ReactNode; to: string; className?: string | ((props: { isActive: boolean }) => string) }) => (
      <a href={to} className={typeof className === 'function' ? className({ isActive: to === '/' }) : className}>
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../hooks/useRealtimeRefresh', () => ({
  useRealtimeRefresh: () => undefined,
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { username: 'alice' },
    partnerId: 2,
    emitRealtimeEvent: mockEmitRealtimeEvent,
  }),
}))

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    timelineAPI: {
      ...actual.timelineAPI,
      getTimeline: vi.fn(),
      createNode: vi.fn(),
      updateNode: vi.fn(),
      deleteNode: vi.fn(),
    },
  }
})

const getTimelineMock = vi.mocked(timelineAPI.getTimeline)
const createNodeMock = vi.mocked(timelineAPI.createNode)
const updateNodeMock = vi.mocked(timelineAPI.updateNode)

function renderTimeline() {
  render(
    <MemoryRouter>
      <Timeline />
    </MemoryRouter>,
  )
}

const initialNodes = [
  {
    id: 1,
    name: '订酒店',
    description: '确认宴会厅',
    status: 'pending' as const,
    order: 1,
    deadline: '2026-05-01',
    progress: 10,
    createdAt: '2026-04-01',
    updatedAt: '2026-04-01',
  },
]

describe('Timeline modal flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    getTimelineMock.mockResolvedValue({
      data: { nodes: initialNodes, overallProgress: 10 },
    } as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
    createNodeMock.mockResolvedValue({ data: initialNodes[0] } as Awaited<ReturnType<typeof timelineAPI.createNode>>)
    updateNodeMock.mockResolvedValue({ data: initialNodes[0] } as Awaited<ReturnType<typeof timelineAPI.updateNode>>)
  })

  it('creates a node from a modal and uses DateField instead of a raw date input', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '创建节点' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('创建节点')).toBeInTheDocument()
    expect(within(dialog).getByText('截止日期')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '请选择日期' })).toBeInTheDocument()
    expect(dialog.querySelector('input[type="date"]')).toBeNull()

    fireEvent.change(within(dialog).getByPlaceholderText('节点名称 *'), {
      target: { value: '拍婚纱照' },
    })
    fireEvent.change(within(dialog).getByPlaceholderText('描述（可选）'), {
      target: { value: '先定摄影档期' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '创建' }))

    await waitFor(() => {
      expect(createNodeMock).toHaveBeenCalledWith({
        name: '拍婚纱照',
        description: '先定摄影档期',
        deadline: undefined,
      })
    })
  })

  it('opens full edit from the three-dot menu and keeps the date picker flow', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(screen.getByRole('button', { name: '完整编辑' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('编辑节点')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '2026-05-01' })).toBeInTheDocument()
    expect(within(dialog).queryByText('2026年5月')).toBeNull()

    fireEvent.click(within(dialog).getByRole('button', { name: '2026-05-01' }))

    expect(await screen.findByText('2026年5月')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择 2026-05-21' })).toBeInTheDocument()

    fireEvent.change(within(dialog).getByDisplayValue('订酒店'), {
      target: { value: '订婚宴酒店' },
    })
    fireEvent.change(within(dialog).getByDisplayValue('确认宴会厅'), {
      target: { value: '确认宴会厅和菜单' },
    })
    fireEvent.click(screen.getByRole('button', { name: '选择 2026-05-21' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(updateNodeMock).toHaveBeenCalledWith(1, {
        name: '订婚宴酒店',
        description: '确认宴会厅和菜单',
        deadline: '2026-05-21',
        status: 'pending',
      })
    })
  })

  it('renders full edit as a full-width bottom drawer on mobile', async () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(screen.getByRole('button', { name: '完整编辑' }))

    const drawer = await screen.findByTestId('mobile-full-edit-drawer')
    expect(drawer).toBeInTheDocument()
    expect(document.querySelector('.adm-dialog')).toBeNull()
  })

  it('renders full edit as a desktop dialog on web', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(screen.getByRole('button', { name: '完整编辑' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-full-edit-drawer')).toBeNull()
  })

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

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('编辑节点名称'))

    const inlineInput = screen.getByDisplayValue('订酒店')
    fireEvent.change(inlineInput, { target: { value: '订婚礼酒店' } })
    fireEvent.blur(inlineInput)

    await waitFor(() => {
      expect(updateNodeMock).toHaveBeenCalledWith(1, {
        name: '订婚礼酒店',
        description: '确认宴会厅',
        deadline: '2026-05-01',
        status: 'pending',
      })
    })
  })

  it('opens a status dropdown and saves the selected status inline', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('编辑节点状态'))
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

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('更多操作'))

    expect(screen.getByRole('button', { name: '完整编辑' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除节点' })).toBeInTheDocument()
  })

  it('uses a bottom popup deadline editor on mobile', async () => {
    vi.mocked(window.matchMedia).mockImplementation((query) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('编辑节点时间'))

    expect(await screen.findByText('调整节点时间')).toBeInTheDocument()
    expect(document.querySelector('.adm-popup-body')).not.toBeNull()
    expect(screen.queryByTestId('desktop-deadline-panel')).toBeNull()
    expect(screen.getByText('2026年5月')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('2026-05-01')).toBeNull()
  })

  it('uses an anchored floating deadline editor on desktop', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('编辑节点时间'))

    expect(await screen.findByText('调整节点时间')).toBeInTheDocument()
    expect(screen.getByTestId('desktop-deadline-panel')).toBeInTheDocument()
    expect(document.querySelector('.adm-popup-body')).toBeNull()
    expect(screen.getByText('2026年5月')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('2026-05-01')).toBeNull()
  })

  it('opens the themed calendar directly from the deadline field and saves the selected day', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('编辑节点时间'))
    fireEvent.click(screen.getByRole('button', { name: '选择 2026-05-21' }))

    await waitFor(() => {
      expect(updateNodeMock).toHaveBeenCalledWith(1, {
        name: '订酒店',
        description: '确认宴会厅',
        deadline: '2026-05-21',
        status: 'pending',
      })
    })
  })

  it('renders the node description as a single-line truncated subtitle', async () => {
    renderTimeline()

    const description = await screen.findByText('确认宴会厅')

    expect(description).toHaveClass('timeline-node-card__description')
    expect(description).toHaveAttribute('title', '确认宴会厅')
  })

  it('renders the themed shell with brand header and bottom nav', async () => {
    renderTimeline()

    await screen.findByText('订酒店')

    expect(screen.getByRole('heading', { name: '婚礼时间线' })).toBeInTheDocument()
    expect(screen.getByText('Ceremony Planner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
  })

  it('renders the redesigned themed timeline header instead of the legacy emoji title', async () => {
    renderTimeline()

    await screen.findByText('订酒店')

    expect(screen.getByRole('heading', { name: '婚礼时间线' })).toBeInTheDocument()
    expect(screen.queryByText('💒 婚嫁管家')).not.toBeInTheDocument()
  })
})
