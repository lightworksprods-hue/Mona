-- Supporting indexes for dashboard/report date filtering and product catalog filtering.
CREATE INDEX IF NOT EXISTS "products_categoryId_isActive_idx"
ON "products"("categoryId", "isActive");

CREATE INDEX IF NOT EXISTS "sales_createdAt_status_idx"
ON "sales"("createdAt", "status");

CREATE INDEX IF NOT EXISTS "refunds_createdAt_idx"
ON "refunds"("createdAt");
