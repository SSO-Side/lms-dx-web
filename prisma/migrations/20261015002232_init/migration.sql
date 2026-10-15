-- CreateTable
CREATE TABLE `Academy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academyId` INTEGER NULL,
    `role` ENUM('STUDENT', 'INSTRUCTOR', 'MANAGER', 'ACADEMY_ADMIN', 'ADMIN') NOT NULL,
    `loginId` VARCHAR(50) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `email` VARCHAR(120) NULL,
    `phone` VARCHAR(30) NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_loginId_key`(`loginId`),
    INDEX `User_academyId_role_idx`(`academyId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` VARCHAR(64) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuthSession_userId_idx`(`userId`),
    INDEX `AuthSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cohort` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academyId` INTEGER NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `trainingType` VARCHAR(100) NULL,
    `room` VARCHAR(100) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `weeklySchedule` JSON NULL,
    `holidays` JSON NULL,
    `status` ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    `attendanceConfig` JSON NULL,
    `featureFlags` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Cohort_academyId_status_idx`(`academyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CohortStaff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `staffRole` ENUM('MANAGER', 'INSTRUCTOR') NOT NULL,
    `title` VARCHAR(50) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `CohortStaff_userId_idx`(`userId`),
    UNIQUE INDEX `CohortStaff_cohortId_userId_key`(`cohortId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enrollment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `status` ENUM('ENROLLED', 'DROPPED', 'COMPLETED') NOT NULL DEFAULT 'ENROLLED',
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Enrollment_studentId_idx`(`studentId`),
    UNIQUE INDEX `Enrollment_cohortId_studentId_key`(`cohortId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Week` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `weekNo` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,

    UNIQUE INDEX `Week_cohortId_weekNo_key`(`cohortId`, `weekNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lesson` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `weekId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `instructorId` INTEGER NULL,

    INDEX `Lesson_cohortId_date_idx`(`cohortId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Material` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `type` ENUM('DOC', 'FILE', 'REPO', 'GUIDE') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `tags` JSON NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Material_cohortId_lessonId_idx`(`cohortId`, `lessonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `lessonId` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `dueAt` DATETIME(3) NOT NULL,

    INDEX `Assignment_cohortId_dueAt_idx`(`cohortId`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Submission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `assignmentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `fileUrl` VARCHAR(1000) NULL,
    `linkUrl` VARCHAR(1000) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SUBMITTED', 'LATE', 'RETURNED') NOT NULL DEFAULT 'SUBMITTED',

    INDEX `Submission_cohortId_idx`(`cohortId`),
    UNIQUE INDEX `Submission_assignmentId_studentId_key`(`assignmentId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `type` ENUM('ABSENCE', 'COUNSELING', 'DOCUMENT', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `requesterId` INTEGER NOT NULL,
    `assigneeId` INTEGER NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ticket_cohortId_status_idx`(`cohortId`, `status`),
    INDEX `Ticket_requesterId_idx`(`requesterId`),
    INDEX `Ticket_assigneeId_idx`(`assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketAttachment_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `actorId` INTEGER NOT NULL,
    `fromStatus` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'CANCELED') NULL,
    `toStatus` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION', 'CANCELED') NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketEvent_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AbsenceDetail` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `absentDate` DATE NOT NULL,
    `reasonType` ENUM('SICK', 'LEAVE', 'OTHER') NOT NULL,
    `linkedAttendanceEventId` INTEGER NULL,

    UNIQUE INDEX `AbsenceDetail_ticketId_key`(`ticketId`),
    UNIQUE INDEX `AbsenceDetail_linkedAttendanceEventId_key`(`linkedAttendanceEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingDay` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `isTraining` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(200) NULL,

    UNIQUE INDEX `TrainingDay_cohortId_date_key`(`cohortId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendancePeriod` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `label` VARCHAR(50) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,

    INDEX `AttendancePeriod_cohortId_startDate_idx`(`cohortId`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('ABSENT', 'LATE', 'EARLY_LEAVE', 'OUT') NOT NULL,
    `excused` BOOLEAN NOT NULL DEFAULT false,
    `excusedType` ENUM('SICK', 'LEAVE') NULL,
    `ticketId` INTEGER NULL,
    `note` VARCHAR(300) NULL,
    `recordedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceEvent_cohortId_date_idx`(`cohortId`, `date`),
    UNIQUE INDEX `AttendanceEvent_cohortId_studentId_date_type_key`(`cohortId`, `studentId`, `date`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceOpening` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `periodId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `absent` INTEGER NOT NULL DEFAULT 0,
    `late` INTEGER NOT NULL DEFAULT 0,
    `earlyLeave` INTEGER NOT NULL DEFAULT 0,
    `out` INTEGER NOT NULL DEFAULT 0,
    `excusedUsed` INTEGER NOT NULL DEFAULT 0,
    `asOfDate` DATE NOT NULL,
    `recordedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceOpening_cohortId_idx`(`cohortId`),
    UNIQUE INDEX `AttendanceOpening_periodId_studentId_key`(`periodId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceDayClose` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `closedById` INTEGER NOT NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AttendanceDayClose_cohortId_date_key`(`cohortId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceEventLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cohortId` INTEGER NOT NULL,
    `eventId` INTEGER NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `actorId` INTEGER NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AttendanceEventLog_cohortId_eventId_idx`(`cohortId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_academyId_fkey` FOREIGN KEY (`academyId`) REFERENCES `Academy`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cohort` ADD CONSTRAINT `Cohort_academyId_fkey` FOREIGN KEY (`academyId`) REFERENCES `Academy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CohortStaff` ADD CONSTRAINT `CohortStaff_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CohortStaff` ADD CONSTRAINT `CohortStaff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Week` ADD CONSTRAINT `Week_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_weekId_fkey` FOREIGN KEY (`weekId`) REFERENCES `Week`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lesson` ADD CONSTRAINT `Lesson_instructorId_fkey` FOREIGN KEY (`instructorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Material` ADD CONSTRAINT `Material_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Material` ADD CONSTRAINT `Material_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Material` ADD CONSTRAINT `Material_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_lessonId_fkey` FOREIGN KEY (`lessonId`) REFERENCES `Lesson`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketEvent` ADD CONSTRAINT `TicketEvent_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketEvent` ADD CONSTRAINT `TicketEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsenceDetail` ADD CONSTRAINT `AbsenceDetail_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingDay` ADD CONSTRAINT `TrainingDay_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendancePeriod` ADD CONSTRAINT `AttendancePeriod_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEvent` ADD CONSTRAINT `AttendanceEvent_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceOpening` ADD CONSTRAINT `AttendanceOpening_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceOpening` ADD CONSTRAINT `AttendanceOpening_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `AttendancePeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceOpening` ADD CONSTRAINT `AttendanceOpening_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceOpening` ADD CONSTRAINT `AttendanceOpening_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceDayClose` ADD CONSTRAINT `AttendanceDayClose_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceDayClose` ADD CONSTRAINT `AttendanceDayClose_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceEventLog` ADD CONSTRAINT `AttendanceEventLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
