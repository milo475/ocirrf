import { NavLink, Outlet } from 'react-router'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { to: '/', label: 'Самбар', end: true },
  { to: '/products', label: 'Бараа' },
  { to: '/orders', label: 'Захиалга' },
  { to: '/stock', label: 'Үлдэгдэл' },
  { to: '/users', label: 'Хэрэглэгчид' },
]

function navClass({ isActive }) {
  return [
    'px-3 py-1.5 rounded text-sm transition-colors',
    isActive
      ? 'text-ink bg-surface'
      : 'text-ink-muted hover:text-ink',
  ].join(' ')
}

export default function AppShell() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <NavLink to="/" className="font-serif text-xl font-medium tracking-tight">
            ursGAL
          </NavLink>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {/* Хэрэглэгчийн цэс — auth холбогдоход жинхэнэ болно */}
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-surface border border-rule text-xs font-mono text-ink-muted"
              title="Хэрэглэгч (түр placeholder)"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
