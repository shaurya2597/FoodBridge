-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "pickupScheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FoodAssistanceRequest" ADD COLUMN     "assignedNgoId" TEXT,
ADD COLUMN     "statusHistory" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "FoodAssistanceRequest_assignedNgoId_status_idx" ON "FoodAssistanceRequest"("assignedNgoId", "status");

-- CreateIndex
CREATE INDEX "FoodAssistanceRequest_phone_status_idx" ON "FoodAssistanceRequest"("phone", "status");

-- AddForeignKey
ALTER TABLE "FoodAssistanceRequest" ADD CONSTRAINT "FoodAssistanceRequest_assignedNgoId_fkey" FOREIGN KEY ("assignedNgoId") REFERENCES "NGOProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
