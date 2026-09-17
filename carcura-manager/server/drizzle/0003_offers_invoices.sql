CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`description` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`vat_bp` integer DEFAULT 1900 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`invoice_number` text,
	`customer_id` text NOT NULL,
	`vehicle_id` text,
	`order_id` text,
	`offer_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text,
	`intro_text` text,
	`notes` text,
	`issue_date` text,
	`service_date` text,
	`due_date` text,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`vat_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`paid_cents` integer DEFAULT 0 NOT NULL,
	`paid_at` text,
	`sent_at` text,
	`issued_at` text,
	`pdf_file_id` text,
	`cancels_invoice_id` text,
	`cancelled_by_invoice_id` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`company_id`,`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_customer_idx` ON `invoices` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `invoices_issue_idx` ON `invoices` (`company_id`,`issue_date`);--> statement-breakpoint
CREATE TABLE `offer_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`description` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`vat_bp` integer DEFAULT 1900 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `offer_items_offer_idx` ON `offer_items` (`offer_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`offer_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`vehicle_id` text,
	`lead_id` text,
	`order_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text,
	`intro_text` text,
	`notes` text,
	`issue_date` text NOT NULL,
	`valid_until` text,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`vat_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`sent_at` text,
	`accepted_at` text,
	`pdf_file_id` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_number_unique` ON `offers` (`company_id`,`offer_number`);--> statement-breakpoint
CREATE INDEX `offers_customer_idx` ON `offers` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `offers_status_idx` ON `offers` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` text NOT NULL,
	`method` text DEFAULT 'transfer' NOT NULL,
	`note` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `payments_company_date_idx` ON `payments` (`company_id`,`paid_at`);