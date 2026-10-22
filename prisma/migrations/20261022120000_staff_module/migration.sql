-- AlterTable
ALTER TABLE "User" ADD COLUMN "commissionPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PtAssignment" ADD COLUMN "membershipId" TEXT, ADD COLUMN "feePaise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Commission" ADD COLUMN "ptAssignmentId" TEXT;

-- CreateTable
CREATE TABLE "PtSession" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "PtSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PtSession_assignmentId_at_idx" ON "PtSession"("assignmentId", "at");
CREATE INDEX "PtAssignment_memberId_idx" ON "PtAssignment"("memberId");

-- AddForeignKey
ALTER TABLE "PtAssignment" ADD CONSTRAINT "PtAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PtSession" ADD CONSTRAINT "PtSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PtAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PtSession" ADD CONSTRAINT "PtSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_ptAssignmentId_fkey" FOREIGN KEY ("ptAssignmentId") REFERENCES "PtAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A trainer's deletion (gym teardown) must cascade through their session log
ALTER TABLE "PtSession" DROP CONSTRAINT "PtSession_trainerId_fkey";
ALTER TABLE "PtSession" ADD CONSTRAINT "PtSession_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
