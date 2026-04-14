CREATE INDEX `exercise_set_workout_exercise_completed_type_idx` ON `exercise_set` (`workout_exercise_id`,`completed_at`,`type`);--> statement-breakpoint
CREATE INDEX `workout_user_status_idx` ON `workout` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `workout_user_created_at_idx` ON `workout` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `workout_status_idx` ON `workout` (`status`);--> statement-breakpoint
CREATE INDEX `workout_exercise_workout_idx` ON `workout_exercise` (`workout_id`);