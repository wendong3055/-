CREATE TABLE `runninghub_credentials` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`encrypted_key` text NOT NULL,
	`updated_at` integer NOT NULL
);
