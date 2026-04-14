PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text(21) PRIMARY KEY NOT NULL,
	`status` text(20),
	`is_active` integer DEFAULT true,
	`is_delayed` integer,
	`is_delayed_date` integer,
	`pushes` integer DEFAULT true,
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
	`theme` text DEFAULT 'auto',
	`body_weight_units` text,
	`measurement_units` text,
	`weight_units` text,
	`distance_units` text,
	`temperature_units` text,
	`screen_auto_lock` integer DEFAULT true,
	`play_sounds` integer DEFAULT true,
	`play_haptics` integer DEFAULT true,
	`sounds_volume` integer DEFAULT 100,
	`first_weekday` integer,
	`time_format` text,
	`time_zone` text(50) DEFAULT 'UTC',
	`calendar` text(50) DEFAULT 'gregorian',
	`text_direction` text DEFAULT 'ltr',
	`currency_code` text(3) DEFAULT 'USD',
	`currency_symbol` text(10) DEFAULT '$',
	`region_code` text(10) DEFAULT 'UNKNOWN',
	`mhr_formula` text DEFAULT 'nes',
	`mhr_manual_value` integer,
	`birthday` integer,
	`biological_sex` text,
	`activity_level` text,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "status", "is_active", "is_delayed", "is_delayed_date", "pushes", "native_token", "eps_token", "application_id", "application_name", "application_version", "application_build_number", "device_brand", "device", "device_type", "device_model", "device_system_name", "device_system_version", "lng", "alert", "badge", "lock_screen", "notification_center", "provisional", "sound", "car_play", "critical_alert", "provides_app_settings", "theme", "body_weight_units", "measurement_units", "weight_units", "distance_units", "temperature_units", "screen_auto_lock", "play_sounds", "play_haptics", "sounds_volume", "first_weekday", "time_format", "time_zone", "calendar", "text_direction", "currency_code", "currency_symbol", "region_code", "mhr_formula", "mhr_manual_value", "birthday", "biological_sex", "activity_level", "created_at", "updated_at") SELECT "id", "status", "is_active", "is_delayed", "is_delayed_date", "pushes", "native_token", "eps_token", "application_id", "application_name", "application_version", "application_build_number", "device_brand", "device", "device_type", "device_model", "device_system_name", "device_system_version", "lng", "alert", "badge", "lock_screen", "notification_center", "provisional", "sound", "car_play", "critical_alert", "provides_app_settings", "theme", "body_weight_units", "measurement_units", "weight_units", "distance_units", "temperature_units", "screen_auto_lock", "play_sounds", "play_haptics", "sounds_volume", "first_weekday", "time_format", "time_zone", "calendar", "text_direction", "currency_code", "currency_symbol", "region_code", "mhr_formula", "mhr_manual_value", "birthday", NULL, NULL, "created_at", "updated_at" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `workout` ADD `mhr_used` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `heart_rate_recovery_two_minutes` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `avg_mets` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `distance_meters` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `pace_seconds_per_km` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `cadence` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_1_seconds` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_2_seconds` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_3_seconds` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_4_seconds` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_5_seconds` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `hr_time_series` text;
