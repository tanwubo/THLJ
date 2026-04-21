import type { ReactNode } from 'react'

type BrandHeaderProps = {
  eyebrow: string
  title: string
  subtitle?: string
  aside?: ReactNode
}

export default function BrandHeader({ eyebrow, title, subtitle, aside }: BrandHeaderProps) {
  return (
    <header className="brand-header">
      <div className="brand-header__body">
        <p className="brand-header__eyebrow">{eyebrow}</p>
        <h1 className="brand-header__title">{title}</h1>
        {subtitle ? <p className="brand-header__subtitle">{subtitle}</p> : null}
      </div>
      {aside ? <div className="brand-header__aside">{aside}</div> : null}
    </header>
  )
}
