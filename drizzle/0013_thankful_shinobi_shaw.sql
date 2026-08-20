CREATE TABLE `managed_ai_usage_daily` (
	`id` int AUTO_INCREMENT NOT NULL,
	`usageDate` varchar(10) NOT NULL,
	`operation` enum('generation','validation','vision_extract') NOT NULL,
	`outcome` enum('success','failure','limited') NOT NULL,
	`model` varchar(160) NOT NULL,
	`durationBucket` enum('under_5s','5_to_15s','15_to_45s','over_45s') NOT NULL,
	`callCount` int NOT NULL DEFAULT 0,
	`knownInputTokens` int NOT NULL DEFAULT 0,
	`knownOutputTokens` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_ai_usage_daily_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_ai_usage_daily_unique` UNIQUE(`usageDate`,`operation`,`outcome`,`model`,`durationBucket`)
);
--> statement-breakpoint
CREATE INDEX `managed_ai_usage_daily_date_idx` ON `managed_ai_usage_daily` (`usageDate`);