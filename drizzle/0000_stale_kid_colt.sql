CREATE TABLE `creator_memories` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`facts_json` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_memories` (
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`facts_json` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `project_id`)
);
