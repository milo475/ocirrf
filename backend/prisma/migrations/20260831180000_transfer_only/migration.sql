-- ЗӨВХӨН ШИЛЖҮҮЛЭГ (V5).
-- Компани бэлэн мөнгөөр үйлчлэхээ больсон тул CASH ба CARD-ыг
-- системээс хасна. Postgres enum-аас утга шууд хасахгүй тул шинэ
-- төрөл үүсгэж сольдог. Байгаа бичилтүүд TRANSFER болж хөрвөнө.
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE TEXT;
UPDATE "Payment" SET "method" = 'TRANSFER' WHERE "method" <> 'TRANSFER';

DROP TYPE "PaymentMethod";
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER');

ALTER TABLE "Payment"
  ALTER COLUMN "method" TYPE "PaymentMethod" USING "method"::"PaymentMethod";
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'TRANSFER';

-- Хүсэлтээс татгалзсан шалтгаан
ALTER TABLE "OrderRequest" ADD COLUMN "rejectReason" TEXT;
