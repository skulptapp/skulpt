CREATE TABLE `skulpt_sync_metadata` (
	`locale` text(16) PRIMARY KEY NOT NULL,
	`last_sync_timestamp` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `exercise` ADD `source` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `exercise` ADD `skulpt_source_id` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `equipment` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `mistakes` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `instructions` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `description` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `difficulty` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `gif_filename` text;