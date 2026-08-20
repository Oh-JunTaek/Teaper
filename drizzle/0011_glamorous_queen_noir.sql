CREATE TABLE `user_ai_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`customInstructions` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_ai_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_ai_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `user_ai_preferences_user_idx` ON `user_ai_preferences` (`userId`);