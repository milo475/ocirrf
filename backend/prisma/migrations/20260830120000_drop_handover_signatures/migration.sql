-- Дэлгэц дээр гарын үсэг зурах хэрэгцээ байхгүй болов (V5).
-- Хуудсыг хэвлээд цаасан дээр нь гараар гарын үсэг зурна.
ALTER TABLE "DriverHandover" DROP COLUMN "keeperSignature";
ALTER TABLE "DriverHandover" DROP COLUMN "driverSignature";
