CREATE TABLE `teacher_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`scheduleDate` varchar(10) NOT NULL,
	`scheduleTime` varchar(5),
	`eventType` enum('exam','deadline','meeting','review','other') NOT NULL DEFAULT 'other',
	`status` enum('planned','completed') NOT NULL DEFAULT 'planned',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `teacher_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `teacher_schedules_owner_date_idx` ON `teacher_schedules` (`ownerId`,`scheduleDate`,`status`);