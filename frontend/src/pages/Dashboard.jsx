import { useAuth } from '../context/AuthContext'
import AdminDashboard from './dashboards/AdminDashboard'
import StockHealthDashboard from './dashboards/StockHealthDashboard'

/**
 * / хуудас — эрхээрээ өөр самбар харна.
 * OPERATOR/MANAGER/DRIVER түр нөөцийн самбараа харна (P19–21-д тус
 * бүрийн самбараар солигдоно).
 */
export default function Dashboard() {
  const { user } = useAuth()

  switch (user?.role) {
    case 'ADMIN':
      return <AdminDashboard />
    default:
      return <StockHealthDashboard />
  }
}
