CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`customer_id` text,
	`lead_id` text,
	`vehicle_id` text,
	`user_id` text,
	`type` text NOT NULL,
	`direction` text,
	`subject` text,
	`content` text,
	`ref_type` text,
	`ref_id` text,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activities_customer_idx` ON `activities` (`company_id`,`customer_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `activities_lead_idx` ON `activities` (`company_id`,`lead_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`before_json` text,
	`after_json` text,
	`ip` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_company_idx` ON `audit_log` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`legal_name` text,
	`email` text,
	`phone` text,
	`website` text,
	`street` text,
	`zip` text,
	`city` text,
	`country` text DEFAULT 'DE' NOT NULL,
	`tax_number` text,
	`vat_id` text,
	`bank_name` text,
	`iban` text,
	`bic` text,
	`logo_file_id` text,
	`primary_color` text DEFAULT '#E8F320' NOT NULL,
	`secondary_color` text DEFAULT '#0B0B0C' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`locale` text DEFAULT 'de-DE' NOT NULL,
	`timezone` text DEFAULT 'Europe/Berlin' NOT NULL,
	`invoice_prefix` text DEFAULT 'RE' NOT NULL,
	`offer_prefix` text DEFAULT 'AN' NOT NULL,
	`customer_prefix` text DEFAULT 'KD' NOT NULL,
	`default_vat_bp` integer DEFAULT 1900 NOT NULL,
	`small_business` integer DEFAULT false NOT NULL,
	`invoice_footer` text,
	`payment_terms_days` integer DEFAULT 14 NOT NULL,
	`reminder_days_before` integer DEFAULT 2 NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`website_lead_token` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_unique` ON `companies` (`slug`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`customer_number` text NOT NULL,
	`type` text DEFAULT 'private' NOT NULL,
	`salutation` text,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`company_name` text,
	`street` text,
	`house_number` text,
	`zip` text,
	`city` text,
	`country` text DEFAULT 'DE' NOT NULL,
	`email` text,
	`phone` text,
	`phone2` text,
	`notes` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`source` text,
	`lead_id` text,
	`normalized_email` text,
	`normalized_phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_number_unique` ON `customers` (`company_id`,`customer_number`);--> statement-breakpoint
CREATE INDEX `customers_company_idx` ON `customers` (`company_id`);--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`company_id`,`normalized_email`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`company_id`,`normalized_phone`);--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`company_id`,`last_name`,`first_name`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text,
	`type` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`run_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`last_error` text,
	`started_at` text,
	`finished_at` text,
	`dedupe_key` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`,`run_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_dedupe_unique` ON `jobs` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`company_name` text,
	`customer_type` text DEFAULT 'private' NOT NULL,
	`email` text,
	`phone` text,
	`street` text,
	`zip` text,
	`city` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_detail` text,
	`gclid` text,
	`fbclid` text,
	`campaign` text,
	`status` text DEFAULT 'new' NOT NULL,
	`requested_service` text,
	`vehicle_text` text,
	`message` text,
	`notes` text,
	`estimated_value_cents` integer,
	`assigned_user_id` text,
	`customer_id` text,
	`lost_reason` text,
	`external_id` text,
	`normalized_email` text,
	`normalized_phone` text,
	`last_contact_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leads_company_status_idx` ON `leads` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`company_id`,`normalized_email`);--> statement-breakpoint
CREATE INDEX `leads_phone_idx` ON `leads` (`company_id`,`normalized_phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `leads_external_unique` ON `leads` (`company_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `number_sequences` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kind` text NOT NULL,
	`year` integer DEFAULT 0 NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `number_sequences_unique` ON `number_sequences` (`company_id`,`kind`,`year`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`role` text NOT NULL,
	`permission` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `role_permissions_unique` ON `role_permissions` (`company_id`,`role`,`permission`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`vat_bp` integer DEFAULT 1900 NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`material_cost_cents` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `services_company_idx` ON `services` (`company_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_platform_admin` integer DEFAULT false NOT NULL,
	`last_login_at` text,
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_company_idx` ON `users` (`company_id`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`license_plate` text,
	`normalized_plate` text,
	`make` text,
	`model` text,
	`year` integer,
	`mileage` integer,
	`color` text,
	`vehicle_type` text,
	`vin` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vehicles_customer_idx` ON `vehicles` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `vehicles_plate_idx` ON `vehicles` (`company_id`,`normalized_plate`);