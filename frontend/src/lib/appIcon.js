import { icons } from 'lucide-react'

/**
 * App Registry-ийн icon нэр (kebab-case string, жишээ "bar-chart-3")
 * → lucide-react-ийн component. Танигдахгүй нэрэнд Package fallback —
 * каталогт буруу icon орсон ч card эвдрэхгүй.
 */
export function appIcon(name) {
  const pascal = String(name ?? '')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
    .join('')
  return icons[pascal] ?? icons.Package
}
