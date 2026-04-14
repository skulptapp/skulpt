ALTER TABLE `exercise_set` ADD `weight_units` text;--> statement-breakpoint
ALTER TABLE `exercise_set` ADD `distance_units` text;--> statement-breakpoint
ALTER TABLE `user` ADD `body_weight_units` text;--> statement-breakpoint
ALTER TABLE `user` ADD `measurement_units` text;--> statement-breakpoint
ALTER TABLE `user` ADD `weight_units` text;--> statement-breakpoint
ALTER TABLE `user` ADD `distance_units` text;--> statement-breakpoint
ALTER TABLE `user` ADD `temperature_units` text;--> statement-breakpoint
ALTER TABLE `user` ADD `screen_auto_lock` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `user` ADD `play_sounds` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `user` ADD `play_haptics` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `user` ADD `sounds_volume` integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE `user` ADD `first_weekday` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `time_format` text;--> statement-breakpoint
ALTER TABLE `user` ADD `time_zone` text(50) DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE `user` ADD `calendar` text(50) DEFAULT 'gregorian';--> statement-breakpoint
ALTER TABLE `user` ADD `text_direction` text DEFAULT 'ltr';--> statement-breakpoint
ALTER TABLE `user` ADD `currency_code` text(3) DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE `user` ADD `currency_symbol` text(10) DEFAULT '$';--> statement-breakpoint
ALTER TABLE `user` ADD `region_code` text(10) DEFAULT 'UNKNOWN';