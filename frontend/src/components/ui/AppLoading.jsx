import { useLang } from '../../context/LanguageContext'
import Spinner from './Spinner'

/**
 * App-ийн lazy chunk татагдаж байх үеийн Suspense fallback.
 * Login-ий шилэн карттай ижил хэл (bg-surface/40 + backdrop-blur) —
 * платформын бүрхүүл дотор өөр app руу шилжихэд гэнэт хоосон дэлгэц
 * биш, зөөлөн «ачаалж байна» төлөв харагдана. Chunk ихэвчлэн 100-300мс-д
 * ирдэг тул анивчихаас сэргийлж животгүй, энгийн.
 */
export default function AppLoading() {
  const { t } = useLang()
  return (
    <div
      className="min-h-[50vh] flex items-center justify-center"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 bg-surface/40 backdrop-blur-lg border border-rule/50 rounded-lg px-5 py-4 shadow-2xl shadow-black/40">
        <Spinner size={18} />
        <span className="font-mono text-sm text-ink-muted">
          {t('ачаалж байна…')}
        </span>
      </div>
    </div>
  )
}
