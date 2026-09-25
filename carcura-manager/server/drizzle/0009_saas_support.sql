CREATE TABLE `support_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`requested_by_user_id` text,
	`reason` text NOT NULL,
	`mode` text DEFAULT 'read' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`break_glass` integer DEFAULT false NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`approved_by_user_id` text,
	`approved_at` text,
	`expires_at` text,
	`first_used_at` text,
	`ended_at` text,
	`ended_reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `support_sessions_company_idx` ON `support_sessions` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD `support_session_id` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `support_session_id` text;