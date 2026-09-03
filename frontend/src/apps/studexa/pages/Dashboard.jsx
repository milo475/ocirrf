import { Link } from 'react-router'
import { useAuth } from '../../../context/AuthContext'
import LineChart from '../components/LineChart'
import { Card, Loading, LoadError, PageHead, Stat } from '../components/ui'
import { useApi } from '../lib/useApi'

/** Багшийн хяналт самбар — Studexa dashboard */
export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi('/studexa/dashboard')
  const { data: me } = useApi('/studexa/me')
  if (loading) return <Loading />
  if (error) return <LoadError error={error} onRetry={reload} />
  const uni = me?.teacher?.schoolType === 'UNIVERSITY'

  return (
    <div className="space-y-6">
      <PageHead
        title="Хяналт самбар"
        sub={`${user?.name ?? ''}${me?.teacher ? ` · Багшийн код: ${me.teacher.code}` : ''}`}
      />
      <div className={`grid gap-4 sm:grid-cols-2 ${uni ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        <Stat label="Нийт сурагчид" value={data.totalStudents} to="/studexa/students" />
        <Stat label="Өнөөдрийн хичээл" value={data.todayLessons.length} tone="text-accent" to="/studexa/schedule" />
        <Stat label="Даалгавар хүлээгдэж" value={data.pendingHomework} tone="text-status-preparing" to="/studexa/homework?status=open" />
        {!uni && <Stat label="Төлбөр хоцорсон" value={data.overduePayments} tone="text-alarm" to="/studexa/students?payment=OVERDUE" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="📈 Ирцийн трэнд (сүүлийн 14 хоног)">
          <LineChart chart={data.attChart} lastLabel="Сүүлд:" empty="Сүүлийн 14 хоногт ирц бүртгэгдсэн үед график гарна." />
        </Card>
        <Card title="📊 Бүлгүүдийн дундаж дүн (хувиар)">
          {data.groupBars.length === 0 ? (
            <p className="text-sm text-ink-muted">Бүлэгтэй сурагчдад дүн бүртгэгдсэн үед график гарна.</p>
          ) : (
            <div className="space-y-2">
              {data.groupBars.map((b) => (
                <div key={b.label} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate">📁 {b.label}</span>
                  <div className="flex-1 h-2 rounded bg-bg overflow-hidden">
                    <span className="block h-full bg-accent" style={{ width: `${b.value}%` }} />
                  </div>
                  <span className="font-mono tabular-nums w-10 text-right">{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Өнөөдрийн хуваарь">
          {data.todayLessons.length === 0 ? (
            <p className="text-sm text-ink-muted">Өнөөдөр хичээл алга.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {data.todayLessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="font-mono tabular-nums text-ink-muted">
                    {l.startTime} - {l.endTime}
                  </span>
                  <span className="flex-1 truncate">
                    {l.title}
                    {l.group ? ` · ${l.group}` : ''}
                  </span>
                  <span className="text-ink-muted">{l.students} сурагч</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card
          title="Сүүлийн тэмдэглэлүүд"
          action={
            <Link className="text-sm underline underline-offset-2 text-ink-muted hover:text-ink" to="/studexa/notes">
              Бүгд →
            </Link>
          }
        >
          {data.notes.length === 0 ? (
            <p className="text-sm text-ink-muted">Тэмдэглэл алга.</p>
          ) : (
            <ul className="space-y-3">
              {data.notes.map((n) => (
                <li key={n.id}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-sm text-ink-muted whitespace-pre-wrap">{n.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
