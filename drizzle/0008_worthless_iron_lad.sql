CREATE TABLE `production_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`brief` text NOT NULL,
	`spec_json` text DEFAULT 'null' NOT NULL,
	`generation_id` text,
	`review` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `production_item_plan_idx` ON `production_items` (`owner_id`,`plan_id`);--> statement-breakpoint
CREATE TABLE `production_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`plan_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_plan_version_idx` ON `production_plans` (`product_id`,`version`);--> statement-breakpoint
CREATE INDEX `production_plan_owner_idx` ON `production_plans` (`owner_id`,`product_id`);