CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingYear" INTEGER NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscription_payments_adminId_billingYear_billingMonth_idx" ON "subscription_payments"("adminId", "billingYear", "billingMonth");
CREATE INDEX "subscription_payments_paidAt_idx" ON "subscription_payments"("paidAt");
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
