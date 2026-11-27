CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`duration_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reels` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`recording_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`reel` text NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reels_id_unique` ON `reels` (`id`);--> statement-breakpoint
CREATE INDEX `reels_recording_id_created_at_idx` ON `reels` (`recording_id`,`created_at`);