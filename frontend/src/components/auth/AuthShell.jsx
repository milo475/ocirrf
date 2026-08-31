/**
 * Нэвтрэх хуудсуудын нийтлэг хүрээ — дэвсгэр зурагтай (V5).
 *
 * Login ба ChangePassword хоёр ижил бүтэцтэй байсан тул нэг газарт
 * нэгтгэв: дэвсгэрийг өөрчлөхөд хоёуланд нь нэг дор тусна.
 *
 * ═══ ГУРВАН ДАВХАРГА, ЯАГААД ВЭ ═══
 * Бүтээгдэхүүний зураг нь ДӨРВӨЛЖИН. Дэлгэцийг дүүргэвэл (`cover`)
 * дээд, доод тал нь тайрагдана. Бүтнээр нь харуулбал (`contain`)
 * хажуу талд хоосон зай үлдэнэ.
 *
 * Тиймээс хоёуланг нь давхарлав:
 *   1. Бүдгэрүүлсэн ХУУЛБАР — дэлгэцийг дүүргэж, хажуугийн хоосон
 *      зайг нөхнө. Тайрагдсан ч хамаагүй, аль хэдийн бүдэг.
 *   2. Бүтэн зураг — тайралтгүй, голдоо. Гол харагдац нь энэ.
 *   3. Маягт — голдоо, шилэн мэт (доод давхарга нь харагдана).
 */
const BG = "url('/login-bg.png')"

export default function AuthShell({ children }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 py-10 bg-bg text-ink overflow-hidden">
      {/* 1 — хажуугийн зайг нөхөх бүдэг хуулбар.
             Зөвхөн компьютер дээр: гар утсан дээр зураг дэлгэцийг
             аль хэдийн дүүргэдэг тул нөхөх зай үлдэхгүй. */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute inset-0 bg-center bg-cover scale-110 blur-2xl opacity-60"
        style={{ backgroundImage: BG }}
      />

      {/* 2 — гол зураг.
             Гар утас (босоо): дүүргэнэ — хажуу тал нь бага зэрэг
               тайрагдана, уут голдоо тул бүтнээрээ харагдана.
             Компьютер (өргөн): бүтнээр — тайралтгүй. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover md:bg-contain bg-no-repeat"
        style={{ backgroundImage: BG }}
      />

      {/* 3 — маягтын ард уншигдахуйц болгох зөөлөн харанхуйлалт */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/35 md:bg-black/25" />

      <div className="relative w-full max-w-sm">{children}</div>
    </main>
  )
}
