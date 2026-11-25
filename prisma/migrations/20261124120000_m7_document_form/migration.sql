-- AlterTable
ALTER TABLE `Document` ADD COLUMN `content` JSON NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Document_cohortId_ownerId_type_key` ON `Document`(`cohortId`, `ownerId`, `type`);
