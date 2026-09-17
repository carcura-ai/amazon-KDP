CREATE TABLE `marketing_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`source` text NOT NULL,
	`date` text NOT NULL,
	`campaign_id` text NOT NULL,
	`campaign_name` text NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`conversions` real DEFAULT 0 NOT NULL,
	`conversion_value_cents` integer DEFAULT 0 NOT NULL,
	`reach` integer,
	`leads` integer,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_daily_unique` ON `marketing_daily` (`company_id`,`source`,`date`,`campaign_id`);--> statement-breakpoint
CREATE INDEX `marketing_daily_date_idx` ON `marketing_daily` (`company_id`,`date`);--> statement-breakpoint
CREATE TABLE `seo_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`date` text NOT NULL,
	`dimension_type` text NOT NULL,
	`dimension_value` text DEFAULT '' NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`position` real,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seo_daily_unique` ON `seo_daily` (`company_id`,`date`,`dimension_type`,`dimension_value`);--> statement-breakpoint
CREATE INDEX `seo_daily_date_idx` ON `seo_daily` (`company_id`,`date`);--> statement-breakpoint
CREATE TABLE `social_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`platform` text NOT NULL,
	`date` text NOT NULL,
	`followers` integer,
	`reach` integer DEFAULT 0 NOT NULL,
	`impressions` integer,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_daily_unique` ON `social_daily` (`company_id`,`platform`,`date`);--> statement-breakpoint
CREATE TABLE `web_analytics_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`date` text NOT NULL,
	`dimension_type` text NOT NULL,
	`dimension_value` text DEFAULT '' NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	`users` integer DEFAULT 0 NOT NULL,
	`pageviews` integer DEFAULT 0 NOT NULL,
	`conversions` real DEFAULT 0 NOT NULL,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `web_daily_unique` ON `web_analytics_daily` (`company_id`,`date`,`dimension_type`,`dimension_value`);--> statement-breakpoint
CREATE INDEX `web_daily_date_idx` ON `web_analytics_daily` (`company_id`,`date`);