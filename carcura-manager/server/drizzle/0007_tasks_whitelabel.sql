CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_at` text,
	`assigned_user_id` text,
	`customer_id` text,
	`lead_id` text,
	`vehicle_id` text,
	`order_id` text,
	`created_by_user_id` text,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_company_status_idx` ON `tasks` (`company_id`,`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `tasks_customer_idx` ON `tasks` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `tasks_lead_idx` ON `tasks` (`company_id`,`lead_id`);--> statement-breakpoint
ALTER TABLE `companies` ADD `product_name` text DEFAULT 'Manager' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `powered_by` text;