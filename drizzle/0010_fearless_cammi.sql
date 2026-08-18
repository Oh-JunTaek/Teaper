ALTER TABLE `generated_questions` ADD `visualSpec` json;--> statement-breakpoint
ALTER TABLE `reference_questions` ADD `sourceFileName` varchar(255);--> statement-breakpoint
ALTER TABLE `reference_questions` ADD `sourceFileKey` text;--> statement-breakpoint
ALTER TABLE `reference_questions` ADD `sourceFileUrl` text;