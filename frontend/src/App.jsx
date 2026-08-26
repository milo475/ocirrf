import { BrowserRouter, Route, Routes } from 'react-router'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RoleRoute from './components/auth/RoleRoute'
import AppShell from './components/layout/AppShell'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import ActivityLog from './pages/ActivityLog'
import Analytics from './pages/Analytics'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import DeliveryOps from './pages/DeliveryOps'
import Finance from './pages/Finance'
import Login from './pages/Login'
import Notifications from './pages/Notifications'
import Payroll from './pages/Payroll'
import PortalHome from './pages/portal/PortalHome'
import PortalNew from './pages/portal/PortalNew'
import PortalOrderDetail from './pages/portal/PortalOrderDetail'
import PortalOrders from './pages/portal/PortalOrders'
import PortalProfile from './pages/portal/PortalProfile'
import Register from './pages/Register'
import MyDeliveries from './pages/MyDeliveries'
import OrderDetail from './pages/OrderDetail'
import OrderNew from './pages/OrderNew'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Settings from './pages/Settings'
import Stock from './pages/Stock'
import UserPermissions from './pages/UserPermissions'
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
                <Route path="/register" element={<Register />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    {/* Бүх эрхэд нээлттэй (dashboard эрхээрээ өөр агуулгатай) */}
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/notifications" element={<Notifications />} />

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
                    {/* Санхүү — permission-ээр нарийн, RoleRoute давхар хамгаалалт */}
                    <Route element={<RoleRoute roles={['ADMIN', 'MANAGER']} />}>
                      <Route path="/finance" element={<Finance />} />
                      <Route path="/finance/payroll" element={<Payroll />} />
                      <Route path="/delivery-ops" element={<DeliveryOps />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/customers" element={<Customers />} />
                    </Route>

                    <Route element={<RoleRoute roles={['ADMIN', 'OPERATOR']} />}>
                      <Route path="/orders/new" element={<OrderNew />} />
                    </Route>

                    {/* Хэрэглэгчид — зөвхөн ADMIN */}
                    <Route element={<RoleRoute roles={['ADMIN']} />}>
                      <Route path="/users" element={<Users />} />
                      <Route
                        path="/users/:id/permissions"
                        element={<UserPermissions />}
                      />
                      <Route path="/activity-log" element={<ActivityLog />} />
                    </Route>

                    {/* Хүргэлт — зөвхөн DRIVER */}
                    {/* CUSTOMER portal */}
                    <Route element={<RoleRoute roles={['CUSTOMER']} />}>
                      <Route path="/portal" element={<PortalHome />} />
                      <Route path="/portal/new" element={<PortalNew />} />
                      <Route path="/portal/orders" element={<PortalOrders />} />
                      <Route
                        path="/portal/orders/:id"
                        element={<PortalOrderDetail />}
                      />
                      <Route
                        path="/portal/profile"
                        element={<PortalProfile />}
                      />
                    </Route>

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
