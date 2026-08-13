CREATE TABLE `project_timelines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`fiscal_year` int NOT NULL,
	`planned_budget` decimal(15,2) NOT NULL DEFAULT '0',
	`approved_budget` decimal(15,2) NOT NULL DEFAULT '0',
	`disbursed_budget` decimal(15,2) NOT NULL DEFAULT '0',
	`progress_percent` decimal(5,2) NOT NULL DEFAULT '0',
	`status` enum('ยังไม่ระบุ','ยังไม่เริ่ม','กำลังดำเนินการ','เสร็จสิ้น','ล่าช้า','ยกเลิก') NOT NULL DEFAULT 'ยังไม่ระบุ',
	`note` text,
	`updated_by` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_timelines_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_timelines_project_year_unique` UNIQUE(`project_id`,`fiscal_year`)
);
