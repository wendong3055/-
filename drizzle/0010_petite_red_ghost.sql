CREATE TABLE `rh_creator_keys` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rh_creator_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`endpoint` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`remote_id` text,
	`inputs_json` text NOT NULL,
	`outputs_json` text DEFAULT '[]' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`cost` text DEFAULT '' NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rh_creator_owner_created` ON `rh_creator_tasks` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `rh_creator_owner_active` ON `rh_creator_tasks` (`owner_id`) WHERE "rh_creator_tasks"."status" IN ('uploading','submitting','queued','running','saving','unknown');