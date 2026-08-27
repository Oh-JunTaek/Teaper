ALTER TABLE `generated_questions` MODIFY COLUMN `points` double NOT NULL;--> statement-breakpoint
ALTER TABLE `generation_requests` MODIFY COLUMN `points` double NOT NULL;--> statement-breakpoint
ALTER TABLE `reference_questions` MODIFY COLUMN `points` double NOT NULL;