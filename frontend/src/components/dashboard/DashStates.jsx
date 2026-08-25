import { useLang } from '../../context/LanguageContext'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'

/** Dashboard ачаалж байх үеийн skeleton */
export function DashSkeleton() {
  return (
    <div className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="h-10 w-72 bg-surface rounded" />
      <div className="mt-16 border-t border-rule pt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 w-24 bg-surface rounded" />
            <div className="mt-3 h-8 w-20 bg-surface rounded" />
          </div>
        ))}
      </div>
      <div className="mt-16 border-t border-rule pt-8 h-32 bg-surface rounded max-w-xl" />
    </div>
  )
}

/** Алдааны төлөв — retry товчтой */
export function DashError({ error, onRetry }) {
  const { t } = useLang()
  return (
    <EmptyState
      title={t('Өгөгдөл ачаалж чадсангүй')}
      note={error?.message}
      action={<Button onClick={onRetry}>{t('Дахин оролдох')}</Button>}
    />
  )
}
