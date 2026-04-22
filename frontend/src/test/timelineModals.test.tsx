import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Timeline from '../pages/Timeline/Timeline'
import { timelineAPI, timelineTemplateAPI } from '../services/api'

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
    timelineTemplateAPI: {
      ...actual.timelineTemplateAPI,
      listTemplates: vi.fn(),
      getTemplate: vi.fn(),
      applyTemplate: vi.fn(),
    },
  }
})

const getTimelineMock = vi.mocked(timelineAPI.getTimeline)
const createNodeMock = vi.mocked(timelineAPI.createNode)
const updateNodeMock = vi.mocked(timelineAPI.updateNode)
const listTemplatesMock = vi.mocked(timelineTemplateAPI.listTemplates)
const getTemplateMock = vi.mocked(timelineTemplateAPI.getTemplate)
const applyTemplateMock = vi.mocked(timelineTemplateAPI.applyTemplate)

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
    budget: 10000,
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
    listTemplatesMock.mockResolvedValue({
      data: {
        templates: [{ id: 1, name: '标准婚礼时间线', description: '默认婚礼阶段模板', nodeCount: 2 }],
      },
    } as Awaited<ReturnType<typeof timelineTemplateAPI.listTemplates>>)
    getTemplateMock.mockResolvedValue({
      data: {
        id: 1,
        name: '标准婚礼时间线',
        description: '默认婚礼阶段模板',
        nodes: [
          { id: 11, templateId: 1, name: '确定结婚意向', description: '先明确双方意愿', order: 1 },
          { id: 12, templateId: 1, name: '双方父母见面', description: '安排正式见面沟通', order: 2 },
        ],
      },
    } as Awaited<ReturnType<typeof timelineTemplateAPI.getTemplate>>)
    applyTemplateMock.mockResolvedValue({ data: { success: true } } as Awaited<ReturnType<typeof timelineTemplateAPI.applyTemplate>>)
    createNodeMock.mockResolvedValue({ data: initialNodes[0] } as Awaited<ReturnType<typeof timelineAPI.createNode>>)
    updateNodeMock.mockResolvedValue({ data: initialNodes[0] } as Awaited<ReturnType<typeof timelineAPI.updateNode>>)
  })

  it('shows template selection and create-first-node actions when the timeline is empty', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)

    renderTimeline()

    expect(await screen.findByRole('button', { name: '选择模板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创建第一个节点' })).toBeInTheDocument()
  })

  it('opens the template picker in list-first mode from an empty timeline', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))

    expect(await screen.findByText('选择一套初始时间线')).toBeInTheDocument()
    expect(screen.getByText('标准婚礼时间线')).toBeInTheDocument()
    expect(screen.getByText('默认婚礼阶段模板')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /标准婚礼时间线/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: '使用此模板' })).toBeNull()
  })

  it('navigates from the template list into a detail view and back again', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))

    fireEvent.click(await screen.findByRole('button', { name: /标准婚礼时间线/ }))

    expect(await screen.findByRole('button', { name: '使用此模板' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '返回' }))

    expect(await screen.findByText('选择一套初始时间线')).toBeInTheDocument()
    expect(screen.getByText('标准婚礼时间线')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '使用此模板' })).toBeNull()
  })

  it('restores the previous template selection when detail loading fails', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
    listTemplatesMock.mockResolvedValue({
      data: {
        templates: [
          { id: 1, name: '标准婚礼时间线', description: '默认婚礼阶段模板', nodeCount: 2 },
          { id: 2, name: '精简婚礼时间线', description: '更轻量的预置结构', nodeCount: 1 },
        ],
      },
    } as Awaited<ReturnType<typeof timelineTemplateAPI.listTemplates>>)
    getTemplateMock
      .mockResolvedValueOnce({
        data: {
          id: 1,
          name: '标准婚礼时间线',
          description: '默认婚礼阶段模板',
          nodes: [
            { id: 11, templateId: 1, name: '确定结婚意向', description: '先明确双方意愿', order: 1 },
          ],
        },
      } as Awaited<ReturnType<typeof timelineTemplateAPI.getTemplate>>)
      .mockRejectedValueOnce({ response: { data: { error: '模板详情加载失败' } } })

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))
    fireEvent.click(await screen.findByRole('button', { name: /标准婚礼时间线/ }))
    fireEvent.click(await screen.findByRole('button', { name: '返回' }))
    fireEvent.click(await screen.findByRole('button', { name: /精简婚礼时间线/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /标准婚礼时间线/ })).toHaveAttribute('aria-pressed', 'true')
    })
    expect(screen.getByRole('button', { name: /精简婚礼时间线/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the softened placeholder when a template node has no description', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
    getTemplateMock.mockImplementation(async () =>
      ({
        data: {
          id: 1,
          name: '标准婚礼时间线',
          description: '默认婚礼阶段模板',
          nodes: [
            { id: 11, templateId: 1, name: '确定结婚意向', description: '', order: 1 },
            { id: 12, templateId: 1, name: '双方父母见面', description: '安排正式见面沟通', order: 2 },
          ],
        },
      }) as Awaited<ReturnType<typeof timelineTemplateAPI.getTemplate>>,
    )

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))
    fireEvent.click(await screen.findByRole('button', { name: /标准婚礼时间线/ }))

    expect(await screen.findByText('暂未配置预置说明')).toBeInTheDocument()
    expect(screen.queryByText('无预置说明')).toBeNull()
  })

  it('uses the detail header fallback when template description is blank', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
    getTemplateMock.mockResolvedValueOnce({
      data: {
        id: 1,
        name: '标准婚礼时间线',
        description: '',
        nodes: [
          { id: 11, templateId: 1, name: '确定结婚意向', description: '先明确双方意愿', order: 1 },
        ],
      },
    } as Awaited<ReturnType<typeof timelineTemplateAPI.getTemplate>>)

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))
    fireEvent.click(await screen.findByRole('button', { name: /标准婚礼时间线/ }))

    await screen.findByRole('button', { name: '返回' })
    expect(screen.getAllByText('查看预置步骤后，再决定是否直接应用。')).not.toHaveLength(0)
  })

  it('shows the loaded detail step count instead of the list payload count in detail mode', async () => {
    getTimelineMock.mockResolvedValue({
      data: { nodes: [], overallProgress: 0 },
    } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
    listTemplatesMock.mockResolvedValueOnce({
      data: {
        templates: [{ id: 1, name: '标准婚礼时间线', description: '默认婚礼阶段模板', nodeCount: 4 }],
      },
    } as Awaited<ReturnType<typeof timelineTemplateAPI.listTemplates>>)
    getTemplateMock.mockResolvedValueOnce({
      data: {
        id: 1,
        name: '标准婚礼时间线',
        description: '默认婚礼阶段模板',
        nodes: [{ id: 11, templateId: 1, name: '确定结婚意向', description: '先明确双方意愿', order: 1 }],
      },
    } as Awaited<ReturnType<typeof timelineTemplateAPI.getTemplate>>)

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))
    fireEvent.click(await screen.findByRole('button', { name: /标准婚礼时间线/ }))

    expect(await screen.findByText('1 个步骤')).toBeInTheDocument()
    expect(screen.queryByText('4 个步骤')).toBeNull()
  })

  it('hides the template entry once timeline nodes exist', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择模板' })).toBeNull()
  })

  it('refreshes timeline nodes after applying a template', async () => {
    getTimelineMock
      .mockResolvedValueOnce({
        data: { nodes: [], overallProgress: 0 },
      } as unknown as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)
      .mockResolvedValueOnce({
        data: {
          nodes: [
            {
              id: 9,
              name: '确定结婚意向',
              description: '先明确双方意愿',
              status: 'pending',
              order: 1,
              deadline: '',
              progress: 0,
              createdAt: '2026-04-01',
              updatedAt: '2026-04-01',
            },
          ],
          overallProgress: 0,
        },
      } as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)

    renderTimeline()

    fireEvent.click(await screen.findByRole('button', { name: '选择模板' }))
    fireEvent.click(await screen.findByRole('button', { name: /标准婚礼时间线/ }))
    fireEvent.click(await screen.findByRole('button', { name: '使用此模板' }))

    await waitFor(() => {
      expect(applyTemplateMock).toHaveBeenCalledWith(1)
    })

    expect((await screen.findAllByText('确定结婚意向')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: '选择模板' })).toBeNull()
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

  it('renders create node as a full-width bottom drawer on mobile', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: '创建节点' }))

    const drawer = await screen.findByTestId('mobile-node-editor-drawer')
    expect(drawer).toBeInTheDocument()
    expect(within(drawer).getByText('创建节点')).toBeInTheDocument()
    expect(within(drawer).queryByText('节点状态')).toBeNull()
    expect(document.querySelector('.adm-dialog')).toBeNull()
  })

  it('renders create node inside the shared dialog shell on desktop', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '创建节点' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('创建节点')).toBeInTheDocument()
    expect(within(dialog).getByText('New Node')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: '创建' })).toBeInTheDocument()
    expect(within(dialog).queryByText('节点状态')).toBeNull()
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

    const drawer = await screen.findByTestId('mobile-node-editor-drawer')
    expect(drawer).toBeInTheDocument()
    expect(within(drawer).getByText('编辑节点')).toBeInTheDocument()
    expect(within(drawer).getByText('节点状态')).toBeInTheDocument()
    expect(document.querySelector('.adm-dialog')).toBeNull()
  })

  it('renders full edit as a desktop dialog on web', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('更多操作'))
    fireEvent.click(screen.getByRole('button', { name: '完整编辑' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-node-editor-drawer')).toBeNull()
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

  it('cancels inline node name editing with escape without saving', async () => {
    renderTimeline()

    expect(await screen.findByText('订酒店')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('编辑节点名称'))

    const inlineInput = screen.getByDisplayValue('订酒店')
    fireEvent.change(inlineInput, { target: { value: '不会保存的新名称' } })
    fireEvent.keyDown(inlineInput, { key: 'Escape' })

    expect(updateNodeMock).not.toHaveBeenCalled()
    expect(screen.getByText('订酒店')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('不会保存的新名称')).toBeNull()
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

  it('renders nodes in backend order without re-sorting by deadline', async () => {
    getTimelineMock.mockResolvedValueOnce({
      data: {
        nodes: [
          {
            id: 2,
            name: '后返回的节点',
            description: 'deadline 更晚',
            status: 'pending',
            order: 2,
            budget: 20000,
            deadline: '2026-06-01',
            progress: 0,
            createdAt: '2026-04-02',
            updatedAt: '2026-04-02',
          },
          {
            id: 1,
            name: '先返回的节点',
            description: 'deadline 更早',
            status: 'pending',
            order: 1,
            budget: 10000,
            deadline: '2026-05-01',
            progress: 0,
            createdAt: '2026-04-01',
            updatedAt: '2026-04-01',
          },
        ],
        overallProgress: 0,
      },
    } as Awaited<ReturnType<typeof timelineAPI.getTimeline>>)

    renderTimeline()

    const titles = await screen.findAllByText(/返回的节点/)
    expect(titles.map((item) => item.textContent)).toEqual(['后返回的节点', '先返回的节点'])
  })

  it('keeps the status pill on one line', async () => {
    renderTimeline()

    await screen.findByText('订酒店')

    const pill = screen.getByText('待处理')
    expect(pill).toHaveClass('whitespace-nowrap')
  })
})
