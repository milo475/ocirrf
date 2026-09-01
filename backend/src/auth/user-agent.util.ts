/**
 * User-Agent-ыг хүн уншихуйц болгох (V5).
 *
 * Бүрэн задлагч сан (ua-parser) татахгүй: бидэнд «энэ би мөн үү,
 * өөр хүн үү» гэдгийг таних төдий хангалттай. Дэлгэрэнгүй хэрэгтэй
 * бол түүхий утга нь DB-д бүтнээрээ хадгалагдсан хэвээр.
 *
 * Дараалал ЧУХАЛ: Edge нь "Chrome"-ыг, Chrome нь "Safari"-г өөрийн
 * мөрөндөө агуулдаг тул тодорхойгоос нь эхэлж шалгана.
 */
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const PLATFORMS: Array<[RegExp, string]> = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** «Chrome · Android» гэх мэт богино тайлбар */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Тодорхойгүй';
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const platform = PLATFORMS.find(([re]) => re.test(ua))?.[1];
  if (!browser && !platform) return 'Тодорхойгүй';
  return [browser, platform].filter(Boolean).join(' · ');
}
