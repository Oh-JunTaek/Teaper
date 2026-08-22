CREATE TABLE `managed_ai_monthly_success` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`usageMonth` varchar(7) NOT NULL,
	`successCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managed_ai_monthly_success_id` PRIMARY KEY(`id`),
	CONSTRAINT `managed_ai_monthly_success_unique` UNIQUE(`ownerId`,`usageMonth`)
);
--> statement-breakpoint
CREATE INDEX `managed_ai_monthly_success_month_idx` ON `managed_ai_monthly_success` (`usageMonth`);