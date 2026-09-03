import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../../lib/api'

/**
 * Studexa-гийн хуудсуудын нийтлэг ачаалалт: {data, error, loading, reload}.
 * 412 (багшийн профайл үүсгээгүй) ирвэл тохиргооны дэлгэц рүү шилжүүлнэ.
 */
export function useApi(path, deps = []) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  const reload = useCallback(() => {
    const id = ++seq.current
    setLoading(true)
    setError(null)
    api(path)
      .then((d) => {
        if (id === seq.current) setData(d)
      })
      .catch((e) => {
        if (id !== seq.current) return
        if (e.status === 412) {
          navigate('/studexa/setup', { replace: true })
          return
        }
        setError(e)
      })
      .finally(() => {
        if (id === seq.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, navigate, ...deps])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, loading, reload, setData }
}

/** Файл татах (CSV/SVG) — auth header-тэй */
export async function downloadFile(path, fallbackName) {
  const { apiBlob } = await import('../../../lib/api')
  const { blob, filename } = await apiBlob(path)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
