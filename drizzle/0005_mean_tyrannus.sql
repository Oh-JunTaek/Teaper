CREATE TABLE `generation_reference_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`referenceQuestionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generation_reference_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `generation_reference_questions_request_idx` ON `generation_reference_questions` (`requestId`,`referenceQuestionId`);