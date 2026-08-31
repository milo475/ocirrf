/**
 * Нэвтрэх хуудсуудын нийтлэг хүрээ — дэвсгэр зурагтай (V5).
 *
 * Login ба ChangePassword хоёр ижил бүтэцтэй байсан тул нэг газарт
 * нэгтгэв: дэвсгэрийг өөрчлөхөд хоёуланд нь нэг дор тусна.
 *
 * ═══ ЯАГААД ХОЁР ӨӨР БАЙРЛАЛ ВЭ ═══
 * Бүтээгдэхүүний зураг нь ДӨРВӨЛЖИН. Түүнийг өргөн дэлгэц дээр
 * бүтнээр нь дүүргэвэл дээд, доод тал нь тайрагдаж, зөвхөн дунд
 * хэсэг нь харагдана.
 *
 *   Гар утас (босоо)  → зураг бүтэн дэлгэцээр, маягт нь дээр нь
 *   Компьютер (өргөн) → зүүн талд зураг, баруун талд маягт
 *
 * Компьютер дээр зургийн талбар нь БОСОО хэлбэртэй болох тул
 * дөрвөлжин зураг бараг бүтнээрээ багтана — тайралт бага.
 *
 * ЗУРАГ БАЙХГҮЙ ҮЕД: `background-image` нь олдоогүй файлыг чимээгүй
 * алгасдаг тул доорх өнгө шууд харагдана — хуудас эвдрэхгүй.
 */
const BG = "url('/login-bg.png')"

export default function AuthShell({ children }) {
  return (
    <main className="min-h-screen bg-bg text-ink md:flex">
      {/* ── КОМПЬЮТЕР: зүүн талын зургийн талбар ── */}
      <div
        aria-hidden="true"
        className="hidden md:block md:w-1/2 lg:w-3/5 bg-center bg-cover border-r border-rule"
        style={{ backgroundImage: BG }}
      />

      {/* ── Маягтын тал ── */}
      <div className="relative flex-1 min-h-screen flex items-center justify-center px-6">
        {/* Гар утсан дээр зураг бүтэн дэлгэцийн ард; компьютер дээр
            зүүн талд аль хэдийн байгаа тул энд харуулахгүй */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-center bg-cover md:hidden"
          style={{ backgroundImage: BG }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px] md:hidden"
        />

        <div className="relative w-full max-w-sm">{children}</div>
      </div>
    </main>
  )
}
