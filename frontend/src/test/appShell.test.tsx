import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AppShell from '../components/layout/AppShell'
import BrandHeader from '../components/layout/BrandHeader'

describe('AppShell', () => {
  it('renders a brand header and text-based bottom navigation', () => {
    render(
      <MemoryRouter>
        <AppShell
          header={
            <BrandHeader eyebrow="Wedding Manager" title="婚礼筹备" subtitle="主工作台" />
          }
          withBottomNav
        >
          <div>content</div>
        </AppShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '婚礼筹备' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /时间线/ })).toBeInTheDocument()
    expect(screen.queryByText('📋')).not.toBeInTheDocument()
  })
})
