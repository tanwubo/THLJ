import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({
  initDB: vi.fn(),
  exec: vi.fn(),
  query: vi.fn(() => [{ id: 1 }]),
  run: vi.fn(),
  runInTransaction: vi.fn(),
  db: {
    exec: vi.fn(),
  },
}))

vi.mock('../db/init', () => ({
  applyWorkbenchSchema: vi.fn(),
}))

describe('bootstrapDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes the database and applies workbench schema migrations on server startup', async () => {
    const { bootstrapDatabase } = await import('../bootstrap')
    const dbModule = await import('../db')
    const initModule = await import('../db/init')

    await bootstrapDatabase()

    expect(dbModule.initDB).toHaveBeenCalledTimes(1)
    expect(initModule.applyWorkbenchSchema).toHaveBeenCalledTimes(1)
    expect(initModule.applyWorkbenchSchema).toHaveBeenCalledWith({
      exec: expect.any(Function),
      run: expect.any(Function),
    })
  })
})
