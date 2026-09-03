-- ocirrf ХАБ = 10 СИСТЕМ. Каталогт 4 placeholder app (COMING_SOON) нэмнэ — нэр,
-- тайлбар, icon, өнгийг SUPERADMIN консолоос солино; key ба id ТОГТМОЛ
-- (seed.ts-ийн APP_CATALOG-тай ижил). Дахин ажиллуулахад аюулгүй.
INSERT INTO "Application"("id", "key", "nameMn", "nameEn", "descriptionMn", "icon", "color", "status", "sortOrder", "updatedAt") VALUES
  ('00000000-0000-4000-8000-0000000a0007', 'borluulalt', 'Борлуулалт / POS', 'Sales & POS',
   'Дэлгүүр, кассын борлуулалт, урамшуулал, төлбөрийн бүртгэл',
   'store', '#c2410c', 'COMING_SOON', 7, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0008', 'tusul', 'Төсөл / Даалгавар', 'Projects & Tasks',
   'Төслийн самбар, даалгавар, хугацаа, багийн ажлын хуваарь',
   'kanban', '#0f766e', 'COMING_SOON', 8, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0009', 'barimt', 'Баримт бичиг', 'Documents',
   'Гэрээ, албан бичиг, хувилбарын хяналт, батлах урсгал',
   'file-text', '#6d28d9', 'COMING_SOON', 9, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-0000000a0010', 'tuslamj', 'Тусламжийн төв', 'Helpdesk',
   'Хэрэглэгчийн хүсэлт, тасалбар, SLA, мэдлэгийн сан',
   'life-buoy', '#0369a1', 'COMING_SOON', 10, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- 'bar-chart-3' нь одоогийн lucide-д байхгүй тул card Package fallback харуулдаг байв
UPDATE "Application" SET "icon" = 'chart-column' WHERE "key" = 'tailan' AND "icon" = 'bar-chart-3';
