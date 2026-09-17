CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`customer_id` text,
	`vehicle_id` text,
	`order_id` text,
	`user_id` text,
	`type` text DEFAULT 'service' NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`location` text,
	`notes` text,
	`price_cents` integer,
	`reminder_sent_at` text,
	`reminder_error` text,
	`confirmation_sent_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointments_company_time_idx` ON `appointments` (`company_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `appointments_customer_idx` ON `appointments` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE TABLE `email_log` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`to_address` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`message_id` text,
	`ref_type` text,
	`ref_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_log_company_idx` ON `email_log` (`company_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text,
	`config_encrypted` text NOT NULL,
	`public_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'configured' NOT NULL,
	`last_sync_at` text,
	`last_error` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_company_type_unique` ON `integrations` (`company_id`,`type`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`order_id` text NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`description` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`vat_bp` integer DEFAULT 1900 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`order_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`vehicle_id` text,
	`appointment_id` text,
	`user_id` text,
	`lead_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`title` text,
	`notes` text,
	`internal_notes` text,
	`scheduled_at` text,
	`started_at` text,
	`finished_at` text,
	`completed_at` text,
	`mileage_in` integer,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`vat_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`company_id`,`order_number`);--> statement-breakpoint
CREATE INDEX `orders_company_status_idx` ON `orders` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`company_id`,`customer_id`);