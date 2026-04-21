import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ThemedCalendarPicker from '../components/ThemedCalendarPicker'

describe('ThemedCalendarPicker', () => {
  it('opens a year and month quick switcher from the title', () => {
    render(<ThemedCalendarPicker value="2026-05-01" onSelect={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: '打开年月快捷选择' }))

    expect(screen.getByText('快速选择年份与月份')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2026年' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5月' })).toBeInTheDocument()
  })

  it('jumps to the selected year and month from the quick switcher', () => {
    render(<ThemedCalendarPicker value="2026-05-01" onSelect={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: '打开年月快捷选择' }))
    fireEvent.click(screen.getByRole('button', { name: '切换年份区间' }))
    fireEvent.click(screen.getByRole('button', { name: '2032年' }))
    fireEvent.click(screen.getByRole('button', { name: '11月' }))

    expect(screen.getByText('2032年11月')).toBeInTheDocument()
    expect(screen.queryByText('快速选择年份与月份')).toBeNull()
  })

  it('keeps direct day selection working after switching month', () => {
    const onSelect = vi.fn()

    render(<ThemedCalendarPicker value="2026-05-01" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: '打开年月快捷选择' }))
    fireEvent.click(screen.getByRole('button', { name: '6月' }))
    fireEvent.click(screen.getByRole('button', { name: '选择 2026-06-18' }))

    expect(onSelect).toHaveBeenCalledWith('2026-06-18')
  })
})
