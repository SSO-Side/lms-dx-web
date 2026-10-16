-- CreateTable
CREATE TABLE `Document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `type` ENUM('RESUME', 'COVER_LETTER', 'PORTFOLIO') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `currentVersionId` INTEGER NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'DONE') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Document_cohortId_status_idx`(`cohortId`, `status`),
    INDEX `Document_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `cohortId` INTEGER NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `size` INTEGER NOT NULL,
    `aiConsentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DocumentVersion_cohortId_idx`(`cohortId`),
    UNIQUE INDEX `DocumentVersion_documentId_versionNo_key`(`documentId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentReviewNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `cohortId` INTEGER NOT NULL,
    `reviewerId` INTEGER NOT NULL,
    `comment` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DocumentReviewNote_documentId_idx`(`documentId`),
    INDEX `DocumentReviewNote_cohortId_idx`(`cohortId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentReviewNote` ADD CONSTRAINT `DocumentReviewNote_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentReviewNote` ADD CONSTRAINT `DocumentReviewNote_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentReviewNote` ADD CONSTRAINT `DocumentReviewNote_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
