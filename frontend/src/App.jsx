import { BrowserRouter, Route, Routes } from 'react-router'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RoleRoute from './components/auth/RoleRoute'
import AppShell from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import MyDeliveries from './pages/MyDeliveries'
import OrderDetail from './pages/OrderDetail'
import OrderNew from './pages/OrderNew'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Settings from './pages/Settings'
import Stock from './pages/Stock'
import Users from './pages/Users'

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Login — nav-гүй, хамгаалалтгүй */}
                <Route path="/login" element={<Login />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    {/* Бүх эрхэд нээлттэй (dashboard эрхээрээ өөр агуулгатай) */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />

                    {/* Эрхийн матриц: харах эрхтэй гурав */}
                    <Route
                      element={
                        <RoleRoute roles={['ADMIN', 'MANAGER', 'OPERATOR']} />
                      }
                    >
                      <Route path="/products" element={<Products />} />
                      <Route path="/orders" element={<Orders />} />
                      <Route path="/orders/:id" element={<OrderDetail />} />
                      <Route path="/stock" element={<Stock />} />
                    </Route>

                    {/* Захиалга шивэх — зөвхөн ADMIN, OPERATOR */}
                    <Route element={<RoleRoute roles={['ADMIN', 'OPERATOR']} />}>
                      <Route path="/orders/new" element={<OrderNew />} />
                    </Route>

                    {/* Хэрэглэгчид — зөвхөн ADMIN */}
                    <Route element={<RoleRoute roles={['ADMIN']} />}>
                      <Route path="/users" element={<Users />} />
                    </Route>

                    {/* Хүргэлт — зөвхөн DRIVER */}
                    <Route element={<RoleRoute roles={['DRIVER']} />}>
                      <Route path="/deliveries" element={<MyDeliveries />} />
                    </Route>
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
