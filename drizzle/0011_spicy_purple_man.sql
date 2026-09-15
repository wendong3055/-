CREATE TABLE `runninghub_international_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runninghub_international_owner_created` ON `runninghub_international_keys` (`owner_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `generation_tasks` ADD `credential_id` text;