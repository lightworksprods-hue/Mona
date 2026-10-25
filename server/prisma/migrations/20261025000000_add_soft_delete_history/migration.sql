ALTER TABLE "sales" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "inventory_movements" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "sales_deletedAt_idx" ON "sales"("deletedAt");
CREATE INDEX "inventory_movements_deletedAt_idx" ON "inventory_movements"("deletedAt");
