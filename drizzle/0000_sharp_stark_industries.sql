CREATE TABLE `exercise` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`tracking` text NOT NULL,
	`weight_units` text,
	`weight_assisted` integer,
	`weight_double_in_stats` integer,
	`distance_units` text,
	`distance_activity_type` text,
	`distance_track_aw` integer,
	`time_options` text,
	`time_halfway_alert` integer,
	`primary_muscle_group` text,
	`secondary_muscle_group` text,
	`user_id` text(21) NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_set` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`workout_exercise_id` text(21) NOT NULL,
	`order` integer NOT NULL,
	`type` text DEFAULT 'normal' NOT NULL,
	`round` integer,
	`weight` real,
	`reps` integer,
	`time` integer,
	`distance` real,
	`rpe` integer,
	`rest_time` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`workout_exercise_id`) REFERENCES `workout_exercise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`status` text(20),
	`is_active` integer DEFAULT true,
	`is_delayed` integer,
	`is_delayed_date` integer,
	`native_token` text(100),
	`eps_token` text(100),
	`application_id` text(50),
	`application_name` text(50),
	`application_version` text(50),
	`application_build_number` text(50),
	`device_brand` text(50),
	`device` text(50),
	`device_type` text(50),
	`device_model` text(50),
	`device_system_name` text(50),
	`device_system_version` text(50),
	`lng` text(2) DEFAULT 'en',
	`alert` integer,
	`badge` integer,
	`lock_screen` integer,
	`notification_center` integer,
	`provisional` integer,
	`sound` integer,
	`car_play` integer,
	`critical_alert` integer,
	`provides_app_settings` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_metadata` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`last_sync_timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text(21) NOT NULL,
	`operation` text NOT NULL,
	`data` text,
	`timestamp` integer NOT NULL,
	`synced` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`duration` integer,
	`user_id` text(21) NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workout_exercise` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`workout_id` text(21) NOT NULL,
	`exercise_id` text(21) NOT NULL,
	`group_id` text(21),
	`order_in_group` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `workout_group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_group` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`workout_id` text(21) NOT NULL,
	`type` text DEFAULT 'single' NOT NULL,
	`order` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE cascade
);
