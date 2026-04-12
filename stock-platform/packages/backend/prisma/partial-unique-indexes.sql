-- Partial unique indexes: enforce uniqueness only on non-deleted rows.
-- Run this AFTER `prisma db push` since Prisma doesn't support partial indexes natively.
-- These replace the @unique constraints that were removed from the schema.

-- Idempotent: DROP IF EXISTS before creating

DROP INDEX IF EXISTS "suppliers_code_active_unique";
CREATE UNIQUE INDEX "suppliers_code_active_unique"
  ON "suppliers" ("code") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "boutiques_name_active_unique";
CREATE UNIQUE INDEX "boutiques_name_active_unique"
  ON "boutiques" ("name") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "categories_name_active_unique";
CREATE UNIQUE INDEX "categories_name_active_unique"
  ON "categories" ("name") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "clients_name_active_unique";
CREATE UNIQUE INDEX "clients_name_active_unique"
  ON "clients" ("name") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "battery_tariffs_label_active_unique";
CREATE UNIQUE INDEX "battery_tariffs_label_active_unique"
  ON "battery_tariffs" ("label") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "employees_name_active_unique";
CREATE UNIQUE INDEX "employees_name_active_unique"
  ON "employees" ("name") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "monthly_summaries_year_month_active_unique";
CREATE UNIQUE INDEX "monthly_summaries_year_month_active_unique"
  ON "monthly_summaries" ("year", "month") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "zakat_snapshots_year_active_unique";
CREATE UNIQUE INDEX "zakat_snapshots_year_active_unique"
  ON "zakat_snapshots" ("year") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "category_aliases_raw_value_active_unique";
CREATE UNIQUE INDEX "category_aliases_raw_value_active_unique"
  ON "category_aliases" ("rawValue") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "users_username_active_unique";
CREATE UNIQUE INDEX "users_username_active_unique"
  ON "users" ("username") WHERE "deletedAt" IS NULL;
