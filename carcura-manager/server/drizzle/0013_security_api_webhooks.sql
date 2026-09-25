CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`scopes_json` text DEFAULT '[]' NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`last_used_at` text,
	`last_used_ip` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_company_idx` ON `api_keys` (`company_id`);--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`event` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`last_status_code` integer,
	`last_error` text,
	`delivered_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_due_idx` ON `webhook_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_company_idx` ON `webhook_deliveries` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`url` text NOT NULL,
	`secret_encrypted` text NOT NULL,
	`events_json` text DEFAULT '[]' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`description` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `webhook_endpoints_company_idx` ON `webhook_endpoints` (`company_id`);--> statement-breakpoint
ALTER TABLE `audit_log` ADD `request_id` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `prev_hash` text;--> statement-breakpoint
ALTER TABLE `audit_log` ADD `hash` text;