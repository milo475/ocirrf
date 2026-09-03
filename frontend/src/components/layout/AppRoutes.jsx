import { Suspense } from 'react'
import { lazyRoutesFor } from '../../apps'
import AppLoading from '../ui/AppLoading'

/**
 * Нэг app-ийн route модыг LAZY ачаалж AppShell-ийн <Outlet/> дотор
 * үзүүлнэ. Манифестийн `loadRoutes` → тусдаа chunk; татагдах хооронд
 * AppLoading харагдана. App бүр өөрийн Suspense хилтэй тул нэг app-ийн
 * chunk удаан ирэх нь платформын бүрхүүлийг (topbar, switcher) хөлдөөхгүй.
 */
export default function AppRoutes({ manifest }) {
  const Routes = lazyRoutesFor(manifest)
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes />
    </Suspense>
  )
}
