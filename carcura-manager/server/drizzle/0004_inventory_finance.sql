CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`date` text NOT NULL,
	`category` text DEFAULT 'Sonstiges' NOT NULL,
	`description` text NOT NULL,
	`vendor` text,
	`net_cents` integer DEFAULT 0 NOT NULL,
	`vat_bp` integer DEFAULT 1900 NOT NULL,
	`vat_cents` integer DEFAULT 0 NOT NULL,
	`gross_cents` integer DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'transfer' NOT NULL,
	`is_paid` integer DEFAULT true NOT NULL,
	`paid_at` text,
	`due_date` text,
	`recurring_expense_id` text,
	`receipt_file_id` text,
	`notes` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `expenses_company_date_idx` ON `expenses` (`company_id`,`date`);--> statement-breakpoint
CREATE INDEX `expenses_category_idx` ON `expenses` (`company_id`,`category`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_recurring_period_unique` ON `expenses` (`recurring_expense_id`,`date`);--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`manufacturer` text,
	`category` text,
	`unit` text DEFAULT 'Stück' NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`min_quantity` real DEFAULT 0 NOT NULL,
	`purchase_price_cents` integer DEFAULT 0 NOT NULL,
	`supplier` text,
	`location` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inventory_company_idx` ON `inventory_items` (`company_id`,`name`);--> statement-breakpoint
CREATE TABLE `inventory_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`item_id` text NOT NULL,
	`type` text NOT NULL,
	`delta` real NOT NULL,
	`quantity_after` real NOT NULL,
	`unit_cost_cents` integer,
	`reason` text,
	`ref_type` text,
	`ref_id` text,
	`user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inventory_movements_item_idx` ON `inventory_movements` (`item_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `recurring_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'Sonstiges' NOT NULL,
	`vendor` text,
	`net_cents` integer DEFAULT 0 NOT NULL,
	`vat_bp` integer DEFAULT 1900 NOT NULL,
	`interval` text DEFAULT 'monthly' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_date` text NOT NULL,
	`payment_method` text DEFAULT 'transfer' NOT NULL,
	`auto_paid` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recurring_company_idx` ON `recurring_expenses` (`company_id`,`next_date`);