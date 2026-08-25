/** Түр placeholder — хуудас бүр дараагийн алхмуудад жинхэнэ болно */
export default function PagePlaceholder({ title, note }) {
  return (
    <section>
      <h1 className="font-serif text-4xl font-medium">{title}</h1>
      {note && <p className="mt-3 text-ink-muted">{note}</p>}
      <p className="mt-6 font-mono text-sm text-ink-muted">— тун удахгүй —</p>
    </section>
  )
}
