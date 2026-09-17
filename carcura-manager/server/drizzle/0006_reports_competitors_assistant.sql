CREATE TABLE `assistant_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tools_used_json` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_conv_idx` ON `assistant_messages` (`company_id`,`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `competitor_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`date` text NOT NULL,
	`rating` real,
	`rating_count` integer,
	`business_status` text,
	`price_level` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitor_snapshots_unique` ON `competitor_snapshots` (`competitor_id`,`date`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`place_id` text,
	`name` text NOT NULL,
	`address` text,
	`website` text,
	`phone` text,
	`lat` real,
	`lng` real,
	`source` text DEFAULT 'manual' NOT NULL,
	`is_own` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`first_seen_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_seen_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_place_unique` ON `competitors` (`company_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `competitors_company_idx` ON `competitors` (`company_id`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`content_json` text NOT NULL,
	`pdf_file_id` text,
	`sent_to` text,
	`generated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reports_company_idx` ON `reports` (`company_id`,`type`,`period_start`);