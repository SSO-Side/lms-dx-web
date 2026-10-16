-- CreateTable
CREATE TABLE `Showcase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `cohortId` INTEGER NOT NULL,
    `slug` VARCHAR(40) NOT NULL,
    `status` ENUM('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'UNPUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `problem` TEXT NULL,
    `architectureImagePath` VARCHAR(500) NULL,
    `coverImagePath` VARCHAR(500) NULL,
    `metrics` JSON NOT NULL,
    `demoUrl` VARCHAR(500) NULL,
    `repoUrl` VARCHAR(500) NULL,
    `instructorReviewedBy` INTEGER NULL,
    `instructorReviewedAt` DATETIME(3) NULL,
    `approvedBy` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Showcase_projectId_key`(`projectId`),
    UNIQUE INDEX `Showcase_slug_key`(`slug`),
    INDEX `Showcase_cohortId_status_idx`(`cohortId`, `status`),
    INDEX `Showcase_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShowcaseConsent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showcaseId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `consentedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ShowcaseConsent_showcaseId_userId_key`(`showcaseId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InboundLead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `showcaseId` INTEGER NOT NULL,
    `cohortId` INTEGER NOT NULL,
    `type` ENUM('COFFEE_CHAT', 'POC') NOT NULL,
    `company` VARCHAR(100) NOT NULL,
    `contactName` VARCHAR(50) NOT NULL,
    `contact` VARCHAR(100) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InboundLead_cohortId_createdAt_idx`(`cohortId`, `createdAt`),
    INDEX `InboundLead_showcaseId_idx`(`showcaseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Showcase` ADD CONSTRAINT `Showcase_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `TeamProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Showcase` ADD CONSTRAINT `Showcase_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Showcase` ADD CONSTRAINT `Showcase_instructorReviewedBy_fkey` FOREIGN KEY (`instructorReviewedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Showcase` ADD CONSTRAINT `Showcase_approvedBy_fkey` FOREIGN KEY (`approvedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowcaseConsent` ADD CONSTRAINT `ShowcaseConsent_showcaseId_fkey` FOREIGN KEY (`showcaseId`) REFERENCES `Showcase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShowcaseConsent` ADD CONSTRAINT `ShowcaseConsent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundLead` ADD CONSTRAINT `InboundLead_showcaseId_fkey` FOREIGN KEY (`showcaseId`) REFERENCES `Showcase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundLead` ADD CONSTRAINT `InboundLead_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
