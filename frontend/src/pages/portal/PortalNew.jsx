import { useNavigate } from 'react-router'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import { useLang } from '../../context/LanguageContext'

/**
 * Захиалга үүсгэх wizard дараагийн шатанд (V3-15) бүтнээрээ ирнэ —
 * харилцагчид бараа харах тусгай API шаардлагатай.
 */
export default function PortalNew() {
  const { t } = useLang()
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-4xl font-medium">{t('Шинэ захиалга')}</h1>
      <div className="mt-8">
        <EmptyState
          title={t('Тун удахгүй')}
          note={t('Онлайн захиалгын хэсэг дараагийн шатанд нээгдэнэ')}
          action={
            <Button variant="ghost" onClick={() => navigate('/portal')}>
              {t('← Миний самбар')}
            </Button>
          }
        />
      </div>
    </div>
  )
}
