/**
 * Нэвтрэх хуудсуудын нийтлэг хүрээ.
 *
 * Login, Signup, ChangePassword гурав ижил бүтэцтэй тул нэг газарт
 * нэгтгэв: хүрээг өөрчлөхөд бүгдэд нь нэг дор тусна.
 *
 * Дэвсгэр зураггүй — зөвхөн `bg-bg` өнгө. (Өмнөх `/login-bg.png`
 * дэвсгэрийг хасав; тэр зургийг одоо зөвхөн Landing ашиглана.)
 */
export default function AuthShell({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-bg text-ink">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}
