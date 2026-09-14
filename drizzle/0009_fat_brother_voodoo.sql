CREATE TABLE `custom_image_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`config_json` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `custom_image_providers_owner_idx` ON `custom_image_providers` (`owner_id`);