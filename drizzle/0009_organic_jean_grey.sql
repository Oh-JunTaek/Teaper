ALTER TABLE `generated_question_sources` ADD `sourceSnapshot` json;--> statement-breakpoint
ALTER TABLE `reference_materials` ADD `sourceLocation` varchar(255);--> statement-breakpoint
ALTER TABLE `reference_materials` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `reference_questions` ADD `questionNumber` varchar(60);--> statement-breakpoint
ALTER TABLE `reference_questions` ADD `sourceLocation` varchar(255);