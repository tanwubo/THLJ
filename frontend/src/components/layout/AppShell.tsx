import type { PropsWithChildren, ReactNode } from 'react'
import BottomNav from './BottomNav'

type AppShellProps = PropsWithChildren<{
  header?: ReactNode
  withBottomNav?: boolean
  contentClassName?: string
}>

export default function AppShell({ children, header, withBottomNav = false, contentClassName = '' }: AppShellProps) {
  const contentClasses = ['app-shell__content', contentClassName].filter(Boolean).join(' ')

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true" />
      {header ? <div className="app-shell__header">{header}</div> : null}
      <main className={contentClasses}>{children}</main>
      {withBottomNav ? <BottomNav /> : null}
    </div>
  )
}
