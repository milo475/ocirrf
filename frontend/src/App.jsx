import { BrowserRouter, Route, Routes } from 'react-router'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import OrderDetail from './pages/OrderDetail'
import OrderNew from './pages/OrderNew'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Stock from './pages/Stock'
import Users from './pages/Users'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login — nav-гүй, AppShell-ээс гадуур */}
        <Route path="/login" element={<Login />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/new" element={<OrderNew />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/users" element={<Users />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
