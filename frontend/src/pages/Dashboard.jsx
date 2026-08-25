import { useAuth } from '../context/AuthContext'
import AdminDashboard from './dashboards/AdminDashboard'
import DriverDashboard from './dashboards/DriverDashboard'
import ManagerDashboard from './dashboards/ManagerDashboard'
import OperatorDashboard from './dashboards/OperatorDashboard'
import StockHealthDashboard from './dashboards/StockHealthDashboard'

/** / хуудас — эрх бүр өөрийн самбартай */
export default function Dashboard() {
  const { user } = useAuth()

  switch (user?.role) {
    case 'ADMIN':
      return <AdminDashboard />
    case 'MANAGER':
      return <ManagerDashboard />
    case 'OPERATOR':
      return <OperatorDashboard />
    case 'DRIVER':
      return <DriverDashboard />
    default:
      // Аюулгүйн fallback — танигдаагүй эрхэд хуучин нөөцийн самбар
      return <StockHealthDashboard />
  }
}
