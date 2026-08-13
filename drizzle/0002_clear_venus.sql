CREATE TABLE `import_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`storage_key` varchar(500),
	`project_rows` int NOT NULL DEFAULT 0,
	`exceeded_rows` int NOT NULL DEFAULT 0,
	`equipment_rows` int NOT NULL DEFAULT 0,
	`uploaded_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_runs_id` PRIMARY KEY(`id`)
);
