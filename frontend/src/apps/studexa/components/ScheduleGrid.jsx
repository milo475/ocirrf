import { Link } from 'react-router'
import { LESSON_COLOR_STYLE } from '../lib/labels'

/**
 * 7 хоног × 07:00–23:00 тор. editable=true бол хичээл дээр дарж засна.
 * Хичээлүүд нь серверийн top/height хувиар байрлана.
 */
export default function ScheduleGrid({ grid, editable = false, showGroup = true }) {
  const height = 640
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div />
          {grid.days.map((d) => (
            <div key={d.weekday} className="text-center text-xs uppercase tracking-wide text-ink-muted py-2 border-b border-rule">
              {d.label}
            </div>
          ))}
          <div className="relative" style={{ height }}>
            {grid.hours.map((h) => (
              <span
                key={h.label}
                className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-ink-muted"
                style={{ top: `${h.top}%` }}
              >
                {h.label}
              </span>
            ))}
          </div>
          {grid.days.map((d) => (
            <div key={d.weekday} className="relative border-l border-rule" style={{ height }}>
              {grid.hours.map((h) => (
                <span
                  key={h.label}
                  className="absolute inset-x-0 border-t border-rule/60"
                  style={{ top: `${h.top}%` }}
                />
              ))}
              {d.lessons.map((item) => {
                const style = {
                  top: `${item.top}%`,
                  height: `${item.height}%`,
                  ...(LESSON_COLOR_STYLE[item.lesson.color] ?? LESSON_COLOR_STYLE.indigo),
                }
                const body = (
                  <>
                    <b className="block truncate">
                      {item.lesson.title}
                      {showGroup && item.lesson.group ? ` · ${item.lesson.group}` : ''}
                    </b>
                    <span className="font-mono">
                      {item.lesson.startTime}–{item.lesson.endTime}
                    </span>
                  </>
                )
                const cls = 'absolute inset-x-1 rounded border px-1.5 py-1 text-[11px] leading-tight overflow-hidden'
                return editable ? (
                  <Link
                    key={item.lesson.id}
                    to={`/studexa/schedule/${item.lesson.id}/edit`}
                    style={style}
                    className={`${cls} hover:brightness-95`}
                    title={`Засах: ${item.lesson.title}`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={item.lesson.id} style={style} className={cls}>
                    {body}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
