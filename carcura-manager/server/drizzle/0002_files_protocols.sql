CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`customer_id` text,
	`vehicle_id` text,
	`order_id` text,
	`protocol_id` text,
	`kind` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_path` text NOT NULL,
	`thumb_path` text,
	`display_path` text,
	`sha256` text,
	`width` integer,
	`height` integer,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`uploaded_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_customer_idx` ON `files` (`company_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `files_vehicle_idx` ON `files` (`company_id`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `files_order_idx` ON `files` (`company_id`,`order_id`);--> statement-breakpoint
CREATE INDEX `files_protocol_idx` ON `files` (`company_id`,`protocol_id`);--> statement-breakpoint
CREATE TABLE `protocol_damages` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`protocol_id` text NOT NULL,
	`area` text NOT NULL,
	`type` text NOT NULL,
	`severity` text DEFAULT 'minor' NOT NULL,
	`description` text,
	`pos_x` integer,
	`pos_y` integer,
	`file_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `protocol_damages_protocol_idx` ON `protocol_damages` (`protocol_id`);--> statement-breakpoint
CREATE TABLE `protocols` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`protocol_number` text NOT NULL,
	`type` text DEFAULT 'intake' NOT NULL,
	`customer_id` text NOT NULL,
	`vehicle_id` text NOT NULL,
	`order_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`mileage` integer,
	`fuel_level` integer,
	`exterior_condition` text,
	`interior_condition` text,
	`checklist_json` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`customer_signature_file_id` text,
	`employee_signature_file_id` text,
	`signed_by_name` text,
	`signed_at` text,
	`pdf_file_id` text,
	`finalized_at` text,
	`created_by_user_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `protocols_number_unique` ON `protocols` (`company_id`,`protocol_number`);--> statement-breakpoint
CREATE INDEX `protocols_vehicle_idx` ON `protocols` (`company_id`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `protocols_customer_idx` ON `protocols` (`company_id`,`customer_id`);