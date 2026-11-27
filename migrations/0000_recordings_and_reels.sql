CREATE TABLE `recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`duration_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reels` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`reel` text NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE no action
);
