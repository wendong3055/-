CREATE TABLE `member_app_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`model_id` text NOT NULL,
	`setup_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_app_preferences_owner_model_idx` ON `member_app_preferences` (`owner_id`,`model_id`);