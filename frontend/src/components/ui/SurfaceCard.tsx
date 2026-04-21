import type { PropsWithChildren } from 'react'

type SurfaceCardProps = PropsWithChildren<{
  className?: string
}>

export default function SurfaceCard({ children, className = '' }: SurfaceCardProps) {
  const classes = ['surface-card', className].filter(Boolean).join(' ')
  return <section className={classes}>{children}</section>
}
