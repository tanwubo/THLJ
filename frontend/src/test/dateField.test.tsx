import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DateField } from '../components/DateField'

describe('DateField', () => {
  it('opens a popup picker instead of rendering a raw date input', () => {
    const { container } = render(<DateField value="" onChange={() => undefined} label="截止日期" />)

    expect(screen.getByText('截止日期')).toBeInTheDocument()
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(screen.getByRole('button', { name: '请选择日期' })).toBeInTheDocument()
  })
})
