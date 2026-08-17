CREATE TABLE `official_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`catalogKey` varchar(100) NOT NULL,
	`sourceId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subject` varchar(80) NOT NULL,
	`unit` varchar(120) NOT NULL,
	`applicableYear` varchar(40) NOT NULL,
	`documentType` enum('curriculum','guideline','achievement_standard') NOT NULL,
	`officialUrl` text NOT NULL,
	`issueNumber` varchar(100),
	`publishedAt` varchar(30),
	`appliesFrom` varchar(30),
	`appliesTo` varchar(30),
	`rightsStatus` enum('link_only','rights_review','approved_for_rag') NOT NULL DEFAULT 'link_only',
	`catalogStatus` enum('published','pending_review','archived') NOT NULL DEFAULT 'published',
	`summary` text NOT NULL,
	`isDefault` int NOT NULL DEFAULT 1,
	`lastVerifiedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `official_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_documents_catalogKey_unique` UNIQUE(`catalogKey`)
);
--> statement-breakpoint
CREATE TABLE `official_source_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`documentUrl` text NOT NULL,
	`reason` varchar(255) NOT NULL,
	`fingerprint` varchar(128) NOT NULL,
	`snapshot` json,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewNote` text,
	`reviewedAt` timestamp,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `official_source_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `official_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`catalogKey` varchar(100) NOT NULL,
	`provider` varchar(160) NOT NULL,
	`title` varchar(255) NOT NULL,
	`sourceType` enum('ministry','curriculum_center','education_office') NOT NULL,
	`listingUrl` text NOT NULL,
	`allowedUse` enum('link_only','metadata_only','approved_for_rag') NOT NULL DEFAULT 'link_only',
	`enabled` int NOT NULL DEFAULT 1,
	`lastFingerprint` varchar(128),
	`lastCheckedAt` timestamp,
	`lastCheckStatus` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `official_sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `official_sources_catalogKey_unique` UNIQUE(`catalogKey`)
);
--> statement-breakpoint
CREATE INDEX `official_documents_subject_idx` ON `official_documents` (`subject`,`catalogStatus`);--> statement-breakpoint
CREATE INDEX `official_source_changes_source_idx` ON `official_source_changes` (`sourceId`,`status`);--> statement-breakpoint
CREATE INDEX `official_sources_enabled_idx` ON `official_sources` (`enabled`);