CREATE TABLE `generation_official_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`documentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generation_official_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `official_document_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int NOT NULL,
	`useForGeneration` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `official_document_selections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `generation_official_documents_request_idx` ON `generation_official_documents` (`requestId`,`documentId`);--> statement-breakpoint
CREATE INDEX `official_document_selections_user_idx` ON `official_document_selections` (`userId`,`documentId`);