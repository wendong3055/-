CREATE TABLE `hidden_options` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`option_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hidden_options_owner_kind_idx` ON `hidden_options` (`owner_id`,`kind`);