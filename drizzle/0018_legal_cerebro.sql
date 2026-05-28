CREATE TABLE `app_review_prompt` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`user_id` text(21) NOT NULL,
	`prompt_key` text DEFAULT 'post_workout_review' NOT NULL,
	`cycle_index` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`trigger_workout_id` text(21),
	`shown_workout_id` text(21),
	`eligible_workout_count` integer DEFAULT 0 NOT NULL,
	`completion_source` text,
	`response` text,
	`store_review_available` integer,
	`store_review_has_action` integer,
	`store_review_requested_at` integer,
	`shown_at` integer,
	`submitted_at` integer,
	`dismissed_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_review_prompt_user_cycle_idx` ON `app_review_prompt` (`user_id`,`prompt_key`,`cycle_index`);--> statement-breakpoint
CREATE INDEX `app_review_prompt_user_status_idx` ON `app_review_prompt` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `app_review_prompt_user_updated_at_idx` ON `app_review_prompt` (`user_id`,`updated_at`);