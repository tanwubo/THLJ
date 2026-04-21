import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TimelineTemplates from '../pages/Settings/TimelineTemplates'
import { timelineTemplateAPI } from '../services/api'

const authState = {
  token: 'token',
  _hasHydrated: true,
  user: {
    id: 1,
    username: 'alice',
    inviteCode: 'ABCD12',
    isAdmin: true,
    createdAt: '2026-01-01',
    lastLogin: '2026-01-01',
  },
}

vi.mock('../store/authStore', () => ({
  useAuthStore: () => authState,
}))

vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    timelineTemplateAPI: {
      ...actual.timelineTemplateAPI,
      listTemplates: vi.fn(),
      getTemplate: vi.fn(),
      createTemplate: vi.fn(),
      updateTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
    },
  }
})

describe('timeline template admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(timelineTemplateAPI.listTemplates).mockResolvedValue({
      data: {
        templates: [{ id: 1, name: '标准婚礼时间线', description: '默认模板', isActive: true }],
      },
    } as any)
    vi.mocked(timelineTemplateAPI.getTemplate).mockResolvedValue({
      data: {
        id: 1,
        name: '标准婚礼时间线',
        description: '默认模板',
        isActive: true,
        nodes: [
          { id: 11, templateId: 1, name: '确定结婚意向', description: '先确认意愿', order: 1 },
        ],
      },
    } as any)
    vi.mocked(timelineTemplateAPI.updateTemplate).mockResolvedValue({ data: { success: true } } as any)
    vi.mocked(timelineTemplateAPI.createTemplate).mockResolvedValue({ data: { success: true, id: 2 } } as any)
    vi.mocked(timelineTemplateAPI.deleteTemplate).mockResolvedValue({ data: { success: true } } as any)
  })

  it('loads templates and saves edited template nodes from the admin page', async () => {
    render(
      <MemoryRouter>
        <TimelineTemplates />
      </MemoryRouter>,
    )

    expect(await screen.findByText('标准婚礼时间线')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '标准婚礼时间线' }))

    expect(await screen.findByDisplayValue('标准婚礼时间线')).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('标准婚礼时间线'), { target: { value: '标准婚礼流程' } })
    fireEvent.change(screen.getByDisplayValue('先确认意愿'), { target: { value: '先确认双方意愿' } })
    fireEvent.click(screen.getByRole('button', { name: '保存模板' }))

    await waitFor(() => {
      expect(timelineTemplateAPI.updateTemplate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          name: '标准婚礼流程',
          nodes: [
            expect.objectContaining({
              name: '确定结婚意向',
              description: '先确认双方意愿',
            }),
          ],
        }),
      )
    })
  })

  it('creates and deletes templates from the admin page', async () => {
    render(
      <MemoryRouter>
        <TimelineTemplates />
      </MemoryRouter>,
    )

    expect(await screen.findByText('标准婚礼时间线')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新建模板' }))
    fireEvent.change(await screen.findByPlaceholderText('模板名称'), { target: { value: '自定义模板' } })
    fireEvent.change(screen.getByPlaceholderText('节点名称'), { target: { value: '自定义节点' } })
    fireEvent.click(screen.getByRole('button', { name: '保存模板' }))

    await waitFor(() => {
      expect(timelineTemplateAPI.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '自定义模板',
          nodes: [expect.objectContaining({ name: '自定义节点' })],
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: '标准婚礼时间线' }))
    fireEvent.click(screen.getByRole('button', { name: '删除模板' }))

    await waitFor(() => {
      expect(timelineTemplateAPI.deleteTemplate).toHaveBeenCalledWith(1)
    })
  })
})
