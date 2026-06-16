-- Partial unique indexes: enforce uniqueness only on non-deleted rows.
-- Prisma can't express partial indexes in the schema, so they live in this
-- migration (applied by `prisma migrate deploy` right after 0_init).
-- Idempotent: DROP IF EXISTS before each CREATE.
--
-- NOTE: `users.username` is intentionally NOT here — it keeps a FULL @unique
-- (users_username_key from 0_init) to match the desktop's full UNIQUE(username),
-- so username semantics are identical on both ends.

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
