-- AlterTable
ALTER TABLE "Gym" ADD COLUMN "invoiceSeq" INTEGER NOT NULL DEFAULT 0,
                  ADD COLUMN "gstPercent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "cancelledAt" TIMESTAMP(3),
                         ADD COLUMN "cancelReason" TEXT;
