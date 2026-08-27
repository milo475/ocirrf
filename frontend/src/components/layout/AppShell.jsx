import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Bell, LogOut, PanelLeft, PanelLeftClose, Settings } from 'lucide-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { navFor } from '../../config/nav'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LanguageContext'
import { api, getAccessToken } from '../../lib/api'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'

const ROLE_LABELS = {
  ADMIN: 'Админ',
  MANAGER: 'Менежер',
  OPERATOR: 'Оператор',
  DRIVER: 'Жолооч',
  CUSTOMER: 'Харилцагч',
}

/**
 * Layout: зүүн талд эвхэгддэг sidebar (md+), дээд талд нимгэн topbar,
 * mobile дээр sidebar-ын оронд доод tab bar (жолоочийн mobile-first хэвээр).
 */
export default function AppShell() {
  const { user, logout, hasPerm } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('ursgal.sidebar') === '1',
  )

  // Эрхийн accent тема: root дээр data-role
  useEffect(() => {
    if (user) {
      document.documentElement.dataset.role = user.role.toLowerCase()
    }
    return () => {
      delete document.documentElement.dataset.role
    }
  }, [user])

  const items = navFor(user, hasPerm)

  // Уншаагүй мэдэгдлийн тоо — 30 сек тутам + read үйлдлийн дараа event-ээр
  const [unread, setUnread] = useState(0)
  const refreshUnread = useCallback(() => {
    api('/notifications/unread-count')
      .then((d) => setUnread(d.count))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!user) return
    refreshUnread()
    const id = setInterval(refreshUnread, 30_000)
    window.addEventListener('notif:refresh', refreshUnread)
    return () => {
      clearInterval(id)
      window.removeEventListener('notif:refresh', refreshUnread)
    }
  }, [user, refreshUnread])

  // SSE (V4-09): мэдэгдэл ирмэгц badge шууд шинэчлэгдэнэ.
  // Тасарвал 5с тутам дахин холбогдоно; дээрх 30с poll fallback хэвээр.
  useEffect(() => {
    if (!user) return
    let es = null
    let retry = null
    let stopped = false

    const connect = () => {
      const token = getAccessToken()
      if (!token) {
        retry = setTimeout(connect, 5000)
        return
      }
      es = new EventSource(
        `/api/notifications/stream?token=${encodeURIComponent(token)}`,
      )
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.type === 'notification') {
            setUnread(d.unreadCount)
            // Нээлттэй хуудсууд (Миний хүргэлт г.м.) шууд шинэчлэгдэнэ
            window.dispatchEvent(new Event('notif:push'))
          }
        } catch {
          /* ping */
        }
      }
      es.onerror = () => {
        es?.close()
        if (!stopped) retry = setTimeout(connect, 5000)
      }
    }
    connect()
    return () => {
      stopped = true
      es?.close()
      clearTimeout(retry)
    }
  }, [user])

  function toggleSidebar() {
    setCollapsed((c) => {
      localStorage.setItem('ursgal.sidebar', c ? '0' : '1')
      return !c
    })
  }

  // Санамсаргүй дарж гарахаас хамгаална — эхлээд баталгаажуулна
  const [logoutOpen, setLogoutOpen] = useState(false)

  function handleLogout() {
    setLogoutOpen(false)
    logout()
    navigate('/login')
  }

  const sideLink = ({ isActive }) =>
    [
      'flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors',
      collapsed ? 'justify-center px-2' : '',
      isActive
        ? 'text-accent bg-accent/10 font-medium'
        : 'text-ink-muted hover:text-ink hover:bg-surface',
    ].join(' ')

  const tabLink = ({ isActive }) =>
    [
      'flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors',
      isActive ? 'text-accent' : 'text-ink-muted',
    ].join(' ')

  return (
    <div className="min-h-screen bg-bg text-ink flex">
      {/* ── Sidebar (md+) ── */}
      <aside
        className={`hidden md:flex flex-col border-r border-rule shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <nav className="flex-1 overflow-y-auto p-2 space-y-1 mt-2">
          {items.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.end}
              className={sideLink}
              title={collapsed ? t(item.label) : undefined}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{t(item.label)}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Доод хэсэг: тохиргоо + хэрэглэгч + гарах */}
        <div className="border-t border-rule p-2 space-y-1">
          <NavLink
            to="/settings"
            className={sideLink}
            title={collapsed ? t('Тохиргоо') : undefined}
          >
            <Settings size={18} className="shrink-0" />
            {!collapsed && <span>{t('Тохиргоо')}</span>}
          </NavLink>

          {user && !collapsed && (
            <div className="px-3 py-2">
              <p className="text-sm truncate">{user.name}</p>
              <span className="mt-1 inline-flex font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 text-accent border-accent/40 bg-accent/12">
                {t(ROLE_LABELS[user.role] ?? user.role)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            title={collapsed ? t('Гарах') : undefined}
            className={`w-full flex items-center gap-3 rounded px-3 py-2 text-sm text-ink-muted hover:text-alarm transition-colors ${
              collapsed ? 'justify-center px-2' : ''
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>{t('Гарах')}</span>}
          </button>

          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? t('Цэс дэлгэх') : t('Цэс хумих')}
            className={`w-full flex items-center gap-3 rounded px-3 py-2 text-sm text-ink-muted hover:text-ink transition-colors ${
              collapsed ? 'justify-center px-2' : ''
            }`}
          >
            {collapsed ? (
              <PanelLeft size={18} className="shrink-0" />
            ) : (
              <>
                <PanelLeftClose size={18} className="shrink-0" />
                <span>{t('Цэс хумих')}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Баруун тал: topbar + контент ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-12 border-b border-rule flex items-center gap-3 px-4 md:px-6 shrink-0">
          <NavLink to="/" className="font-serif text-xl font-medium tracking-tight">
            ursGAL
          </NavLink>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <NotificationBell unread={unread} />
            <ThemeToggle />
            {/* Mobile дээр sidebar байхгүй тул тохиргоо/гарах topbar-т */}
            <NavLink
              to="/settings"
              title={t('Тохиргоо')}
              className={({ isActive }) =>
                `md:hidden p-1 ${isActive ? 'text-accent' : 'text-ink-muted'}`
              }
            >
              <Settings size={18} />
            </NavLink>
            {user && (
              <span className="md:hidden font-mono text-[11px] uppercase tracking-wide border rounded px-1.5 py-0.5 text-accent border-accent/40 bg-accent/12">
                {t(ROLE_LABELS[user.role] ?? user.role)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="md:hidden text-sm text-ink-muted hover:text-alarm transition-colors"
            >
              {t('Гарах')}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-6 md:py-10 pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Гарахын өмнөх баталгаажуулалт */}
      <ConfirmDialog
        open={logoutOpen}
        title={t('Системээс гарах')}
        message={t('Та системээс гарахдаа итгэлтэй байна уу?')}
        confirmLabel={t('Гарах')}
        danger
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />

      {/* ── Mobile доод tab bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-rule flex">
        {items.map((item) => (
          <NavLink key={item.key} to={item.path} end={item.end} className={tabLink}>
            <item.icon size={20} />
            <span>{t(item.label)}</span>
          </NavLink>
        ))}
        {/* Жолоочид мэдэгдлийн tab — badge-тэй */}
        {user?.role === 'DRIVER' && (
          <NavLink to="/notifications" className={tabLink}>
            <span className="relative">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-alarm text-bg font-mono text-[9px] leading-[15px] text-center">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            <span>{t('Мэдэгдэл')}</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
