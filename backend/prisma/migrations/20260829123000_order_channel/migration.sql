-- Захиалга ирсэн суваг (Instagram / Facebook / Утас / Бусад).
-- Хуучин захиалгууд эх сурвалж нь тодорхойгүй тул OTHER болно.
CREATE TYPE "OrderChannel" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'PHONE', 'OTHER');
ALTER TABLE "Order" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'OTHER';
