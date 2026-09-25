CREATE TABLE `addons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`feature_keys_json` text DEFAULT '[]' NOT NULL,
	`monthly_price_cents` integer,
	`yearly_price_cents` integer,
	`extra_users` integer DEFAULT 0 NOT NULL,
	`extra_locations` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `addons_code_unique` ON `addons` (`code`);--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`percent_off` integer,
	`amount_off_cents` integer,
	`duration_months` integer,
	`max_redemptions` integer,
	`redemptions` integer DEFAULT 0 NOT NULL,
	`valid_until` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_code_unique` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE TABLE `payment_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_event_id` text NOT NULL,
	`type` text NOT NULL,
	`company_id` text,
	`status` text DEFAULT 'received' NOT NULL,
	`error` text,
	`payload_sha256` text NOT NULL,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_webhook_events_unique` ON `payment_webhook_events` (`provider`,`external_event_id`);--> statement-breakpoint
CREATE TABLE `plan_features` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`feature_key` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_features_unique` ON `plan_features` (`plan_id`,`feature_key`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`monthly_price_cents` integer,
	`yearly_price_cents` integer,
	`setup_fee_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`trial_days` integer DEFAULT 14 NOT NULL,
	`max_users` integer,
	`max_locations` integer,
	`is_public` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_code_unique` ON `plans` (`code`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`subscription_id` text,
	`type` text NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`actor_user_id` text,
	`source` text DEFAULT 'app' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `subscription_events_company_idx` ON `subscription_events` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tenant_addons` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`addon_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`addon_id`) REFERENCES `addons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenant_addons_company_idx` ON `tenant_addons` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `tenant_feature_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`feature_key` text NOT NULL,
	`enabled` integer NOT NULL,
	`reason` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_feature_overrides_unique` ON `tenant_feature_overrides` (`company_id`,`feature_key`);--> statement-breakpoint
CREATE TABLE `tenant_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'trial' NOT NULL,
	`billing_interval` text DEFAULT 'monthly' NOT NULL,
	`start_date` text NOT NULL,
	`trial_start` text,
	`trial_end` text,
	`current_period_start` text,
	`next_billing_date` text,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`cancellation_date` text,
	`cancelled_at` text,
	`cancellation_reason` text,
	`pending_plan_id` text,
	`setup_fee_cents` integer DEFAULT 0 NOT NULL,
	`discount_code_id` text,
	`discount_percent` integer,
	`discount_amount_cents` integer,
	`discount_until` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`payment_provider` text DEFAULT 'manual' NOT NULL,
	`external_customer_id` text,
	`external_subscription_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_subscriptions_company_unique` ON `tenant_subscriptions` (`company_id`);--> statement-breakpoint
CREATE INDEX `tenant_subscriptions_status_idx` ON `tenant_subscriptions` (`status`);