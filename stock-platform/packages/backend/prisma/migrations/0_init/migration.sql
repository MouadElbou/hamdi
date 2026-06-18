-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'employee');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originDesktopId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boutiques" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originDesktopId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "boutiques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "originDesktopId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_aliases" (
    "id" TEXT NOT NULL,
    "rawValue" VARCHAR(200) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "originDesktopId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "category_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(50),
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lots" (
    "id" TEXT NOT NULL,
    "refNumber" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "designation" VARCHAR(500) NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "purchaseUnitCost" INTEGER NOT NULL,
    "targetResalePrice" INTEGER,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "subCategoryId" TEXT,
    "sellingPrice" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "blockPrice" INTEGER,
    "barcode" VARCHAR(200),

    CONSTRAINT "purchase_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_orders" (
    "id" TEXT NOT NULL,
    "refNumber" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "observation" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "clientId" TEXT,

    CONSTRAINT "sale_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_lines" (
    "id" TEXT NOT NULL,
    "sellingUnitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "saleOrderId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sale_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_returns" (
    "id" TEXT NOT NULL,
    "refNumber" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "observation" TEXT,
    "saleOrderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_return_lines" (
    "id" TEXT NOT NULL,
    "sellingUnitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "saleReturnId" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sale_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_orders" (
    "id" TEXT NOT NULL,
    "refNumber" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "observation" TEXT,
    "clientId" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_lines" (
    "id" TEXT NOT NULL,
    "customerOrderId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sellingUnitPrice" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_jobs" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "designation" VARCHAR(500) NOT NULL,
    "price" INTEGER NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "maintenance_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_tariffs" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "particuliersPrice" INTEGER,
    "revPrice" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "battery_tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_repair_jobs" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "customerNote" TEXT,
    "amount" INTEGER NOT NULL,
    "costAdjustment" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "battery_repair_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "monthlySalary" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "employeeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "designation" VARCHAR(200) NOT NULL,
    "amount" INTEGER NOT NULL,
    "boutiqueId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credits" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerName" VARCHAR(200) NOT NULL,
    "designation" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "advancePaid" INTEGER NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "saleOrderId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_payments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "customerCreditId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_credit_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credits" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "designation" VARCHAR(500) NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "advancePaid" INTEGER NOT NULL DEFAULT 0,
    "supplierId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "supplier_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_payments" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "supplierCreditId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "supplier_credit_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_movements" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amountIn" INTEGER NOT NULL DEFAULT 0,
    "amountOut" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "bank_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_summaries" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_summary_lines" (
    "id" TEXT NOT NULL,
    "section" VARCHAR(20) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "amount" INTEGER NOT NULL,
    "isAutoComputed" BOOLEAN NOT NULL DEFAULT false,
    "monthlySummaryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "monthly_summary_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_snapshots" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "closingDate" DATE NOT NULL,
    "closingStockValue" INTEGER NOT NULL,
    "closingBankBalance" INTEGER NOT NULL,
    "closingCash" INTEGER NOT NULL,
    "creditDeduction" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "zakat_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zakat_advances" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "zakatSnapshotId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "note" TEXT,
    "year" INTEGER,

    CONSTRAINT "zakat_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_processed_operations" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" VARCHAR(10) NOT NULL,
    "result" VARCHAR(20) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_processed_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_audit_logs" (
    "id" TEXT NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" VARCHAR(10) NOT NULL,
    "result" VARCHAR(20) NOT NULL,
    "detail" TEXT,
    "desktopId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "fileName" VARCHAR(500) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "anomalyCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_anomalies" (
    "id" TEXT NOT NULL,
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" TEXT,
    "anomalyType" VARCHAR(50) NOT NULL,
    "rawValue" TEXT NOT NULL,
    "canonicalValue" TEXT,
    "description" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'employee',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "originDesktopId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "pageKey" VARCHAR(50) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_code_idx" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_deletedAt_idx" ON "suppliers"("deletedAt");

-- CreateIndex
CREATE INDEX "boutiques_name_idx" ON "boutiques"("name");

-- CreateIndex
CREATE INDEX "boutiques_deletedAt_idx" ON "boutiques"("deletedAt");

-- CreateIndex
CREATE INDEX "categories_name_idx" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_deletedAt_idx" ON "categories"("deletedAt");

-- CreateIndex
CREATE INDEX "sub_categories_categoryId_idx" ON "sub_categories"("categoryId");

-- CreateIndex
CREATE INDEX "sub_categories_name_idx" ON "sub_categories"("name");

-- CreateIndex
CREATE INDEX "sub_categories_deletedAt_idx" ON "sub_categories"("deletedAt");

-- CreateIndex
CREATE INDEX "category_aliases_rawValue_idx" ON "category_aliases"("rawValue");

-- CreateIndex
CREATE INDEX "category_aliases_categoryId_idx" ON "category_aliases"("categoryId");

-- CreateIndex
CREATE INDEX "category_aliases_deletedAt_idx" ON "category_aliases"("deletedAt");

-- CreateIndex
CREATE INDEX "clients_name_idx" ON "clients"("name");

-- CreateIndex
CREATE INDEX "clients_deletedAt_idx" ON "clients"("deletedAt");

-- CreateIndex
CREATE INDEX "purchase_lots_categoryId_idx" ON "purchase_lots"("categoryId");

-- CreateIndex
CREATE INDEX "purchase_lots_supplierId_idx" ON "purchase_lots"("supplierId");

-- CreateIndex
CREATE INDEX "purchase_lots_boutiqueId_idx" ON "purchase_lots"("boutiqueId");

-- CreateIndex
CREATE INDEX "purchase_lots_subCategoryId_idx" ON "purchase_lots"("subCategoryId");

-- CreateIndex
CREATE INDEX "purchase_lots_date_idx" ON "purchase_lots"("date");

-- CreateIndex
CREATE INDEX "purchase_lots_barcode_idx" ON "purchase_lots"("barcode");

-- CreateIndex
CREATE INDEX "purchase_lots_deletedAt_idx" ON "purchase_lots"("deletedAt");

-- CreateIndex
CREATE INDEX "sale_orders_clientId_idx" ON "sale_orders"("clientId");

-- CreateIndex
CREATE INDEX "sale_orders_date_idx" ON "sale_orders"("date");

-- CreateIndex
CREATE INDEX "sale_orders_deletedAt_idx" ON "sale_orders"("deletedAt");

-- CreateIndex
CREATE INDEX "sale_lines_saleOrderId_idx" ON "sale_lines"("saleOrderId");

-- CreateIndex
CREATE INDEX "sale_lines_lotId_idx" ON "sale_lines"("lotId");

-- CreateIndex
CREATE INDEX "sale_lines_deletedAt_idx" ON "sale_lines"("deletedAt");

-- CreateIndex
CREATE INDEX "sale_returns_saleOrderId_idx" ON "sale_returns"("saleOrderId");

-- CreateIndex
CREATE INDEX "sale_returns_deletedAt_idx" ON "sale_returns"("deletedAt");

-- CreateIndex
CREATE INDEX "sale_return_lines_saleReturnId_idx" ON "sale_return_lines"("saleReturnId");

-- CreateIndex
CREATE INDEX "sale_return_lines_saleLineId_idx" ON "sale_return_lines"("saleLineId");

-- CreateIndex
CREATE INDEX "sale_return_lines_lotId_idx" ON "sale_return_lines"("lotId");

-- CreateIndex
CREATE INDEX "sale_return_lines_deletedAt_idx" ON "sale_return_lines"("deletedAt");

-- CreateIndex
CREATE INDEX "customer_orders_clientId_idx" ON "customer_orders"("clientId");

-- CreateIndex
CREATE INDEX "customer_orders_date_idx" ON "customer_orders"("date");

-- CreateIndex
CREATE INDEX "customer_orders_status_idx" ON "customer_orders"("status");

-- CreateIndex
CREATE INDEX "customer_orders_deletedAt_idx" ON "customer_orders"("deletedAt");

-- CreateIndex
CREATE INDEX "customer_order_lines_customerOrderId_idx" ON "customer_order_lines"("customerOrderId");

-- CreateIndex
CREATE INDEX "customer_order_lines_lotId_idx" ON "customer_order_lines"("lotId");

-- CreateIndex
CREATE INDEX "customer_order_lines_deletedAt_idx" ON "customer_order_lines"("deletedAt");

-- CreateIndex
CREATE INDEX "maintenance_jobs_boutiqueId_idx" ON "maintenance_jobs"("boutiqueId");

-- CreateIndex
CREATE INDEX "maintenance_jobs_date_idx" ON "maintenance_jobs"("date");

-- CreateIndex
CREATE INDEX "maintenance_jobs_deletedAt_idx" ON "maintenance_jobs"("deletedAt");

-- CreateIndex
CREATE INDEX "battery_tariffs_label_idx" ON "battery_tariffs"("label");

-- CreateIndex
CREATE INDEX "battery_repair_jobs_date_idx" ON "battery_repair_jobs"("date");

-- CreateIndex
CREATE INDEX "battery_repair_jobs_deletedAt_idx" ON "battery_repair_jobs"("deletedAt");

-- CreateIndex
CREATE INDEX "employees_name_idx" ON "employees"("name");

-- CreateIndex
CREATE INDEX "employees_deletedAt_idx" ON "employees"("deletedAt");

-- CreateIndex
CREATE INDEX "salary_payments_employeeId_idx" ON "salary_payments"("employeeId");

-- CreateIndex
CREATE INDEX "salary_payments_date_idx" ON "salary_payments"("date");

-- CreateIndex
CREATE INDEX "salary_payments_deletedAt_idx" ON "salary_payments"("deletedAt");

-- CreateIndex
CREATE INDEX "expenses_boutiqueId_idx" ON "expenses"("boutiqueId");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_deletedAt_idx" ON "expenses"("deletedAt");

-- CreateIndex
CREATE INDEX "customer_credits_customerName_idx" ON "customer_credits"("customerName");

-- CreateIndex
CREATE INDEX "customer_credits_saleOrderId_idx" ON "customer_credits"("saleOrderId");

-- CreateIndex
CREATE INDEX "customer_credits_deletedAt_idx" ON "customer_credits"("deletedAt");

-- CreateIndex
CREATE INDEX "customer_credit_payments_customerCreditId_idx" ON "customer_credit_payments"("customerCreditId");

-- CreateIndex
CREATE INDEX "customer_credit_payments_deletedAt_idx" ON "customer_credit_payments"("deletedAt");

-- CreateIndex
CREATE INDEX "supplier_credits_supplierId_idx" ON "supplier_credits"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_credits_deletedAt_idx" ON "supplier_credits"("deletedAt");

-- CreateIndex
CREATE INDEX "supplier_credit_payments_supplierCreditId_idx" ON "supplier_credit_payments"("supplierCreditId");

-- CreateIndex
CREATE INDEX "supplier_credit_payments_deletedAt_idx" ON "supplier_credit_payments"("deletedAt");

-- CreateIndex
CREATE INDEX "bank_movements_date_idx" ON "bank_movements"("date");

-- CreateIndex
CREATE INDEX "bank_movements_deletedAt_idx" ON "bank_movements"("deletedAt");

-- CreateIndex
CREATE INDEX "monthly_summaries_year_month_idx" ON "monthly_summaries"("year", "month");

-- CreateIndex
CREATE INDEX "monthly_summaries_deletedAt_idx" ON "monthly_summaries"("deletedAt");

-- CreateIndex
CREATE INDEX "monthly_summary_lines_monthlySummaryId_idx" ON "monthly_summary_lines"("monthlySummaryId");

-- CreateIndex
CREATE INDEX "monthly_summary_lines_deletedAt_idx" ON "monthly_summary_lines"("deletedAt");

-- CreateIndex
CREATE INDEX "zakat_snapshots_year_idx" ON "zakat_snapshots"("year");

-- CreateIndex
CREATE INDEX "zakat_snapshots_deletedAt_idx" ON "zakat_snapshots"("deletedAt");

-- CreateIndex
CREATE INDEX "zakat_advances_year_idx" ON "zakat_advances"("year");

-- CreateIndex
CREATE INDEX "zakat_advances_zakatSnapshotId_idx" ON "zakat_advances"("zakatSnapshotId");

-- CreateIndex
CREATE INDEX "zakat_advances_deletedAt_idx" ON "zakat_advances"("deletedAt");

-- CreateIndex
CREATE INDEX "sync_processed_operations_entityType_entityId_idx" ON "sync_processed_operations"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "sync_audit_logs_entityType_entityId_idx" ON "sync_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "sync_audit_logs_desktopId_idx" ON "sync_audit_logs"("desktopId");

-- CreateIndex
CREATE INDEX "sync_audit_logs_occurredAt_idx" ON "sync_audit_logs"("occurredAt");

-- CreateIndex
CREATE INDEX "import_anomalies_importBatchId_idx" ON "import_anomalies"("importBatchId");

-- CreateIndex
CREATE INDEX "import_anomalies_anomalyType_idx" ON "import_anomalies"("anomalyType");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_pageKey_key" ON "user_permissions"("userId", "pageKey");

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_aliases" ADD CONSTRAINT "category_aliases_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lots" ADD CONSTRAINT "purchase_lots_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lots" ADD CONSTRAINT "purchase_lots_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lots" ADD CONSTRAINT "purchase_lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lots" ADD CONSTRAINT "purchase_lots_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "purchase_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_returns" ADD CONSTRAINT "sale_returns_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_saleReturnId_fkey" FOREIGN KEY ("saleReturnId") REFERENCES "sale_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "sale_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_return_lines" ADD CONSTRAINT "sale_return_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "purchase_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_lines" ADD CONSTRAINT "customer_order_lines_customerOrderId_fkey" FOREIGN KEY ("customerOrderId") REFERENCES "customer_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_lines" ADD CONSTRAINT "customer_order_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "purchase_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_jobs" ADD CONSTRAINT "maintenance_jobs_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_boutiqueId_fkey" FOREIGN KEY ("boutiqueId") REFERENCES "boutiques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credits" ADD CONSTRAINT "customer_credits_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_payments" ADD CONSTRAINT "customer_credit_payments_customerCreditId_fkey" FOREIGN KEY ("customerCreditId") REFERENCES "customer_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credits" ADD CONSTRAINT "supplier_credits_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_payments" ADD CONSTRAINT "supplier_credit_payments_supplierCreditId_fkey" FOREIGN KEY ("supplierCreditId") REFERENCES "supplier_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_summary_lines" ADD CONSTRAINT "monthly_summary_lines_monthlySummaryId_fkey" FOREIGN KEY ("monthlySummaryId") REFERENCES "monthly_summaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zakat_advances" ADD CONSTRAINT "zakat_advances_zakatSnapshotId_fkey" FOREIGN KEY ("zakatSnapshotId") REFERENCES "zakat_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_anomalies" ADD CONSTRAINT "import_anomalies_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

