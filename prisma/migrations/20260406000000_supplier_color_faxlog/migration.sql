-- AlterTable: Supplier に color カラムを追加
ALTER TABLE "Supplier" ADD COLUMN "color" TEXT;

-- CreateTable: FAXメール処理済みログ
CREATE TABLE "FaxLog" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaxLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FaxLog_messageId_key" ON "FaxLog"("messageId");
