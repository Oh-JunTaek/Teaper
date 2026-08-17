CREATE TABLE `reference_question_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`referenceQuestionId` int NOT NULL,
	`useForGeneration` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reference_question_selections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `reference_question_selections_user_idx` ON `reference_question_selections` (`userId`,`referenceQuestionId`);