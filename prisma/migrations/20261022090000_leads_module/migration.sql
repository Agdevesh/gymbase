-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'WHATSAPP';
ALTER TYPE "LeadSource" ADD VALUE 'INSTAGRAM';

-- AlterTable
ALTER TABLE "LeadActivity" ADD COLUMN "authorId" TEXT;

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");
