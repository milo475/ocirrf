import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Эрхийн dashboard-ийн өгөгдөл татагч.
 * endpoint: 'admin' | 'operator' | 'manager' | 'driver'
 * Хэлбэр нь backend-ийн src/dashboard/dashboard.types.ts-тэй ижил.
 */
export function useDashboard(endpoint) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    setError(null)
    setData(null)
    api(`/dashboard/${endpoint}`)
      .then(setData)
      .catch((e) => setError(e))
  }, [endpoint])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, reload }
}
