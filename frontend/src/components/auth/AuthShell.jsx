/**
 * Нэвтрэх хуудсуудын нийтлэг хүрээ — дэвсгэр зурагтай (V5).
 *
 * Login ба ChangePassword хоёр ижил бүтэцтэй байсан тул нэг газарт
 * нэгтгэв: дэвсгэрийг өөрчлөхөд хоёуланд нь нэг дор тусна.
 *
 * Дэвсгэр зураг нь ӨРГӨН хэлбэртэй тул дэлгэцийг шууд дүүргэнэ —
 * хажуугийн хоосон зайг нөхөх нэмэлт давхарга шаардлагагүй.
 * (Өмнөх дөрвөлжин зурагт тийм давхарга хэрэгтэй байсан.)
 *
 * ЗУРАГ БАЙХГҮЙ ҮЕД: `background-image` нь олдоогүй файлыг чимээгүй
 * алгасдаг тул доорх өнгө шууд харагдана — хуудас эвдрэхгүй.
 */
const BG = "url('/login-bg.png')"

export default function AuthShell({ children }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 py-10 bg-bg text-ink overflow-hidden">
      {/* Дэвсгэр — дэлгэцийг дүүргэж, голоороо байрлана */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: BG }}
      />

      {/* Зөөлөн харанхуйлалт — маягтын эргэн тойрны текст уншигдана */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/30" />

      <div className="relative w-full max-w-sm">{children}</div>
    </main>
  )
}
