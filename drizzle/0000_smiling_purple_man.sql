CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '未分类' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`tone` text DEFAULT '' NOT NULL,
	`mime_type` text NOT NULL,
	`object_key` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assets_owner_created_idx` ON `assets` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'waiting_for_sample' NOT NULL,
	`version` text DEFAULT 'v1' NOT NULL,
	`output_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_product_idx` ON `jobs` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`artwork_id` text NOT NULL,
	`artwork_name` text NOT NULL,
	`frame_id` text NOT NULL,
	`frame_name` text NOT NULL,
	`status` text DEFAULT 'sample_pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_owner_created_idx` ON `products` (`owner_id`,`created_at`);