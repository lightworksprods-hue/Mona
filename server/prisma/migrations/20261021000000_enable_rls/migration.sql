-- The application accesses PostgreSQL through the Express/Prisma backend.
-- Enable RLS on every application table so Supabase's public API roles cannot
-- read or mutate POS data directly. The backend connection remains the only
-- intended data access path and continues to work with its database owner role.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "authorized_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_rewards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loyalty_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "store_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cash_movements" ENABLE ROW LEVEL SECURITY;
