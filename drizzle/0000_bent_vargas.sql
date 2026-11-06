CREATE TABLE `video_configs` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`config` text NOT NULL,
	`credentials` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `video_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`request_id` text NOT NULL,
	`input_hash` text NOT NULL,
	`external_id` text,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`credentials` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`duration` integer NOT NULL,
	`aspect` text NOT NULL,
	`video_url` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_tasks_user_request` ON `video_tasks` (`user_id`,`request_id`);