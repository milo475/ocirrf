import { Navigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { isStudexaStudent } from '../lib/studentUser'
import AdminDashboard from './dashboards/AdminDashboard'
import DriverDashboard from './dashboards/DriverDashboard'
import ManagerDashboard from './dashboards/ManagerDashboard'
import OperatorDashboard from './dashboards/OperatorDashboard'
import SellerDashboard from './dashboards/SellerDashboard'
import StockHealthDashboard from './dashboards/StockHealthDashboard'

/** / хуудас — эрх бүр өөрийн самбартай */
export default function Dashboard() {
  const { user, hasPerm } = useAuth()

  // Studexa-гийн сурагч OPERATOR role-тэй ч харилцагчийн самбар нь түүнд хамаагүй
  if (isStudexaStudent(user)) return <Navigate to="/studexa/portal" replace />

  switch (user?.role) {
    case 'ADMIN':
      return <AdminDashboard />
    case 'MANAGER':
      return <ManagerDashboard />
    case 'OPERATOR':
      return <OperatorDashboard />
    case 'DRIVER':
      return <DriverDashboard />
    case 'SELLER':
      return <SellerDashboard />
    case 'WAREHOUSE':
      // Эрхийг нь хассан үед ч '/' руу буцааж давталт үүсгэхгүй
      return hasPerm('warehouse.handover') ? (
        <Navigate to="/warehouse" replace />
      ) : (
        <StockHealthDashboard />
      )
    default:
      // Аюулгүйн fallback — танигдаагүй эрхэд хуучин нөөцийн самбар
      return <StockHealthDashboard />
  }
}
