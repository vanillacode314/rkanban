CREATE TABLE `forgotPasswordTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP INDEX IF EXISTS `boards_index_userId_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD `publicKey` text;--> statement-breakpoint
ALTER TABLE `users` ADD `encryptedPrivateKey` text;--> statement-breakpoint
ALTER TABLE `users` ADD `salt` text;--> statement-breakpoint
CREATE UNIQUE INDEX `boards_index_userId_nodeId_unique` ON `boards` (`index`,`userId`,`nodeId`);