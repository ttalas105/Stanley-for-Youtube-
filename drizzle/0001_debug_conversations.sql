CREATE TABLE `debug_conversations` (
	`owner_id` text NOT NULL,
	`project_id` text NOT NULL,
	`turns_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_id`, `project_id`)
);
