/**
 * Studexa (app 11)-ийн СУРАГЧИЙН акаунт мөн үү. Платформын Role enum-д
 * сурагчийн role байхгүй тул сурагч = OPERATOR role + studexa.portal
 * override (backend register-student ингэж үүсгэдэг). Нэг л газар
 * тодорхойлно: эрхийн шошго, нүүр хуудас, launcher/app switcher, самбар.
 */
export function isStudexaStudent(user) {
  return (
    user?.role === 'OPERATOR' &&
    Array.isArray(user?.permissions) &&
    user.permissions.includes('studexa.portal')
  )
}
