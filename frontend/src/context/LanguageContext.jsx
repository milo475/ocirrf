import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setFormatLang } from '../lib/format'

/**
 * Хэлний систем. Түлхүүр нь ихэвчлэн МОНГОЛ эх текст өөрөө —
 * en толиос орчуулгаа авна, олдохгүй бол монголоороо үлдэнэ.
 * Хоёр өөр утгатай давхардсан үгэнд 'reason.order' маягийн түлхүүр
 * ашиглаж mn толидоо мөн бүртгэнэ. {var} орлуулга дэмжинэ.
 */
const DICT = {
  mn: {
    'stock.out': 'Дууссан',
    'reason.order': 'Захиалга',
    'table.range': '{from}–{to} / нийт {total}',
    'finance.income': 'Орлого',
    'finance.expense': 'Зарлага',
    'pay.cash': 'Бэлэн',
    'pay.transfer': 'Шилжүүлэг',
    'pay.card': 'Карт',
    'pay.remaining': 'Үлдэгдэл',
    'ret.partial': 'Хэсэгчлэн буцаасан',
    'ret.full': 'Буцаасан',
    'ret.restocked': 'Үлдэгдэлд нэмсэн',
    'ret.excluded': 'Цалингаас хассан',
    'ret.left': 'Үлдсэн',
    'action.create': 'Үүсгэсэн',
    'action.update': 'Зассан',
    'action.delete': 'Устгасан',
    'action.permission': 'Эрх өөрчилсөн',
  },
  en: {
    // — Нэвтрэлт, бүрхүүл —
    'Нөөц ба захиалгын систем': 'Inventory & order system',
    'Имэйл': 'Email',
    'Нууц үг': 'Password',
    'Нэвтрэх': 'Log in',
    'Нэвтэрч байна…': 'Logging in…',
    'ачаалж байна…': 'loading…',
    'Самбар': 'Dashboard',
    'Нүүр': 'Home',
    'Агуулах': 'Warehouse',
    'Миний хүргэлт': 'My deliveries',
    'Менежер': 'Manager',
    'Жолооч': 'Driver',
    'Бараа': 'Products',
    'Захиалга': 'Orders',
    'Үлдэгдэл': 'Stock',
    'Хэрэглэгчид': 'Users',
    'Тохиргоо': 'Settings',
    'Гарах': 'Log out',
    'Админ': 'Admin',
    'Оператор': 'Operator',
    'Харанхуй': 'Dark',
    'Цайвар': 'Light',
    'Тема солих': 'Toggle theme',

    // — Нийтлэг —
    'Хадгалах': 'Save',
    'Бүртгэх': 'Create',
    'Болих': 'Cancel',
    'Хаах': 'Close',
    'Дахин оролдох': 'Retry',
    'Тийм': 'Yes',
    'Баталгаажуулах': 'Confirm',
    'Нийт': 'Total',
    'Бүгд': 'All',
    'Хайлт': 'Search',
    'Огноо': 'Date',
    'Нэр': 'Name',
    'Утас': 'Phone',
    'Ангилал': 'Category',
    'Үнэ': 'Price',
    'Төлөв': 'Status',
    'Статус': 'Status',
    'Дүн': 'Amount',
    'Эрх': 'Role',
    'Шалтгаан': 'Reason',
    'Хэрэглэгч': 'User',
    'Юу ч алга': 'Nothing here',
    'table.range': '{from}–{to} of {total}',

    // — Самбар —
    'Нөөцийн эрүүл мэнд': 'Stock health',
    'бараа': 'items',
    'Эрсдэлд буй дүн': 'Value at risk',
    'Эрсдэлтэй бараа': 'Items at risk',
    'Дундаж оноо': 'Median score',
    '30 хоногт нөхөх': 'Restock in 30 days',
    '/ 4 дол.хон': '/ 4 wk',
    '— 4 дол.хон': '— 4 wk',
    'Нэгтгэсэн': 'Combined',
    'Категориор': 'By category',
    'эрсдэлийн босго': 'risk threshold',
    'Хяналтын жагсаалт — хамгийн эрсдэлтэй 8': 'Watchlist — top 8 at risk',
    'Сарын борл.': 'Mo. sales',
    'Оноо': 'Score',
    '13 дол.хон': '13 wk',
    'Уналт': 'Drawdown',
    'Дуусах': 'Runway',
    'Эргэц': 'Turnover',
    '7 хон. Δ': 'WoW Δ',
    'Сүүлд нөхсөн': 'Last restock',
    'Дараагийн': 'Next',
    'хон': 'd',
    'дх': 'wk',
    'Онооны задаргаа': 'Score breakdown',
    '13 долоо хоногийн хандлага': '13-week trend',
    'Нийлүүлэгч': 'Supplier',
    'Үлдэгдэл / захиалгын түвшин': 'Stock / reorder level',
    'Сарын борлуулалт': 'Monthly sales',
    'Дараагийн нөхөлт': 'Next restock',
    'хоног': 'days',
    'Суурь': 'Base',
    'Эцсийн оноо': 'Final score',
    'Үлдэгдлийн хүрэлцээ': 'Stock adequacy',
    'Зарлагын хурд': 'Outflow rate',
    'Нөхөн дүүргэлтийн хоцролт': 'Restock delay',
    'Өгөгдөл ачаалж чадсангүй': 'Failed to load data',
    'Бараа бүртгэгдээгүй байна': 'No products registered yet',
    'Эхлээд бараагаа бүртгэж, үлдэгдэл оруулна уу':
      'Register products and add stock first',

    // — Бараа —
    '+ Шинэ бараа': '+ New product',
    'Нэр эсвэл SKU…': 'Name or SKU…',
    'Бүх ангилал': 'All categories',
    'stock.out': 'Out of stock',
    'Идэвхтэй': 'Active',
    'Идэвхгүй': 'Inactive',
    'Засах': 'Edit',
    'Идэвхгүй болгох': 'Deactivate',
    'Шинэ бараа': 'New product',
    'Ангилалгүй': 'No category',
    'Үнэ (₮)': 'Price (₮)',
    'Шинэ бараа бүртгэгдлээ': 'Product created',
    'Бараа шинэчлэгдлээ': 'Product updated',
    '«{name}» идэвхгүй боллоо': '“{name}” deactivated',
    '«{name}» барааг идэвхгүй болгох уу? Жагсаалтад харагдахгүй болно, хуучин захиалгууд хадгалагдана.':
      'Deactivate “{name}”? It will disappear from lists; past orders are preserved.',
    'Бараа олдсонгүй': 'No products found',
    'Жагсаалт ачаалж чадсангүй': 'Failed to load list',

    // — Үлдэгдэл тохируулга —
    'Үлдэгдэл тохируулах': 'Adjust stock',
    'Одоогийн үлдэгдэл:': 'Current stock:',
    'Өөрчлөлт (+ орлого / − зарлага)': 'Change (+ in / − out)',
    'Жишээ: агуулахын тооллого': 'e.g. inventory count',
    '«{name}» үлдэгдэл: {qty} {unit}': '“{name}” stock: {qty} {unit}',

    // — Захиалга —
    '+ Шинэ захиалга': '+ New order',
    '№, нэр, утас…': 'No., name, phone…',
    '№': 'No.',
    'Харилцагч': 'Customer',
    'Үүсгэсэн': 'Created by',
    'Захиалга олдсонгүй': 'No orders found',
    'Шинэ': 'New',
    'Баталгаажсан': 'Confirmed',
    'Бэлтгэж буй': 'Preparing',
    'Бэлэн': 'Ready',
    'Дууссан': 'Completed',
    'Цуцлагдсан': 'Cancelled',
    'Хүлээгдэж буй': 'Pending',
    'Хуваарилагдсан': 'Assigned',
    'Замд яваа': 'On the way',
    'Хүргэгдсэн': 'Delivered',
    'Амжилтгүй': 'Failed',
    'Бэлтгэж эхлэх': 'Start preparing',
    'Бэлэн болсон': 'Mark ready',
    'Дуусгах': 'Complete',
    'Цуцлах': 'Cancel',
    '← Захиалгын жагсаалт': '← Orders list',
    'Хаяг': 'Address',
    'Хүргэлтийн хаяг': 'Delivery address',
    'Тэмдэглэл': 'Note',
    'Нэгж үнэ': 'Unit price',
    'Тоо': 'Qty',
    'Захиалга цуцлах': 'Cancel order',
    'Үлдэгдэл буцаан нэмэгдэнэ. Цуцлах уу?':
      'Stock will be restored. Cancel this order?',
    'Статус шинэчлэгдлээ': 'Status updated',
    'Захиалга цуцлагдаж, үлдэгдэл буцаан нэмэгдлээ':
      'Order cancelled, stock restored',
    'Захиалга ачаалж чадсангүй': 'Failed to load order',

    // — Шинэ захиалга —
    'Шинэ захиалга': 'New order',
    'Хүргэлтийн заавар г.м. (заавал биш)': 'Delivery notes etc. (optional)',
    'Бараа хайх — нэр эсвэл SKU…': 'Search items — name or SKU…',
    'Олдсонгүй': 'Not found',
    '— нэмэгдсэн': '— added',
    'Бараа сонгогдоогүй': 'No items selected',
    'Дээрх хайлтаар бараа нэмнэ үү': 'Add items using the search above',
    '⚠ Үлдэгдэл: {n}': '⚠ In stock: {n}',
    'Мөр устгах': 'Remove row',
    'Захиалга үүсгэх': 'Create order',
    'Захиалга {no} үүслээ': 'Order {no} created',

    // — Шинэ захиалга: 2 алхамт wizard —
    'Хаяг, хүлээн авагч': 'Address & recipient',
    'Бараа сонгох': 'Select items',
    'Улаанбаатар': 'Ulaanbaatar',
    'Орон нутаг': 'Countryside',
    'Дүүрэг': 'District',
    'Хороо': 'Khoroo',
    'Барилга/Хороолол/Хашаа': 'Building / Complex / Fence',
    'Орц': 'Entrance',
    'Давхар': 'Floor',
    'Хаалга': 'Door',
    'Аймаг': 'Province',
    'Сум/Суурин газар': 'Soum / Settlement',
    'Ачаа явах тээвэр': 'Freight transport',
    'Жишээ: Од транс, 99112233': 'e.g. Od Trans, 99112233',
    'Хаягийн дэлгэрэнгүй': 'Address details',
    'Хүлээн авагчийн нэр': 'Recipient name',
    'Хүлээн авагчийн утас': 'Recipient phone',
    'Нэмэлт утас': 'Extra phone',
    'Нэмэлт тэмдэглэл': 'Note',
    '(заавал биш)': '(optional)',
    'Үргэлжлүүлэх': 'Continue',
    'Дүүрэг заавал': 'District is required',
    'Хороо заавал': 'Khoroo is required',
    'Барилга/Хороолол/Хашаа заавал': 'Building is required',
    'Орц заавал': 'Entrance is required',
    'Давхар заавал': 'Floor is required',
    'Хаалга заавал': 'Door is required',
    'Аймаг заавал': 'Province is required',
    'Сум/Суурин газар заавал': 'Soum is required',
    'Ачаа явах тээвэр заавал': 'Transport is required',
    'Утасны дугаар 8 оронтой тоо байна': 'Phone must be 8 digits',
    'Нэмэлт утас 8 оронтой тоо байна': 'Extra phone must be 8 digits',

    // — Хаягийн харагдац (N4) —
    'УБ': 'UB',
    'Тээвэрт гаргах': 'Send by freight',

    // — Sidebar (V3-01) —
    'Цэс хумих': 'Collapse menu',
    'Цэс дэлгэх': 'Expand menu',

    // — Permission Panel (V3-05) —
    'Эрхүүд': 'Permissions',
    '← Хэрэглэгчид': '← Users',
    'Эрхийн тохиргоо хадгалагдлаа': 'Permissions saved',
    'Default руу буцаах': 'Reset to default',
    'Админд бүх эрх үргэлж нээлттэй — өөрчлөх боломжгүй.':
      'Admins always have every permission — cannot be changed.',
    '{n} өөрчлөлт': '{n} change(s)',
    'Санхүү': 'Finance',
    'Тайлан': 'Reports',
    'Систем': 'System',

    // — Payroll (V3-07) —
    'Тооцоогүй цалин': 'Unsettled pay',
    'Тооцоонд орсон': 'In settlement',
    'Олгосон нийт': 'Total paid out',

    // — Finance + Payroll хуудсууд (V3-08) —
    'Жолоочийн цалин': 'Driver payroll',
    'Нийт орлого': 'Total income',
    'Нийт зарлага': 'Total expense',
    'Зөрүү': 'Net',
    'Сүүлийн 30 хоног': 'Last 30 days',
    '30 хоногийн орлого, зарлага': '30-day income and expense',
    // 'Орлого/Зарлага' stock-д 'In/Out' тул finance-д тусгай түлхүүр
    'finance.income': 'Income',
    'finance.expense': 'Expense',
    '+ Гүйлгээ нэмэх': '+ Add entry',
    'Шинэ орлого': 'New income',
    'Шинэ зарлага': 'New expense',
    'Өөр ангилал…': 'Other category…',
    'Ангиллын нэр': 'Category name',
    'Гүйлгээ нэмэгдлээ': 'Entry added',
    'Гүйлгээ олдсонгүй': 'No entries found',
    'Захиалга (авто)': 'Order (auto)',
    'Тооцоо харах': 'View payroll',
    'Борлуулалт': 'Sales',
    'Урьдчилгаа': 'Advance payment',
    'Бусад орлого': 'Other income',
    'Түрээс': 'Rent',
    'Тээвэр': 'Transport',
    'Хангамж': 'Supplies',
    'Цалин': 'Salary',
    'Бусад зарлага': 'Other expense',
    'Тооцоо хийгдээгүй': 'Awaiting settlement',
    'Тооцоо хийгдээгүй жолооч алга': 'No drivers awaiting settlement',
    'Тооцооны түүх': 'Settlement history',
    'Тооцоо хийгдээгүй байна': 'No settlements yet',
    'Тооцоо хаах': 'Close settlement',
    'Тооцоо хаагдлаа': 'Settlement closed',
    'Төлсөн болгох': 'Mark as paid',
    'Төлсөн болголоо': 'Marked as paid',
    'Төлсөн': 'Paid',
    'Хугацаа': 'Period',
    '{name} — {n} хүргэлт, {amt}. Тооцоо хаах уу?':
      '{name} — {n} deliveries, {amt}. Close this settlement?',
    '{name} — {amt}. Цалинг олгосон гэж тэмдэглэхдээ итгэлтэй байна уу?':
      '{name} — {amt}. Are you sure you want to mark this payout as paid?',

    // — Төлбөр (V4-02) —
    'Төлбөр': 'Payment',
    'Төлөөгүй': 'Unpaid',
    'Хэсэгчлэн': 'Partial',
    'Төлбөр бүртгэх': 'Record payment',
    'Төлбөр бүртгэгдлээ': 'Payment recorded',
    'Төлбөр устгах': 'Delete payment',
    'Төлбөрийн бүртгэл устлаа': 'Payment record deleted',
    'Энэ төлбөрийн бүртгэлийг устгахдаа итгэлтэй байна уу? Орлого нь хамт хасагдана.':
      'Are you sure you want to delete this payment record? Its income entry will be removed too.',
    'Хэлбэр': 'Method',
    'Устгах': 'Delete',
    'Авлага': 'Receivables',
    'Нийт авлага': 'Total receivables',
    '{n} захиалга': '{n} orders',
    'Хоног': 'Days',
    'Авлага байхгүй — бүх төлбөр цугларсан':
      'No receivables — all payments collected',

    // — Өртөг + ашиг (V4-03) —
    'Өртөг': 'Cost',
    'Өртөг (₮)': 'Cost (₮)',
    'Ашиг': 'Profit',
    'Ашиг %': 'Margin %',
    'Нийт ашиг': 'Total profit',
    'Нэгжийн өртөг (₮)': 'Unit cost (₮)',
    'pay.cash': 'Cash',
    'pay.transfer': 'Transfer',
    'pay.card': 'Card',
    'pay.remaining': 'Remaining',

    // — Буцаалт (V4-04) —
    'Буцаалт': 'Returns',
    'Буцаалт бүртгэх': 'Record return',
    'Буцаалт бүртгэгдлээ': 'Return recorded',
    'Буцаах бараа сонгоно уу': 'Select items to return',
    'Үлдэгдэлд буцаан нэмэх': 'Restock returned items',
    'Төлсөн дүнгээс буцаан олгох': 'Refund from paid amount',
    'Жолоочийн цалингийн тооцооноос хасах': 'Exclude from driver payroll',
    'тооцоо хаагдсан': 'payout closed',
    'ret.partial': 'Partial return',
    'ret.full': 'Returned',
    'ret.restocked': 'Restocked',
    'ret.excluded': 'Excluded from payroll',
    'ret.left': 'Left',

    // — Хүргэлтийн тариф (V4-05) —
    'Хүргэлтийн хөлс': 'Delivery fee',
    'Хүргэлтийн тариф': 'Delivery tariffs',
    'Дүүрэггүй мөр нь тухайн бүсийн үндсэн тариф':
      'Rows without a district are the default tariff for that region',
    'Тариф хадгалагдлаа': 'Tariffs saved',
    'Тариф давхардаж байна': 'Duplicate tariff',
    'Дүүргийн тусгай тариф (УБ)': 'District-specific tariff (UB)',
    'Тариф': 'Tariff',

    // — Customer portal (V3-14) —
    'Шинэ харилцагч уу?': 'New customer?',
    'Бүртгүүлэх': 'Sign up',
    'Бүртгэлтэй юу?': 'Already have an account?',
    'Харилцагчийн бүртгэл': 'Customer sign-up',
    'Нууц үг давтах': 'Repeat password',
    'Нууц үг таарахгүй байна': 'Passwords do not match',
    'Бүртгэж байна…': 'Signing up…',
    'Миний самбар': 'My dashboard',
    'Миний захиалгууд': 'My orders',
    'Профайл': 'Profile',
    'Нийт {n} захиалга · {m} идэвхтэй': '{n} orders total · {m} active',
    'Сүүлийн захиалгууд': 'Recent orders',
    'Захиалга алга': 'No orders yet',
    'Эхний захиалгаа өгөөрэй!': 'Place your first order!',
    'Профайл хадгалагдлаа': 'Profile saved',
    'Шинэ нууц үг': 'New password',
    '(солих бол)': '(if changing)',
    '(солих бол шинэ дугаар)': '(new number if changing)',
    '← Миний захиалгууд': '← My orders',
    'Нэхэмжлэх харах': 'View invoice',
    'Нэхэмжлэх': 'Invoice',
    'Хэвлэх': 'Print',

    // — Аналитик, Тайлан, Харилцагчид, Тохиргоо (V3-17) —
    'Аналитик': 'Analytics',
    '{n} хоног': '{n} days',
    'Шүүх': 'Filter',
    'Захиалгын тоо': 'Order count',
    'Нийт дүн': 'Total amount',
    'TOP бараа': 'Top products',
    'Давтан': 'Repeat',
    '1 захиалгатай': '1 order',
    '2+ захиалгатай': '2+ orders',
    'захиалга': 'orders',
    'Жолоочдын харьцуулалт': 'Driver comparison',
    'Хүргэсэн': 'Delivered',
    'Бодогдох цалин': 'Accrued pay',
    'Жолооч алга': 'No drivers',
    'Жолооч нар': 'Drivers',
    'Хүргэлтийн тайлан': 'Delivery report',
    'Агуулахын тайлан': 'Inventory report',
    'Санхүүгийн тайлан': 'Finance report',
    'Захиалга, хаяг, жолооч, хүргэсэн огноо':
      'Orders, addresses, drivers, delivery dates',
    'Үлдэгдлийн бүх хөдөлгөөн': 'All stock movements',
    'Орлого, зарлагын гүйлгээнүүд': 'Income and expense entries',
    'Интервал': 'Range',
    'Сүүлийн {n} хоног': 'Last {n} days',
    'CSV татах': 'Download CSV',
    'Тайлан татагдлаа': 'Report downloaded',
    'CSV файлууд Excel-д кирилл үсгээрээ зөв нээгдэнэ (UTF-8 BOM)':
      'CSV files open in Excel with Cyrillic intact (UTF-8 BOM)',
    'Бүртгэлтэй': 'Registered',
    'Утасны захиалгаас': 'From phone orders',
    'Нэр(үүд)': 'Name(s)',
    'Сүүлийн захиалга': 'Last order',
    'Идэвхгүй болгох': 'Deactivate',
    'Идэвхжүүлэх': 'Activate',
    'Идэвхгүй болголоо': 'Deactivated',
    'Идэвхжүүллээ': 'Activated',
    'Бүртгэлтэй харилцагч алга': 'No registered customers',
    'Системийн тохиргоо': 'System settings',
    'Компанийн нэр': 'Company name',
    'Компанийн утас': 'Company phone',
    'Харилцагч шинэ захиалгаа цуцлах боломжтой':
      'Customers may cancel their new orders',
    'Тохиргоо хадгалагдлаа': 'Settings saved',
    'Төлөв': 'Status',
    'Идэвхтэй хүргэлт': 'Active deliveries',
    'Өнөөдөр хүргэсэн': 'Delivered today',
    'Нийт хүргэсэн': 'Total delivered',
    'Тээврийн хэрэгсэл': 'Vehicle',
    'Идэвхгүй': 'Inactive',
    'Бүртгэл засах': 'Edit accounts',
    'Тайлбар': 'Note',
    'Системээс гарах': 'Sign out',
    'Та системээс гарахдаа итгэлтэй байна уу?':
      'Are you sure you want to sign out?',
    'Ж: Гэрт нь байгаагүй — доод талын дэлгүүрт үлдээсэн':
      'e.g. Recipient not home — left at the store downstairs',
    'Хүргэлт баталгаажуулах': 'Confirm delivery',
    'Амжилтгүй тэмдэглэх': 'Mark as failed',
    'Та энэ хүргэлтийг амжилттай гэж баталгаажуулахдаа итгэлтэй байна уу?':
      'Are you sure you want to confirm this delivery as successful?',
    'Та энэ хүргэлтийг амжилтгүй гэж тэмдэглэхдээ итгэлтэй байна уу?':
      'Are you sure you want to mark this delivery as failed?',

    // — Мэдэгдэл + Үйлдлийн түүх (V3-10) —
    'Мэдэгдэл': 'Notifications',
    'Мэдэгдэл алга': 'No notifications',
    'Бүгдийг харах': 'View all',
    'Бүгдийг уншсан болгох': 'Mark all as read',
    'Үйлдлийн түүх': 'Activity log',
    'Үйлдэл': 'Action',
    'Объект': 'Entity',
    'Дэлгэрэнгүй': 'Details',
    'Эхлэх': 'From',
    'Дуусах': 'To',
    'Бичилт олдсонгүй': 'No records found',
    'action.create': 'Created',
    'action.update': 'Updated',
    'action.delete': 'Deleted',
    'action.permission': 'Permission change',
    'Эрхийн тохиргоо': 'Permissions',

    // — Хүргэлтийн удирдлага + маршрут (V3-12) —
    'Хүргэлтийн удирдлага': 'Delivery operations',
    'Өнөөдөр дууссан': 'Delivered today',
    'Жолоочид': 'Drivers',
    'Жолоочгүй': 'Unassigned',
    'Маршрутын дараалал': 'Route order',
    'Дараалал хадгалах': 'Save order',
    'Дараалал хадгалагдлаа': 'Route order saved',
    'Идэвхтэй хүргэлт алга': 'No active deliveries',
    'Замын зураг': 'Map',
    'Миний маршрут': 'My route',

    // — Үлдэгдлийн хөдөлгөөн —
    'Үлдэгдлийн хөдөлгөөн': 'Stock movements',
    'Бүх бараа': 'All products',
    'Өөрчлөлт': 'Change',
    'Холбоос': 'Reference',
    'Захиалга харах': 'View order',
    'reason.order': 'Order',
    'Цуцлалт': 'Cancellation',
    'Эхний орлого': 'Initial stock',
    'Гар тохируулга': 'Manual',
    'Хөдөлгөөн бүртгэгдээгүй': 'No movements recorded',
    'Түүх ачаалж чадсангүй': 'Failed to load history',

    // — Хэрэглэгчид —
    '+ Шинэ хэрэглэгч': '+ New user',
    'Бүртгэсэн': 'Created',
    'Бүтэн нэр': 'Full name',
    'Хамгийн багадаа 6 тэмдэгт': 'At least 6 characters',
    'Шинэ хэрэглэгч': 'New user',
    '«{name}» бүртгэгдлээ': '“{name}” created',
    '«{name}» идэвхжлээ': '“{name}” activated',
    'Хэрэглэгч идэвхгүй болгох': 'Deactivate user',
    '«{name}» цаашид нэвтэрч чадахгүй болно. Идэвхгүй болгох уу?':
      '“{name}” will no longer be able to log in. Deactivate?',
    'Өөрийгөө идэвхгүй болгох боломжгүй': 'You cannot deactivate yourself',
    'Хэрэглэгч алга': 'No users',

    // — Эрхийн самбарууд —
    'Удирдлагын самбар': 'Admin overview',
    'Нийт хүргэлт': 'Total deliveries',
    'Нийт харилцагч': 'Total customers',
    'Нийт жолооч': 'Total drivers',
    'Хүргэлтэд гарсан': 'Out for delivery',
    'Амжилттай хүргэсэн': 'Delivered',
    '7 хоногийн гүйцэтгэл': '7-day performance',
    'Үүсгэсэн захиалга': 'Orders created',
    'Хүргэсэн': 'Delivered',
    'Шилдэг жолооч TOP-3': 'Top 3 drivers',
    'хуваарилагдсан': 'assigned',
    'хүргэсэн': 'delivered',

    'Операторын самбар': 'Operator overview',
    'Миний шивсэн захиалга': 'My orders entered',
    'Биелсэн': 'Fulfilled',
    '7 хоногийн шивэлт': '7-day order entry',
    'Бага үлдэгдэлтэй бараа': 'Low stock items',
    'Бүх үлдэгдэл хэвийн': 'All stock levels healthy',

    'Менежерийн самбар': 'Manager overview',
    'Орлого / зарлага (7 хоног)': 'Stock in / out (7 days)',
    'Орлого': 'In',
    'Зарлага': 'Out',
    'Хуваарилалт хүлээж буй': 'Awaiting assignment',
    'Жолоочдын ачаалал': 'Driver load',
    'идэвхтэй хүргэлт': 'active',
    'Чөлөөтэй': 'Available',
    'Завгүй': 'Busy',
    'Жолоочийн самбар': 'Driver overview',
    'Өнөөдрийн хүргэлт': "Today's deliveries",
    'Авах цалин': 'Earnings',
    'Нийт хүргэсэн': 'Total delivered',
    'Хүргэлтээ эхлэх': 'Start deliveries',
    '7 хоног': '7 days',

    'Лимит': 'Limit',
    'Бага үлдэгдэлтэй': 'Low stock',
    'Бага үлдэгдлийн лимит': 'Low stock limit',
    'Орлого/Зарлага': 'Stock in/out',
    'Төрөл': 'Type',
    'Залруулга': 'Correction',
    'Тоо ширхэг': 'Quantity',

    'Хүргэлт': 'Delivery',
    'Хүргэлтийн мэдээлэл': 'Delivery info',
    'Жолооч хуваарилах': 'Assign driver',
    'Хуваарилах': 'Assign',
    'Жолооч хуваарилагдлаа': 'Driver assigned',
    'Хуваарилсан': 'Assigned at',
    'Хүргэсэн огноо': 'Delivered at',
    'Баталгаажуулах зураг': 'Proof photo',
    '(завгүй)': '(busy)',

    'Одоогоор хуваарилагдсан хүргэлт алга': 'No deliveries assigned right now',
    'Амжилттай': 'Successful',
    'Илгээх': 'Submit',
    'Шалтгаан бичнэ үү': 'Enter the reason',
    'Хүргэлт баталгаажлаа': 'Delivery confirmed',
    'Амжилтгүй гэж тэмдэглэгдлээ': 'Marked as failed',

    'Хөлс': 'Fee',
    'Хүргэлтийн хөлс (₮)': 'Fee per delivery (₮)',
    'Тээврийн хэрэгсэл': 'Vehicle',
    'Хэрэглэгч шинэчлэгдлээ': 'User updated',

    // — Тохиргоо —
    'Хэл': 'Language',
    'Тема': 'Theme',
    'Интерфэйсийн хэлийг сонгоно. Серверийн алдааны мессежүүд одоогоор зөвхөн монголоор ирдэг.':
      'Choose the interface language. Server error messages are currently in Mongolian only.',
  },
}

const LanguageContext = createContext(null)

function applyVars(str, vars) {
  if (!vars) return str
  let out = str
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v))
  }
  return out
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('lang') ?? 'mn'
    } catch {
      return 'mn'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang)
    } catch {
      /* хадгалагдахгүй бол session дотроо л үйлчилнэ */
    }
    setFormatLang(lang)
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key, vars) => {
      const s = DICT[lang]?.[key] ?? DICT.mn[key] ?? key
      return applyVars(s, vars)
    },
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang-ыг LanguageProvider дотор л хэрэглэнэ')
  return ctx
}
