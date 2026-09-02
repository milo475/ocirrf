-- Амжилттай нэвтрэлтийн түүх (V5).
-- Өмнө нь зөвхөн User.lastLoginAt байсан тул «хаанаас, ямар
-- төхөөрөмжөөр орсон», «миний бүртгэлээр өөр хүн орсон уу» гэдэгт
-- хариулах боломжгүй байв.
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
