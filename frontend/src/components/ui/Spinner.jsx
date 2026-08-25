/** Эргэдэг ачааллын дугуй. size: px */
export default function Spinner({ size = 16, className = '' }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-block border-2 border-ink-muted border-t-transparent rounded-full animate-spin motion-reduce:animate-none ${className}`}
      role="status"
      aria-label="Ачаалж байна"
    />
  )
}
