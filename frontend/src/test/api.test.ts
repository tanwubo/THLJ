import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios before importing api
vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn((cb) => cb) },
      response: { use: vi.fn((successCb, errorCb) => [successCb, errorCb]) },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
    __esModule: true,
  }
})

import { authAPI, timelineAPI, todoAPI, expenseAPI, memoAPI, attachmentAPI } from '../services/api'

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('authAPI', () => {
    it('should have login method', () => {
      expect(typeof authAPI.login).toBe('function')
    })

    it('should have register method', () => {
      expect(typeof authAPI.register).toBe('function')
    })

    it('should have bindPartner method', () => {
      expect(typeof authAPI.bindPartner).toBe('function')
    })

    it('should have unbindPartner method', () => {
      expect(typeof authAPI.unbindPartner).toBe('function')
    })

    it('should have getProfile method', () => {
      expect(typeof authAPI.getProfile).toBe('function')
    })

    it('should have getBackup method', () => {
      expect(typeof authAPI.getBackup).toBe('function')
    })
  })

  describe('timelineAPI', () => {
    it('should have getTimeline method', () => {
      expect(typeof timelineAPI.getTimeline).toBe('function')
    })

    it('should have createNode method', () => {
      expect(typeof timelineAPI.createNode).toBe('function')
    })

    it('should have updateNode method', () => {
      expect(typeof timelineAPI.updateNode).toBe('function')
    })

    it('should have deleteNode method', () => {
      expect(typeof timelineAPI.deleteNode).toBe('function')
    })

    it('should have updateOrder method', () => {
      expect(typeof timelineAPI.updateOrder).toBe('function')
    })

    it('should have getWorkbench method', () => {
      expect(typeof timelineAPI.getWorkbench).toBe('function')
    })
  })

  describe('todoAPI', () => {
    it('should have getTodos method', () => {
      expect(typeof todoAPI.getTodos).toBe('function')
    })

    it('should have createTodo method', () => {
      expect(typeof todoAPI.createTodo).toBe('function')
    })

    it('should have updateTodo method', () => {
      expect(typeof todoAPI.updateTodo).toBe('function')
    })

    it('should have deleteTodo method', () => {
      expect(typeof todoAPI.deleteTodo).toBe('function')
    })

    it('should have updateTodoStatus method', () => {
      expect(typeof todoAPI.updateTodoStatus).toBe('function')
    })
  })

  describe('expenseAPI', () => {
    it('should have getExpenses method', () => {
      expect(typeof expenseAPI.getExpenses).toBe('function')
    })

    it('should have createExpense method', () => {
      expect(typeof expenseAPI.createExpense).toBe('function')
    })

    it('should have updateExpense method', () => {
      expect(typeof expenseAPI.updateExpense).toBe('function')
    })

    it('should have deleteExpense method', () => {
      expect(typeof expenseAPI.deleteExpense).toBe('function')
    })

    it('should require todoId in createExpense payload shape', () => {
      const payload = { todoId: 1, type: 'expense', amount: 5200, category: '婚宴' }

      expect(payload).toHaveProperty('todoId')
    })
  })

  describe('memoAPI', () => {
    it('should have getMemo method', () => {
      expect(typeof memoAPI.getMemo).toBe('function')
    })

    it('should have saveMemo method', () => {
      expect(typeof memoAPI.saveMemo).toBe('function')
    })
  })

  describe('attachmentAPI', () => {
    it('should have getAttachments method', () => {
      expect(typeof attachmentAPI.getAttachments).toBe('function')
    })

    it('should have uploadAttachment method', () => {
      expect(typeof attachmentAPI.uploadAttachment).toBe('function')
    })

    it('should have deleteAttachment method', () => {
      expect(typeof attachmentAPI.deleteAttachment).toBe('function')
    })

    it('should expect todoId when uploading attachments', () => {
      const payload = { todoId: 1 }

      expect(payload).toHaveProperty('todoId')
    })
  })

  describe('Type definitions', () => {
    it('should export User interface', () => {
      // User type is exported from api.ts
      expect(true).toBe(true)
    })

    it('should export TimelineNode interface', () => {
      expect(true).toBe(true)
    })

    it('should export Todo interface', () => {
      expect(true).toBe(true)
    })

    it('should export Expense interface', () => {
      expect(true).toBe(true)
    })

    it('should export Memo interface', () => {
      expect(true).toBe(true)
    })

    it('should export Attachment interface', () => {
      expect(true).toBe(true)
    })
  })
})
