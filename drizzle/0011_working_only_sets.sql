PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercise_set` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`workout_exercise_id` text(21) NOT NULL,
	`order` integer NOT NULL,
	`type` text DEFAULT 'working' NOT NULL,
	`round` integer,
	`weight` real,
	`weight_units` text,
	`reps` integer,
	`time` integer,
	`distance` real,
	`distance_units` text,
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
INSERT INTO `__new_exercise_set`("id", "workout_exercise_id", "order", "type", "round", "weight", "weight_units", "reps", "time", "distance", "distance_units", "rpe", "rest_time", "rest_completed_at", "final_rest_time", "started_at", "completed_at", "created_at", "updated_at")
SELECT
	"id",
	"workout_exercise_id",
	"order",
	CASE
		WHEN lower("type") = 'normal' THEN 'working'
		ELSE "type"
	END AS "type",
	"round",
	"weight",
	"weight_units",
	"reps",
	"time",
	"distance",
	"distance_units",
	"rpe",
	"rest_time",
	"rest_completed_at",
	"final_rest_time",
	"started_at",
	"completed_at",
	"created_at",
	"updated_at"
FROM `exercise_set`;
--> statement-breakpoint
DROP TABLE `exercise_set`;--> statement-breakpoint
ALTER TABLE `__new_exercise_set` RENAME TO `exercise_set`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
