import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import ThemeToggle from './ThemeToggle'

/** Эрх бүрийн nav — эрхийн матрицтай нийцнэ */
const NAV_BY_ROLE = {
  ADMIN: [
    { to: '/', label: 'Нүүр', end: true },
    { to: '/orders', label: 'Захиалга' },
    { to: '/products', label: 'Бараа' },
    { to: '/stock', label: 'Агуулах' },
    { to: '/users', label: 'Хэрэглэгчид' },
  ],
  MANAGER: [
    { to: '/', label: 'Нүүр', end: true },
    { to: '/orders', label: 'Захиалга' },
    { to: '/products', label: 'Бараа' },
    { to: '/stock', label: 'Агуулах' },
  ],
  OPERATOR: [
    { to: '/', label: 'Нүүр', end: true },
    { to: '/orders', label: 'Захиалга' },
    { to: '/products', label: 'Бараа' },
  ],
  // Жолооч утсаараа ашиглана — зөвхөн 2 линк, том товч
  DRIVER: [
    { to: '/deliveries', label: 'Миний хүргэлт' },
    { to: '/', label: 'Нүүр', end: true },
  ],
}

const ROLE_LABELS = {
  ADMIN: 'Админ',
  MANAGER: 'Менежер',
  OPERATOR: 'Оператор',
  DRIVER: 'Жолооч',
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  // Эрхийн accent тема: root дээр data-role
  useEffect(() => {
    if (user) {
      document.documentElement.dataset.role = user.role.toLowerCase()
    }
    return () => {
      delete document.documentElement.dataset.role
    }
  }, [user])

  const items = NAV_BY_ROLE[user?.role] ?? []
  const isDriver = user?.role === 'DRIVER'

  const navClass = ({ isActive }) =>
    [
      isDriver
        ? 'px-4 py-2.5 rounded text-base font-medium transition-colors'
        : 'px-3 py-1.5 rounded text-sm transition-colors',
      isActive
        ? 'text-accent bg-surface'
        : 'text-ink-muted hover:text-ink',
    ].join(' ')

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-rule">
        <div
          className={`max-w-6xl mx-auto px-4 md:px-6 flex items-center gap-3 md:gap-6 flex-wrap ${
            isDriver ? 'min-h-16 py-2' : 'h-14'
          }`}
        >
          <NavLink to="/" className="font-serif text-xl font-medium tracking-tight">
            ursGAL
          </NavLink>

          <nav className="flex items-center gap-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <NavLink
              to="/settings"
              title={t('Тохиргоо')}
              className={({ isActive }) =>
                `text-lg leading-none px-1 ${isActive ? 'text-accent' : 'text-ink-muted hover:text-ink'}`
              }
            >
              ⚙
            </NavLink>
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm hidden sm:inline">{user.name}</span>
                <span className="font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 text-accent border-accent/40 bg-accent/12">
                  {t(ROLE_LABELS[user.role] ?? user.role)}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-ink-muted hover:text-alarm transition-colors"
                >
                  {t('Гарах')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Outlet />
      </main>
    </div>
  )
}
