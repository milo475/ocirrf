import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { api } from '../lib/api'

/**
 * Хугацааны анхааруулга — няравын өдөр тутмын нүдэнд өртөх зурвас.
 *
 * Зөвхөн АНХААРАХ ЗҮЙЛ БАЙВАЛ гарна: хугацаа дууссан эсвэл ойрхон
 * дуусах бараа. Юу ч байхгүй бол огт харагдахгүй — «бүх зүйл хэвийн»
 * гэсэн хоосон хайрцаг зай эзлэхгүй.
 */
export default function ExpiryAlert() {
  const { t } = useLang()
  const { hasPerm } = useAuth()
  const [s, setS] = useState(null)

  useEffect(() => {
    if (!hasPerm('inventory.view')) return
    api('/batches/summary')
      .then(setS)
      .catch(() => setS(null))
  }, [hasPerm])

  if (!s) return null
  const expired = s.EXPIRED.qty
  const critical = s.CRITICAL.qty
  if (expired === 0 && critical === 0) return null

  const danger = expired > 0
  return (
    <Link
      to="/expiry"
      className={`mt-6 flex items-start justify-between gap-4 flex-wrap border rounded-lg px-4 py-3 transition-colors ${
        danger
          ? 'border-alarm/50 bg-alarm/8 hover:bg-alarm/12'
          : 'border-status-cancelled/50 bg-status-cancelled/8 hover:bg-status-cancelled/12'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {danger
            ? `⚠ ${t('Хугацаа дууссан бараа агуулахад байна')}`
            : `${t('Хугацаа дуусах дөхсөн бараа байна')}`}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {expired > 0 && (
            <span className="text-alarm">
              {t('Дууссан')}: {expired} {t('ш')}
            </span>
          )}
          {expired > 0 && critical > 0 && ' · '}
          {critical > 0 && (
            <span>
              {s.warnDays} {t('хоногт дуусах')}: {critical} {t('ш')}
            </span>
          )}
        </p>
      </div>
      <span className="text-sm text-ink-muted shrink-0 self-center">
        {t('Харах')} →
      </span>
    </Link>
  )
}
