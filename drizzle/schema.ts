import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ตารางโครงการแผนพัฒนา (รวมบัญชีโครงการทั่วไป และ โครงการเกินศักยภาพ โดยมีฟิลด์ isExceeded แยก)
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  rowNo: int("row_no"),
  codeId: varchar("code_id", { length: 64 }),
  strategy: varchar("strategy", { length: 255 }), // ยุทธศาสตร์
  planName: varchar("plan_name", { length: 255 }), // แผนงาน
  projectName: text("project_name").notNull(), // ชื่อโครงการ
  target: text("target"), // เป้าหมาย
  budget2566: decimal("budget_2566", { precision: 15, scale: 2 }).default("0"),
  budget2567: decimal("budget_2567", { precision: 15, scale: 2 }).default("0"),
  budget2568: decimal("budget_2568", { precision: 15, scale: 2 }).default("0"),
  budget2569: decimal("budget_2569", { precision: 15, scale: 2 }).default("0"),
  budget2570: decimal("budget_2570", { precision: 15, scale: 2 }).default("0"),
  totalBudget: decimal("total_budget", { precision: 15, scale: 2 }).default("0"), // รวม 5 ปี
  department: varchar("department", { length: 255 }), // หน่วยงานรับผิดชอบ
  workType: varchar("work_type", { length: 100 }), // ประเภทงาน (ยศ.5)
  villageNo: varchar("village_no", { length: 100 }), // หมู่ที่ (ยศ.5)
  planBook: varchar("plan_book", { length: 255 }), // เล่มแผนพัฒนาฯ (ใช้ซ่อนและเป็น filter)
  pageNo: varchar("page_no", { length: 50 }), // หน้า
  itemNo: varchar("item_no", { length: 50 }), // ข้อ
  recheck: varchar("recheck", { length: 255 }),
  sourceInfo: varchar("source_info", { length: 255 }), // แหล่งข้อมูล
  oldCodeId: varchar("old_code_id", { length: 64 }), // รหัส ID เดิม
  budgetStatus: varchar("budget_status", { length: 100 }), // สถานะงบประมาณ
  budgetYearReceived: varchar("budget_year_received", { length: 100 }), // ปีงบประมาณที่ได้รับ
  actualBudgetReceived: decimal("actual_budget_received", { precision: 15, scale: 2 }).default("0"), // งบที่ได้รับจริง (บาท)
  actionPlanCount: int("action_plan_count").default(0), // จำนวนครั้งที่ปรากฏในแผนดำเนินงาน
  actionPlanName: text("action_plan_name"), // ชื่อโครงการในแผนดำเนินงาน
  checkPdf: varchar("check_pdf", { length: 255 }),
  isExceeded: int("is_exceeded").default(0).notNull(), // 0 = ปกติ, 1 = โครงการเกินศักยภาพ
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ตารางบัญชีครุภัณฑ์
export const equipment = mysqlTable("equipment", {
  id: int("id").autoincrement().primaryKey(),
  rowNo: int("row_no"),
  codeId: varchar("code_id", { length: 64 }),
  planName: varchar("plan_name", { length: 255 }), // แผนงาน
  equipmentType: varchar("equipment_type", { length: 255 }), // ประเภทครุภัณฑ์
  equipmentName: text("equipment_name").notNull(), // ชื่อครุภัณฑ์
  target: text("target"), // เป้าหมาย
  budget2566: decimal("budget_2566", { precision: 15, scale: 2 }).default("0"),
  budget2567: decimal("budget_2567", { precision: 15, scale: 2 }).default("0"),
  budget2568: decimal("budget_2568", { precision: 15, scale: 2 }).default("0"),
  budget2569: decimal("budget_2569", { precision: 15, scale: 2 }).default("0"),
  budget2570: decimal("budget_2570", { precision: 15, scale: 2 }).default("0"),
  totalBudget: decimal("total_budget", { precision: 15, scale: 2 }).default("0"),
  department: varchar("department", { length: 255 }), // หน่วยงานรับผิดชอบ
  planBook: varchar("plan_book", { length: 255 }), // เล่มแผนพัฒนาฯ
  pageNo: varchar("page_no", { length: 50 }), // หน้า
  itemNo: varchar("item_no", { length: 50 }), // ข้อ
  recheck: varchar("recheck", { length: 255 }),
  sourceInfo: varchar("source_info", { length: 255 }),
  oldCodeId: varchar("old_code_id", { length: 64 }),
  budgetStatus: varchar("budget_status", { length: 100 }), // สถานะงบประมาณ
  budgetYearReceived: varchar("budget_year_received", { length: 100 }),
  actualBudgetReceived: decimal("actual_budget_received", { precision: 15, scale: 2 }).default("0"),
  actionPlanCount: int("action_plan_count").default(0),
  actionPlanName: text("action_plan_name"),
  checkPdf: varchar("check_pdf", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = typeof equipment.$inferInsert;

// ประวัติการนำเข้าไฟล์ Excel เพื่อให้ admin ตรวจสอบการรีเฟรชข้อมูลย้อนหลังได้
export const importRuns = mysqlTable("import_runs", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storageKey: varchar("storage_key", { length: 500 }),
  projectRows: int("project_rows").default(0).notNull(),
  exceededRows: int("exceeded_rows").default(0).notNull(),
  equipmentRows: int("equipment_rows").default(0).notNull(),
  uploadedBy: varchar("uploaded_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ImportRun = typeof importRuns.$inferSelect;
export type InsertImportRun = typeof importRuns.$inferInsert;

// Timeline สถานะและการเบิกจ่ายโครงการ แยกตามปีงบประมาณ 2566-2570
export const projectTimelines = mysqlTable("project_timelines", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("project_id").notNull(),
  fiscalYear: int("fiscal_year").notNull(),
  plannedBudget: decimal("planned_budget", { precision: 15, scale: 2 }).default("0").notNull(),
  approvedBudget: decimal("approved_budget", { precision: 15, scale: 2 }).default("0").notNull(),
  disbursedBudget: decimal("disbursed_budget", { precision: 15, scale: 2 }).default("0").notNull(),
  progressPercent: decimal("progress_percent", { precision: 5, scale: 2 }).default("0").notNull(),
  status: mysqlEnum("status", ["ยังไม่ระบุ", "ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น", "ล่าช้า", "ยกเลิก"]).default("ยังไม่ระบุ").notNull(),
  note: text("note"),
  updatedBy: int("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, table => ({
  projectYearUnique: uniqueIndex("project_timelines_project_year_unique").on(table.projectId, table.fiscalYear),
}));

export type ProjectTimeline = typeof projectTimelines.$inferSelect;
export type InsertProjectTimeline = typeof projectTimelines.$inferInsert;
