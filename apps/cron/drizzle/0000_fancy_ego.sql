-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `boards` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch('now')),
	`updatedAt` integer DEFAULT (unixepoch('now')),
	`userId` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `refreshTokens` (
	`id` integer PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`index` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch('now')),
	`updatedAt` integer DEFAULT (unixepoch('now')),
	`boardId` integer NOT NULL,
	`userId` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`boardId`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`emailVerified` integer DEFAULT false,
	`createdAt` integer DEFAULT (unixepoch('now')),
	`updatedAt` integer DEFAULT (unixepoch('now'))
);
--> statement-breakpoint
CREATE TABLE `verificationTokens` (
	`id` integer PRIMARY KEY NOT NULL,
	`userId` integer NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_index_boardId_unique` ON `tasks` (`index`,`boardId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
*/