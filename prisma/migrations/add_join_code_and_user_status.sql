-- UserStatus enum を作成
DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Company に joinCode を追加
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "joinCode" TEXT;

-- 既存の会社にジョインコードを自動生成
UPDATE "Company"
SET "joinCode" = LPAD((FLOOR(RANDOM() * 100000))::TEXT, 5, '0') ||
                 CHR(65 + (FLOOR(RANDOM() * 26))::INT) ||
                 CHR(65 + (FLOOR(RANDOM() * 26))::INT)
WHERE "joinCode" IS NULL;

ALTER TABLE "Company" ALTER COLUMN "joinCode" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "Company" ADD CONSTRAINT "Company_joinCode_key" UNIQUE ("joinCode");
EXCEPTION
  WHEN duplicate_table THEN null;
END $$;

-- User に status を追加（既存ユーザーは全員 ACTIVE）
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
