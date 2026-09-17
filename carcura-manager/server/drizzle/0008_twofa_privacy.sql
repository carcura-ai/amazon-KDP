ALTER TABLE `customers` ADD `anonymized_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret_enc` text;--> statement-breakpoint
ALTER TABLE `users` ADD `totp_enabled_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `backup_codes_json` text;