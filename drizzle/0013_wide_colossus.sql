CREATE TABLE `studio_drafts` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
