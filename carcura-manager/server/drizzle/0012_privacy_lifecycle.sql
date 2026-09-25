CREATE TABLE `ai_usage_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`tools_json` text DEFAULT '[]' NOT NULL,
	`personal_data` integer DEFAULT false NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_company_idx` ON `ai_usage_log` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `data_exports` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`scope` text NOT NULL,
	`subject_ref` text,
	`format_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`storage_path` text,
	`size_bytes` integer,
	`sha256` text,
	`contents_json` text DEFAULT '{}' NOT NULL,
	`error` text,
	`requested_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`completed_at` text,
	`expires_at` text,
	`downloaded_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `data_exports_company_idx` ON `data_exports` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `deletion_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_ref` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`retention_until` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`performed_by_user_id` text,
	`source` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `deletion_log_company_idx` ON `deletion_log` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`occurred_at` text,
	`detected_at` text NOT NULL,
	`affected_tenants_json` text DEFAULT '[]' NOT NULL,
	`personal_data_affected` integer DEFAULT false NOT NULL,
	`description` text,
	`measures` text,
	`authority_notified_at` text,
	`subjects_notified_at` text,
	`tenants_notified_at` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `incidents_company_idx` ON `incidents` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `legal_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_type` text NOT NULL,
	`document_version` text NOT NULL,
	`content_sha256` text NOT NULL,
	`accepted_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `legal_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `legal_acceptances_company_idx` ON `legal_acceptances` (`company_id`,`document_type`);--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`version` text NOT NULL,
	`title` text NOT NULL,
	`content_markdown` text,
	`url` text,
	`content_sha256` text NOT NULL,
	`requires_acceptance` integer DEFAULT false NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`published_at` text NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legal_documents_type_version_unique` ON `legal_documents` (`type`,`version`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`subject_name` text NOT NULL,
	`subject_contact` text,
	`customer_id` text,
	`received_at` text NOT NULL,
	`due_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text,
	`result` text,
	`completed_at` text,
	`handled_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_company_idx` ON `privacy_requests` (`company_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `subprocessors` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`data_categories` text NOT NULL,
	`location` text,
	`third_country` integer DEFAULT false NOT NULL,
	`transfer_mechanism` text,
	`dpa_status` text DEFAULT 'to_review' NOT NULL,
	`dpa_reference` text,
	`activation` text DEFAULT 'optional' NOT NULL,
	`integration_type` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subprocessors_key_unique` ON `subprocessors` (`key`);--> statement-breakpoint
ALTER TABLE `companies` ADD `deletion_scheduled_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `deletion_reason` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `restricted_at` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `restriction_reason` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `retention_until` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `retention_reason` text;