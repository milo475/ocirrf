import { Link, useSearchParams } from 'react-router'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import ScheduleGrid from '../components/ScheduleGrid'
import { Card, Loading, LoadError, PageHead, Tabs } from '../components/ui'
import { downloadFile, useApi } from '../lib/useApi'

/** 7 хоногийн хуваарь — бүлгээр шүүнэ, хичээл дээр дарж засна */
export default function Schedule() {
  const { show } = useToast()
  const [params, setParams] = useSearchParams()
  const group = params.get('group') ?? ''
  const qs = group ? `?group=${encodeURIComponent(group)}` : ''
  const { data, error, loading, reload } = useApi(`/studexa/schedule${qs}`)
  if (loading && !data) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />

  return (
    <div className="space-y-5">
      <PageHead
        title="Хичээлийн хуваарь"
        sub={group ? `«${group}» бүлгийн болон нийтийн хичээлүүд харагдаж байна` : '💡 Хичээл дээр дарж засах боломжтой'}
        actions={
          <>
            <Button variant="ghost" onClick={() => downloadFile(`/studexa/export/schedule.svg${qs}`, 'huvaari.svg').catch((e) => show(e.message, { type: 'error' }))}>⬇ SVG</Button>
            <Link className="bg-ink text-bg rounded px-4 py-2 text-sm font-medium" to={`/studexa/schedule/new${qs}`}>+ Хичээл нэмэх{group ? ` (${group})` : ''}</Link>
          </>
        }
      />
      {data.groups.length > 0 && (
        <Tabs items={[['', '👥 Бүх бүлэг'], ...data.groups.map((g) => [g, `📁 ${g}`])]} value={group} onChange={(v) => setParams(v ? { group: v } : {})} />
      )}
      <Card>
        <ScheduleGrid grid={data} editable />
      </Card>
    </div>
  )
}
