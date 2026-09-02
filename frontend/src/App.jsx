import { BrowserRouter, Route, Routes } from 'react-router'
import { APP_MANIFESTS } from './apps'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import AppDetail from './pages/AppDetail'
import ChangePassword from './pages/ChangePassword'
import Landing from './pages/Landing'
import Launcher from './pages/Launcher'
import Login from './pages/Login'
import PlatformAdmin from './pages/PlatformAdmin'
import PublicOrder from './pages/PublicOrder'
import Signup from './pages/Signup'

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/*
                 * Платформын нийтийн нүүр (Odoo маягийн каталог) — нэвтрээгүй
                 * хүнд. Нэвтэрсэн хэрэглэгчийг Landing өөрөө ажлын орчин руу
                 * шилжүүлнэ. Dashboard /dashboard руу нүүсэн (доор).
                 */}
                <Route path="/" element={<Landing />} />
                <Route path="/apps/:key" element={<AppDetail />} />
                {/* Login — nav-гүй, хамгаалалтгүй */}
                <Route path="/login" element={<Login />} />
                {/* Байгууллагын нээлттэй бүртгэл (Multi-tenancy) */}
                <Route path="/signup" element={<Signup />} />
                {/* Нийтийн захиалгын линк — нэвтрэлтгүй (V5) */}
                <Route path="/z/:token" element={<PublicOrder />} />
                {/* Түр нууц үг солих — ProtectedRoute-ийн ГАДНА (V4-06) */}
                <Route path="/change-password" element={<ChangePassword />} />

                <Route element={<ProtectedRoute />}>
                  {/* App Launcher — нэвтэрсний дараах анхны хуудас */}
                  <Route path="/launcher" element={<Launcher />} />
                  {/* SUPERADMIN консол — бусдад 404 харагдана */}
                  <Route path="/platform-admin" element={<PlatformAdmin />} />
                  <Route element={<AppShell />}>
                    {/*
                     * МОДУЛИЙН СТАНДАРТ: app бүрийн route src/apps/<key>/
                     * манифестээс угсарна. Урсгал app-ийн бүх хуудас
                     * (dashboard, захиалга, агуулах…) тэндээс ирдэг.
                     * Шинэ app нэмэхдээ App.jsx-д ГАР ХҮРЭХГҮЙ —
                     * src/apps/index.js-д манифестээ л бүртгэнэ.
                     */}
                    {APP_MANIFESTS.map((m) => m.routes)}
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App