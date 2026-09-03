import { useRef } from 'react'

/**
 * Зөвхөн ХАМГИЙН СҮҮЛД илгээсэн хүсэлтийн хариуг хүлээж авна.
 *
 * ЯАГААД: жагсаалтын хуудсууд `load` дотор `api(...).then(setData)` гэж
 * бичдэг байсан тул хариу нь ХОЖИМ ирсэн нь ялдаг байв. Хэрэглэгч
 * «Цуцлагдсан» табыг дараад тэр дор нь «Шинэ» рүү шилжихэд, эхний
 * (удаан) хүсэлт хоёрдугаарт нь ирвэл хүснэгтэд ЦУЦЛАГДСАН захиалгууд
 * харагдаж, таб нь «Шинэ» гэж тодорсон хэвээр үлддэг байсан. Дараагийн
 * шүүлт солигдох хүртэл өөрөө засагддаггүй.
 *
 * ХЭРЭГЛЭЭ:
 *   const seq = useLatestRequest()
 *   const load = useCallback(() => {
 *     const ok = seq()
 *     api(url).then((d) => ok() && setData(d)).catch((e) => ok() && setError(e))
 *   }, [deps])
 */
export function useLatestRequest() {
  const counter = useRef(0)
  return () => {
    const mine = ++counter.current
    return () => mine === counter.current
  }
}
