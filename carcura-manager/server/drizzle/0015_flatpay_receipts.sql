CREATE TABLE `flatpay_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`report_reference` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`fee_cents` integer NOT NULL,
	`net_cents` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flatpay_payout_reference` ON `flatpay_payouts` (`company_id`,`report_reference`);--> statement-breakpoint
CREATE TABLE `flatpay_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`sha256` text NOT NULL,
	`caption` text NOT NULL,
	`amount_cents` integer,
	`paid_on` text,
	`order_id` text,
	`candidate_order_id` text,
	`service` text,
	`invoice_id` text,
	`reference` text,
	`lexware_state` text DEFAULT 'pending' NOT NULL,
	`lexware_id` text,
	`lexware_file_id` text,
	`payout_id` text,
	FOREIGN KEY (`id`) REFERENCES `document_imports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flatpay_receipt_hash` ON `flatpay_receipts` (`company_id`,`sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `flatpay_receipt_order` ON `flatpay_receipts` (`company_id`,`order_id`);