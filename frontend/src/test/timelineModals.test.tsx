import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Timeline from '../pages/Timeline/Timeline'
import { timelineAPI } from '../services/api'

const mockNavigate = vi.fn()
const mockEmitRealtimeEvent = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

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
    getTimelineMock.mockResolvedValue({
      data: { nodes: initialNodes, overallProgress: 10 },
    } as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
    createNodeMock.mockResolvedValue({ data: initialNodes[0] } as Awaited<ReturnType<typeof timelineAPI.createNode>>)
    updateNodeMock.mockResolvedValue({ data: initialNodes[0] } as Awaited<ReturnType<typeof timelineAPI.updateNode>>)
  })

  it('creates a node from a modal and uses DateField instead of a raw date input', async () => {
    render(<Timeline />)

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ 添加节点' }))

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

  it('edits a node from a modal and keeps the existing date picker flow', async () => {
    render(<Timeline />)

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '编辑' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('编辑节点')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '2026-05-01' })).toBeInTheDocument()

    fireEvent.change(within(dialog).getByDisplayValue('订酒店'), {
      target: { value: '订婚宴酒店' },
    })
    fireEvent.change(within(dialog).getByDisplayValue('确认宴会厅'), {
      target: { value: '确认宴会厅和菜单' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(updateNodeMock).toHaveBeenCalledWith(1, {
        name: '订婚宴酒店',
        description: '确认宴会厅和菜单',
        deadline: '2026-05-01',
        status: 'pending',
      })
    })
  })

  it('renders a fixed shell with separate header, scroll region, and bottom nav', async () => {
    render(<Timeline />)

    await screen.findByText('订酒店')

    expect(screen.getByTestId('timeline-shell')).toHaveClass('timeline-shell')
    expect(screen.getByTestId('timeline-header')).toHaveClass('timeline-shell__header')
    expect(screen.getByTestId('timeline-scroll-region')).toHaveClass('timeline-shell__scroll')
    expect(screen.getByTestId('timeline-bottom-nav')).toHaveClass('timeline-shell__nav')
  })
})
