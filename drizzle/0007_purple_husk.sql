ALTER TABLE `user` ADD `mhr_formula` text DEFAULT 'fox';--> statement-breakpoint
ALTER TABLE `user` ADD `mhr_manual_value` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `avg_heart_rate` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `min_heart_rate` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `max_heart_rate` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `avg_intensity` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `min_intensity` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `max_intensity` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `active_calories` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `heart_rate_recovery` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `active_score` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_1_minutes` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_2_minutes` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_3_minutes` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_4_minutes` real;--> statement-breakpoint
ALTER TABLE `workout` ADD `zone_5_minutes` real;