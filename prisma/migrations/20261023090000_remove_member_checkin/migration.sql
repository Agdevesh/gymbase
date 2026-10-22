-- DropForeignKey
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_gymId_fkey";

-- DropForeignKey
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_loggedById_fkey";

-- DropForeignKey
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_memberId_fkey";

-- DropIndex
DROP INDEX "Member_qrToken_key";

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "qrToken";

-- DropTable
DROP TABLE "CheckIn";

-- DropEnum
DROP TYPE "CheckInSource";

