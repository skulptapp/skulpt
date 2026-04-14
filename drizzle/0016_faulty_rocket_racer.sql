CREATE TABLE `measurement` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_platform` text,
	`external_id` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `measurement_user_metric_recorded_idx` ON `measurement` (`user_id`,`metric`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `measurement_user_recorded_idx` ON `measurement` (`user_id`,`recorded_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_user_source_metric_external_idx` ON `measurement` (`user_id`,`source`,`metric`,`external_id`);
