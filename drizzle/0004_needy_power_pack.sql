PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercise` (
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
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exercise`("id", "name", "category", "tracking", "weight_units", "weight_assisted", "weight_double_in_stats", "distance_units", "distance_activity_type", "distance_track_aw", "time_options", "time_halfway_alert", "primary_muscle_group", "secondary_muscle_group", "user_id", "created_at", "updated_at") SELECT "id", "name", "category", "tracking", "weight_units", "weight_assisted", "weight_double_in_stats", "distance_units", "distance_activity_type", "distance_track_aw", "time_options", "time_halfway_alert", "primary_muscle_group", "secondary_muscle_group", "user_id", "created_at", "updated_at" FROM `exercise`;--> statement-breakpoint
DROP TABLE `exercise`;--> statement-breakpoint
ALTER TABLE `__new_exercise` RENAME TO `exercise`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_exercise_set` (
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
	`rest_completed_at` integer,
	`final_rest_time` integer,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exercise_set`("id", "workout_exercise_id", "order", "type", "round", "weight", "reps", "time", "distance", "rpe", "rest_time", "rest_completed_at", "final_rest_time", "started_at", "completed_at", "created_at", "updated_at") SELECT "id", "workout_exercise_id", "order", "type", "round", "weight", "reps", "time", "distance", "rpe", "rest_time", "rest_completed_at", "final_rest_time", "started_at", "completed_at", "created_at", "updated_at" FROM `exercise_set`;--> statement-breakpoint
DROP TABLE `exercise_set`;--> statement-breakpoint
ALTER TABLE `__new_exercise_set` RENAME TO `exercise_set`;--> statement-breakpoint
CREATE TABLE `__new_workout` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`start_at` integer,
	`started_at` integer,
	`completed_at` integer,
	`duration` integer,
	`remind` text,
	`user_id` text(21) NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workout`("id", "name", "status", "start_at", "started_at", "completed_at", "duration", "remind", "user_id", "created_at", "updated_at") SELECT "id", "name", "status", "start_at", "started_at", "completed_at", "duration", "remind", "user_id", "created_at", "updated_at" FROM `workout`;--> statement-breakpoint
DROP TABLE `workout`;--> statement-breakpoint
ALTER TABLE `__new_workout` RENAME TO `workout`;--> statement-breakpoint
CREATE TABLE `__new_workout_exercise` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`workout_id` text(21) NOT NULL,
	`exercise_id` text(21) NOT NULL,
	`group_id` text(21),
	`order_in_group` integer,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workout_exercise`("id", "workout_id", "exercise_id", "group_id", "order_in_group", "created_at", "updated_at") SELECT "id", "workout_id", "exercise_id", "group_id", "order_in_group", "created_at", "updated_at" FROM `workout_exercise`;--> statement-breakpoint
DROP TABLE `workout_exercise`;--> statement-breakpoint
ALTER TABLE `__new_workout_exercise` RENAME TO `workout_exercise`;--> statement-breakpoint
CREATE TABLE `__new_workout_group` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`workout_id` text(21) NOT NULL,
	`type` text DEFAULT 'single' NOT NULL,
	`order` integer NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workout_group`("id", "workout_id", "type", "order", "notes", "created_at", "updated_at") SELECT "id", "workout_id", "type", "order", "notes", "created_at", "updated_at" FROM `workout_group`;--> statement-breakpoint
DROP TABLE `workout_group`;--> statement-breakpoint
ALTER TABLE `__new_workout_group` RENAME TO `workout_group`;