-- CreateTable
CREATE TABLE "commercial_documents" (
    "id" TEXT NOT NULL,
    "docType" VARCHAR(20) NOT NULL,
    "refNumber" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "clientId" TEXT,
    "clientName" VARCHAR(200),
    "clientAddress" TEXT,
    "clientIce" VARCHAR(50),
    "clientPhone" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "paymentType" VARCHAR(20),
    "observation" TEXT,
    "validUntil" DATE,
    "saleOrderId" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "commercial_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_document_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "lotId" TEXT,
    "designation" VARCHAR(500) NOT NULL,
    "barcode" VARCHAR(200),
    "quantity" INTEGER NOT NULL,
    "sellingUnitPrice" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "originDesktopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "commercial_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_documents_docType_idx" ON "commercial_documents"("docType");

-- CreateIndex
CREATE INDEX "commercial_documents_clientId_idx" ON "commercial_documents"("clientId");

-- CreateIndex
CREATE INDEX "commercial_documents_saleOrderId_idx" ON "commercial_documents"("saleOrderId");

-- CreateIndex
CREATE INDEX "commercial_documents_date_idx" ON "commercial_documents"("date");

-- CreateIndex
CREATE INDEX "commercial_documents_deletedAt_idx" ON "commercial_documents"("deletedAt");

-- CreateIndex
CREATE INDEX "commercial_document_lines_documentId_idx" ON "commercial_document_lines"("documentId");

-- CreateIndex
CREATE INDEX "commercial_document_lines_lotId_idx" ON "commercial_document_lines"("lotId");

-- CreateIndex
CREATE INDEX "commercial_document_lines_deletedAt_idx" ON "commercial_document_lines"("deletedAt");

-- AddForeignKey
ALTER TABLE "commercial_documents" ADD CONSTRAINT "commercial_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_documents" ADD CONSTRAINT "commercial_documents_saleOrderId_fkey" FOREIGN KEY ("saleOrderId") REFERENCES "sale_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "commercial_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_document_lines" ADD CONSTRAINT "commercial_document_lines_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "purchase_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
