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
	`primary_muscle_groups` text,
	`secondary_muscle_groups` text,
	`user_id` text(21) NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_exercise`("id", "name", "category", "tracking", "weight_units", "weight_assisted", "weight_double_in_stats", "distance_units", "distance_activity_type", "distance_track_aw", "time_options", "time_halfway_alert", "primary_muscle_groups", "secondary_muscle_groups", "user_id", "created_at", "updated_at") SELECT "id", "name", "category", "tracking", "weight_units", "weight_assisted", "weight_double_in_stats", "distance_units", "distance_activity_type", "distance_track_aw", "time_options", "time_halfway_alert", CASE WHEN "primary_muscle_group" IS NULL OR trim("primary_muscle_group") = '' THEN NULL ELSE '["' || "primary_muscle_group" || '"]' END, CASE WHEN "secondary_muscle_group" IS NULL OR trim("secondary_muscle_group") = '' THEN NULL ELSE '["' || "secondary_muscle_group" || '"]' END, "user_id", "created_at", "updated_at" FROM `exercise`;--> statement-breakpoint
DROP TABLE `exercise`;--> statement-breakpoint
ALTER TABLE `__new_exercise` RENAME TO `exercise`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
