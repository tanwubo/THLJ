import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '时间线' },
  { to: '/statistics', label: '统计' },
  { to: '/settings', label: '设置' },
] as const

export default function BottomNav() {
  return (
    <nav aria-label="主导航" className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            ['bottom-nav__item', isActive ? 'bottom-nav__item--active' : '']
              .filter(Boolean)
              .join(' ')
          }
        >
          <span className="bottom-nav__icon" aria-hidden="true" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
