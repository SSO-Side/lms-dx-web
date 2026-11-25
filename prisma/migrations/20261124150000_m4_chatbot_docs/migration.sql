-- CreateTable
CREATE TABLE `ChatbotDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academyId` INTEGER NOT NULL,
    `cohortId` INTEGER NULL,
    `title` VARCHAR(200) NOT NULL,
    `audience` ENUM('STUDENT', 'INSTRUCTOR', 'ALL') NOT NULL DEFAULT 'ALL',
    `filePath` VARCHAR(255) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `uploadedBy` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatbotDocument_academyId_cohortId_idx`(`academyId`, `cohortId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChatbotDocument` ADD CONSTRAINT `ChatbotDocument_academyId_fkey` FOREIGN KEY (`academyId`) REFERENCES `Academy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatbotDocument` ADD CONSTRAINT `ChatbotDocument_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatbotDocument` ADD CONSTRAINT `ChatbotDocument_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
