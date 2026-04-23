import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatusPill from '../components/ui/StatusPill'

describe('StatusPill', () => {
  it('renders default variant with correct label', () => {
    render(<StatusPill status="completed" />)
    expect(screen.getByText('已完成')).toBeInTheDocument()
  })

  it('applies inverse class when inverse prop is true', () => {
    render(<StatusPill status="completed" inverse />)
    const pill = screen.getByText('已完成')
    expect(pill.classList.contains('status-pill--inverse')).toBe(true)
  })

  it('does not apply inverse class by default', () => {
    render(<StatusPill status="pending" />)
    const pill = screen.getByText('待处理')
    expect(pill.classList.contains('status-pill--inverse')).toBe(false)
  })
})
