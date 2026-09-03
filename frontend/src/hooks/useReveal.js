import { useLayoutEffect } from 'react'

/**
 * Скроллд орж ирэхэд нарийн fade-in — library-гүй, зөвхөн
 * IntersectionObserver + CSS (index.css-ийн `[data-reveal]` дүрмүүд).
 *
 * ХЭРЭГЛЭЭ: нуух гэсэн элемент бүрт `data-reveal="out"` тавина. Илчлэгдсэнийг
 * хук нь `data-revealed` атрибутаар тэмдэглэнэ — React тэр атрибутыг
 * удирддаггүй тул дараагийн re-render хэсгийг буцааж нуухгүй.
 *   <section data-reveal="out"> … </section>
 * Хуудсандаа нэг л удаа `useReveal([deps])` дуудна.
 *
 * ЯАГААД `reveal-ready` класс: CSS нь агуулгыг ЗӨВХӨН <html> дээр тэр класс
 * байх үед нууна. Тиймээс IntersectionObserver дэмжигдээгүй, эсвэл хук ямар
 * нэг шалтгаанаар ажиллаагүй бол хэсгүүд харагдсан хэвээр үлдэж, «мөнхөд
 * opacity:0» гэсэн доголдол үүсэхгүй. Класс нь `useLayoutEffect`-д,
 * зурагдахаас ӨМНӨ тавигдана — ингэж «харагдаад дараа нь нуугдах»
 * анивчилт гарахгүй.
 *
 * Хөдөлгөөн нь opacity/transform л ашигладаг тул layout shift үүсгэхгүй;
 * `prefers-reduced-motion: reduce` үед CSS өөрөө хөдөлгөөнийг унтраана.
 *
 * @param {ReadonlyArray<unknown>} deps — async ачаалагдсан агуулга нэмэгдэхэд
 *   дахин скан хийхийн тулд (жишээ: [apps]).
 */
export function useReveal(deps = []) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const SEL = '[data-reveal="out"]:not([data-revealed])'
    const pending = document.querySelectorAll(SEL)
    if (pending.length === 0) return

    // IO байхгүй орчин: юуг ч нуухгүй, шууд харуулна
    if (typeof IntersectionObserver === 'undefined') {
      for (const el of pending) el.setAttribute('data-revealed', '')
      return
    }

    root.classList.add('reveal-ready')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-revealed', '')
          io.unobserve(entry.target)
        }
      },
      // Доод захаас 8% дээш орж ирэхэд л — хэсэг бүр «уншихаар» болсон хойно
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    for (const el of pending) io.observe(el)

    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
