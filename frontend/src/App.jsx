import { Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { manifestsInMountOrder, publicRoutesForApps } from './apps'
import AppLoading from './components/ui/AppLoading'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AppRoutes from './components/layout/AppRoutes'
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
import ResetPassword from './pages/ResetPassword'
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
                {/* И-мэйлээр ирсэн нууц үг сэргээх холбоос — нэвтрэлтгүй */}
                <Route path="/reset-password" element={<ResetPassword />} />
                {/* Нийтийн захиалгын линк — нэвтрэлтгүй (V5) */}
                <Route path="/z/:token" element={<PublicOrder />} />
                {/* Түр нууц үг солих — ProtectedRoute-ийн ГАДНА (V4-06) */}
                <Route path="/change-password" element={<ChangePassword />} />
                {/*
                 * App-уудын НЭВТРЭЛТГҮЙ хуудсууд (манифестийн publicRoutes,
                 * жишээ: Studexa сурагчийн бүртгэл /studexa/register) —
                 * lazy chunk, статик зам тул "/<key>/*" mount-аас түрүүлж таарна.
                 */}
                {publicRoutesForApps().map((r) => (
                  <Route
                    key={r.key}
                    path={r.path}
                    element={
                      <Suspense fallback={<AppLoading />}>
                        <r.Component />
                      </Suspense>
                    }
                  />
                ))}

                <Route element={<ProtectedRoute />}>
                  {/* ocirrf ХАБ — нэвтэрсний дараах нүүр: 10 системийн card */}
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
                     *
                     * LAZY: app бүр manifest.mountPath дээр Suspense-тэй
                     * угсрагдаж, route/хуудасны код нь тусдаа chunk-аар
                     * (app-<key>-*.js) зөвхөн тэр app руу ороход татагдана.
                     */}
                    {manifestsInMountOrder().map((m) => (
                      <Route
                        key={m.key}
                        path={m.mountPath}
                        element={<AppRoutes manifest={m} />}
                      />
                    ))}
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