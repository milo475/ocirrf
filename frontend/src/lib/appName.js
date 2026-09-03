/**
 * App Registry-ийн нэрийг интерфэйсийн хэлээр буцаана.
 *
 * Application хүснэгтэд `nameMn` ба `nameEn` ХОЁУЛАА байдаг (жишээ:
 * «Санхүү / НЯБО» / «Finance») тул англи режимд серверийн англи нэрийг
 * хэрэглэнэ. `nameEn` хоосон бол монгол нэр рүү унана.
 *
 * ⚠ `descriptionMn`-д англи хувилбар БАЙХГҮЙ — каталогийн схемд
 * `descriptionEn` багана байхгүй тул тайлбарууд англи режимд ч
 * монголоороо үлдэнэ. Үүнийг зөвхөн migration-аар шийднэ.
 */
export function appName(app, lang) {
  if (!app) return ''
  return lang === 'en' ? (app.nameEn || app.nameMn) : app.nameMn
}

/** Гарчгийн доорх хоёрдогч нэр — үргэлж НӨГӨӨ хэл дээрх нэр */
export function appNameAlt(app, lang) {
  if (!app) return ''
  return lang === 'en' ? app.nameMn : app.nameEn
}
