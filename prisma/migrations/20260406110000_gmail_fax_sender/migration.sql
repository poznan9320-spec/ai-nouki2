-- AlterTable: GmailToken に FAX送信元メールアドレスを追加
ALTER TABLE "GmailToken" ADD COLUMN "faxSenderEmail" TEXT NOT NULL DEFAULT 'FromBrotherDevice@brother.com';
