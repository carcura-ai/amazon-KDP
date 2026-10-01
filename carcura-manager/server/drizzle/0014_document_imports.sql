CREATE TABLE `document_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`direction` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`file_id` text,
	`file_name` text NOT NULL,
	`sha256` text NOT NULL,
	`method` text,
	`data_json` text,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`error` text,
	`invoice_id` text,
	`customer_id` text,
	`customer_created` integer DEFAULT false NOT NULL,
	`expense_ids_json` text DEFAULT '[]' NOT NULL,
	`options_json` text DEFAULT '{}' NOT NULL,
	`ai_model` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`processed_at` text,
	`applied_at` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `document_imports_company_idx` ON `document_imports` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `document_imports_sha_idx` ON `document_imports` (`company_id`,`sha256`);--> statement-breakpoint
CREATE INDEX `document_imports_status_idx` ON `document_imports` (`company_id`,`status`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `document_number` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `import_id` text;--> statement-breakpoint
CREATE INDEX `expenses_document_idx` ON `expenses` (`company_id`,`document_number`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `source` text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `import_id` text;