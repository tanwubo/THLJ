import { describe, it, expect, vi } from 'vitest'

import { buildTodoTemplateDialogConfig } from '../pages/NodeDetail/todoTemplateDialog'

describe('todo template dialog', () => {
  it('includes an explicit cancel action and allows closing on mask click', async () => {
    const onSelect = vi.fn()
    const config = buildTodoTemplateDialogConfig(onSelect)
    const cancelAction = config.actions[config.actions.length - 1] as { onClick?: () => void | Promise<void> }

    expect(config.closeOnMaskClick).toBe(true)
    expect(cancelAction).toMatchObject({
      key: 'cancel',
      text: '取消',
    })

    const firstAction = config.actions[0] as { onClick?: () => void | Promise<void> }
    await firstAction.onClick?.()
    expect(onSelect).toHaveBeenCalledTimes(1)

    await cancelAction.onClick?.()
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
