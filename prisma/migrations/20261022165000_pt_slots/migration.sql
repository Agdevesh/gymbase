-- CreateEnum
CREATE TYPE "PtSlotStatus" AS ENUM ('SCHEDULED', 'DONE', 'NO_SHOW', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ReminderType" ADD VALUE 'PT_SESSION';

-- CreateTable
CREATE TABLE "PtSlot" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "status" "PtSlotStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PtSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PtSlot_sessionId_key" ON "PtSlot"("sessionId");

-- CreateIndex
CREATE INDEX "PtSlot_gymId_at_idx" ON "PtSlot"("gymId", "at");

-- CreateIndex
CREATE INDEX "PtSlot_trainerId_at_idx" ON "PtSlot"("trainerId", "at");

-- CreateIndex
CREATE INDEX "PtSlot_memberId_at_idx" ON "PtSlot"("memberId", "at");

-- AddForeignKey
ALTER TABLE "PtSlot" ADD CONSTRAINT "PtSlot_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtSlot" ADD CONSTRAINT "PtSlot_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PtAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtSlot" ADD CONSTRAINT "PtSlot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PtSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtSlot" ADD CONSTRAINT "PtSlot_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PtSlot" ADD CONSTRAINT "PtSlot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

