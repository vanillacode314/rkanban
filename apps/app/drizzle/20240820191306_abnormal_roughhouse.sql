CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`index` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch('now')),
	`updatedAt` integer DEFAULT (unixepoch('now')),
	`userId` text NOT NULL,
	`nodeId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`nodeId`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parentId` text,
	`userId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch('now')) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch('now')) NOT NULL,
	FOREIGN KEY (`parentId`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `refreshTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`index` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch('now')),
	`updatedAt` integer DEFAULT (unixepoch('now')),
	`boardId` text NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`boardId`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text NOT NULL,
	`emailVerified` integer DEFAULT false,
	`createdAt` integer DEFAULT (unixepoch('now')),
	`updatedAt` integer DEFAULT (unixepoch('now'))
);
--> statement-breakpoint
CREATE TABLE `verificationTokens` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_index_userId_unique` ON `boards` (`index`,`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `nodes_name_parentId_userId_unique` ON `nodes` (`name`,`parentId`,`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_index_boardId_unique` ON `tasks` (`index`,`boardId`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);