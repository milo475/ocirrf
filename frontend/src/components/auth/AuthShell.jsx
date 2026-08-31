/**
 * Нэвтрэх хуудсуудын нийтлэг хүрээ — дэвсгэр зурагтай (V5).
 *
 * Login ба ChangePassword хоёр ижил бүтэцтэй байсан тул нэг газарт
 * нэгтгэв: дэвсгэрийг өөрчлөхөд хоёуланд нь нэг дор тусна.
 *
 * ЗУРАГ БАЙХГҮЙ ҮЕД: `background-image` нь олдоогүй файлыг чимээгүй
 * алгасдаг тул доорх `bg-bg` өнгө шууд харагдана. Өөрөөр хэлбэл
 * зураг байхгүй ч хуудас эвдрэхгүй — зүгээр л хуучин шигээ болно.
 */
export default function AuthShell({ children }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 bg-bg text-ink">
      {/* Дэвсгэр зураг */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: "url('/login-bg.png')" }}
      />
      {/* Бүрхүүл — зураг дээр бичиг унших боломжтой байлгана.
          Гэрэл/харанхуй аль ч төрөлд ажиллахаар харанхуй өнгөтэй. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-sm">{children}</div>
    </main>
  )
}
