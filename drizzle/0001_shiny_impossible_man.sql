CREATE TABLE `generated_question_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generatedQuestionId` int NOT NULL,
	`sourceType` enum('material','reference_question','guideline') NOT NULL,
	`sourceId` int NOT NULL,
	`excerpt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_question_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generated_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`creatorId` int NOT NULL,
	`questionText` text NOT NULL,
	`choices` json,
	`answer` text NOT NULL,
	`explanation` text NOT NULL,
	`intent` text NOT NULL,
	`difficulty` varchar(30) NOT NULL,
	`points` int NOT NULL,
	`questionType` varchar(80) NOT NULL,
	`usedConcepts` json,
	`validationReport` json,
	`model` varchar(120) NOT NULL,
	`promptVersion` varchar(80) NOT NULL,
	`status` enum('pending_review','approved','revised','rejected','validation_hold') NOT NULL DEFAULT 'pending_review',
	`reviewedBy` int,
	`reviewReason` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generated_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generation_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requesterId` int NOT NULL,
	`subject` varchar(80) NOT NULL,
	`unit` varchar(120) NOT NULL,
	`difficulty` varchar(30) NOT NULL,
	`questionType` varchar(80) NOT NULL,
	`points` int NOT NULL,
	`questionCount` int NOT NULL,
	`additionalRequirements` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generation_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `material_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`materialId` int NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`embedding` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `material_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reference_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subject` varchar(80) NOT NULL,
	`unit` varchar(120) NOT NULL,
	`applicableYear` varchar(20) NOT NULL,
	`materialType` enum('curriculum','textbook','guideline','teaching','other') NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileKey` text NOT NULL,
	`fileUrl` text NOT NULL,
	`sourceText` text,
	`ocrText` text,
	`ocrStructure` json,
	`ocrStatus` enum('not_required','pending','completed','failed') NOT NULL DEFAULT 'not_required',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reference_materials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reference_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`subject` varchar(80) NOT NULL,
	`unit` varchar(120) NOT NULL,
	`questionType` varchar(80) NOT NULL,
	`difficulty` varchar(30) NOT NULL,
	`points` int NOT NULL,
	`year` varchar(20) NOT NULL,
	`source` varchar(160) NOT NULL,
	`questionText` text NOT NULL,
	`choices` json,
	`answer` text NOT NULL,
	`explanation` text NOT NULL,
	`intent` text NOT NULL,
	`embedding` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reference_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generatedQuestionId` int NOT NULL,
	`reviewerId` int NOT NULL,
	`action` enum('approved','revised','rejected') NOT NULL,
	`reason` text,
	`beforeSnapshot` json,
	`afterSnapshot` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('teacher','admin') NOT NULL DEFAULT 'teacher';--> statement-breakpoint
CREATE INDEX `generated_question_sources_question_idx` ON `generated_question_sources` (`generatedQuestionId`);--> statement-breakpoint
CREATE INDEX `generated_questions_status_idx` ON `generated_questions` (`status`);--> statement-breakpoint
CREATE INDEX `material_chunks_material_idx` ON `material_chunks` (`materialId`);--> statement-breakpoint
CREATE INDEX `reference_materials_subject_unit_idx` ON `reference_materials` (`subject`,`unit`);--> statement-breakpoint
CREATE INDEX `reference_questions_subject_unit_idx` ON `reference_questions` (`subject`,`unit`);--> statement-breakpoint
CREATE INDEX `review_events_question_idx` ON `review_events` (`generatedQuestionId`);