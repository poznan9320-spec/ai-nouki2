CREATE TABLE "CalendarMemo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarMemo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarMemo_companyId_date_key" ON "CalendarMemo"("companyId", "date");

ALTER TABLE "CalendarMemo" ADD CONSTRAINT "CalendarMemo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
