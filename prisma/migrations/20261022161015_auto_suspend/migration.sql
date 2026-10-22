-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'SUSPENDED';
-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "autoSuspendDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "autoSuspendEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

