CREATE TABLE `quick_quiz_sets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`subject` varchar(80) NOT NULL,
	`unit` varchar(120) NOT NULL,
	`topic` varchar(160) NOT NULL,
	`difficulty` varchar(30) NOT NULL,
	`questionCount` int NOT NULL,
	`questions` json NOT NULL,
	`providerType` varchar(40) NOT NULL,
	`providerModel` varchar(160) NOT NULL,
	`promptVersion` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `quick_quiz_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacher_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`content` text NOT NULL,
	`isPinned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `teacher_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `quick_quiz_sets_owner_updated_idx` ON `quick_quiz_sets` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `teacher_notes_owner_updated_idx` ON `teacher_notes` (`ownerId`,`updatedAt`);