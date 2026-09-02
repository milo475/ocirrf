-- Аюулгүй байдлын үйл явдлыг бүртгэх (V5).
-- Амжилтгүй нэвтрэлтэд хэрэглэгч танигдаагүй байдаг тул userId хоосон
-- байж болно. Өмнө нь заавал байх ёстой байсан тул ийм үйл явдлыг
-- бүртгэх боломжгүй байв.
ALTER TABLE "ActivityLog" ALTER COLUMN "userId" DROP NOT NULL;

-- Аюулгүй байдлын үйл явдлыг огноогоор нь хурдан шүүхэд
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");
