CREATE TABLE `generation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`remote_task_id` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`model` text NOT NULL,
	`prompt` text NOT NULL,
	`aspect_ratio` text NOT NULL,
	`resolution` text NOT NULL,
	`color_name` text NOT NULL,
	`asset_id` text,
	`error` text DEFAULT '' NOT NULL,
	`last_polled_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generation_tasks_owner_created_idx` ON `generation_tasks` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `generation_tasks_owner_active_idx` ON `generation_tasks` (`owner_id`) WHERE "generation_tasks"."status" IN ('uploading','submitting','queued','running','saving','unknown');