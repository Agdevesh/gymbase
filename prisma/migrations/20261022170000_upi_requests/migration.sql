-- CreateEnum
CREATE TYPE "UpiRequestStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BankAlertSource" AS ENUM ('SMS', 'EMAIL', 'MANUAL');

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "upiAlertToken" TEXT;

-- CreateTable
CREATE TABLE "UpiRequest" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "UpiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "utr" TEXT,
    "paymentId" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAlert" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "source" "BankAlertSource" NOT NULL,
    "sender" TEXT,
    "text" TEXT NOT NULL,
    "amountPaise" INTEGER,
    "utr" TEXT,
    "payerVpa" TEXT,
    "requestId" TEXT,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UpiRequest_token_key" ON "UpiRequest"("token");

-- CreateIndex
CREATE UNIQUE INDEX "UpiRequest_paymentId_key" ON "UpiRequest"("paymentId");

-- CreateIndex
CREATE INDEX "UpiRequest_gymId_status_createdAt_idx" ON "UpiRequest"("gymId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "UpiRequest_invoiceId_idx" ON "UpiRequest"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "UpiRequest_gymId_code_key" ON "UpiRequest"("gymId", "code");

-- CreateIndex
CREATE INDEX "BankAlert_gymId_receivedAt_idx" ON "BankAlert"("gymId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BankAlert_gymId_utr_key" ON "BankAlert"("gymId", "utr");

-- CreateIndex
CREATE UNIQUE INDEX "Gym_upiAlertToken_key" ON "Gym"("upiAlertToken");

-- AddForeignKey
ALTER TABLE "UpiRequest" ADD CONSTRAINT "UpiRequest_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiRequest" ADD CONSTRAINT "UpiRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiRequest" ADD CONSTRAINT "UpiRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiRequest" ADD CONSTRAINT "UpiRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpiRequest" ADD CONSTRAINT "UpiRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAlert" ADD CONSTRAINT "BankAlert_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAlert" ADD CONSTRAINT "BankAlert_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UpiRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

