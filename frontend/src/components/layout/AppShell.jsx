import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { to: '/', label: 'Самбар', end: true },
  { to: '/products', label: 'Бараа' },
  { to: '/orders', label: 'Захиалга' },
  { to: '/stock', label: 'Үлдэгдэл' },
  { to: '/users', label: 'Хэрэглэгчид', adminOnly: true },
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
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === 'ADMIN',
  )

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
          <NavLink to="/" className="font-serif text-xl font-medium tracking-tight">
            ursGAL
          </NavLink>

          <nav className="flex items-center gap-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm">{user.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-wide border border-rule rounded px-1.5 py-0.5 text-ink-muted">
                  {user.role === 'ADMIN' ? 'Админ' : 'Оператор'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-ink-muted hover:text-alarm transition-colors"
                >
                  Гарах
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
