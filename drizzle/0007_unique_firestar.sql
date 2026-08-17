CREATE TABLE `ai_provider_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`providerType` enum('managed','ollama','openai_compatible') NOT NULL,
	`label` varchar(120) NOT NULL,
	`baseUrl` varchar(500),
	`model` varchar(160) NOT NULL,
	`encryptedApiKey` text,
	`apiKeyHint` varchar(16),
	`allowExternalTransfer` int NOT NULL DEFAULT 0,
	`externalTransferConsentAt` timestamp,
	`enabled` int NOT NULL DEFAULT 1,
	`lastVerifiedAt` timestamp,
	`lastVerificationStatus` varchar(40),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_provider_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `generation_requests` ADD `providerType` enum('managed','ollama','openai_compatible') DEFAULT 'managed' NOT NULL;--> statement-breakpoint
ALTER TABLE `generation_requests` ADD `providerSettingId` int;--> statement-breakpoint
ALTER TABLE `generation_requests` ADD `providerModel` varchar(160) DEFAULT 'managed-default' NOT NULL;--> statement-breakpoint
ALTER TABLE `generation_requests` ADD `externalTransferConsentAt` timestamp;--> statement-breakpoint
CREATE INDEX `ai_provider_settings_user_idx` ON `ai_provider_settings` (`userId`,`providerType`);