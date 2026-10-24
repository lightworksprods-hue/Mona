-- These indexes duplicate the indexes already created by the corresponding
-- Prisma @unique constraints. Unique protection remains unchanged.
DROP INDEX IF EXISTS "products_barcode_idx";
DROP INDEX IF EXISTS "products_sku_idx";
DROP INDEX IF EXISTS "customers_phone_idx";
DROP INDEX IF EXISTS "sales_transactionNumber_idx";
DROP INDEX IF EXISTS "refunds_refundNumber_idx";
