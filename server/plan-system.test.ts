import { describe, expect, it } from "vitest";
import { appRouter, equipmentInsert, normalizeDepartment, normalizePlanName, normalizeProjectRow, normalizeVillageNo, normalizeWorkType, projectInsert } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("plan system metadata", () => {
  it("returns the exact required credit and supported budget years", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.meta();
    expect(result.credit).toBe("จัดทำโดย ฝ่ายแผนงานและงบประมาณ กองยุทธศาสตร์และงบประมาณ เทศบาลตำบลหัวทะเล By. เดอะจอร์จ");
    expect(result.years).toEqual(["2566", "2567", "2568", "2569", "2570"]);
  });
});

describe("Excel row processing", () => {
  it("normalizes five-year project budgets and preserves hidden plan metadata internally", () => {
    const result = projectInsert({ 2566: "1,000", 2567: 2000, 2568: "", 2569: null, 2570: 500, "ชื่อโครงการ": "ตัวอย่าง", "เล่มแผนพัฒนาฯ": "เล่มลับ", "หน้า": 10, "ข้อ": 2 }, 1);
    expect(result.totalBudget).toBe("3500");
    expect(result.isExceeded).toBe(1);
    expect(result.planBook).toBe("เล่มลับ");
    expect(result.pageNo).toBe("10");
  });

  it("normalizes equipment budget fields with the same five-year rule", () => {
    const result = equipmentInsert({ 2566: 100, 2567: 200, 2568: 300, 2569: 400, 2570: 500, "ชื่อครุภัณฑ์": "เครื่องมือ" });
    expect(result.totalBudget).toBe("1500");
    expect(result.equipmentName).toBe("เครื่องมือ");
  });
});

describe("public catalog APIs", () => {
  it("returns dashboard counts matching the imported Excel sheets and verified budget statuses", async () => {
    const caller = appRouter.createCaller(createContext());
    const summary = await caller.dashboard.summary();
    expect(summary.counts).toEqual({ projects: 888, exceeded: 55, equipment: 357 });
    const statusNames = summary.byBudgetStatus.map(s => s.name);
    expect(statusNames).toContain("อนุมัติงบประมาณ");
    expect(statusNames).toContain("ยังไม่อนุมัติงบประมาณ");
    expect(summary.byYear).toHaveLength(5);
  });

  it("filters projects and keeps planBook available for the detail dialog", async () => {
    const caller = appRouter.createCaller(createContext());
    const list = await caller.catalog.projects({ strategy: "ด้านโครงสร้างพื้นฐาน", page: 1, pageSize: 5 });
    expect(list.total).toBeGreaterThan(0);
    expect(list.rows.length).toBeLessThanOrEqual(5);
    expect(list.rows[0]).toHaveProperty("planBook");
    const exported = await caller.catalog.exportProjects({ strategy: "ด้านโครงสร้างพื้นฐาน" });
    expect(exported.rows.length).toBe(list.total);
    expect(exported.rows[0]).toHaveProperty("planBook");
  });

  it("returns equipment rows with pagination and keeps planBook available for details", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.catalog.equipment({ page: 1, pageSize: 10 });
    expect(result.total).toBe(357);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0]).toHaveProperty("planBook");
  });

  it("sorts equipment by budget2570 in both directions", async () => {
    const caller = appRouter.createCaller(createContext());
    const asc = await caller.catalog.equipment({ sortBy: "budget2570", sortDir: "asc", page: 1, pageSize: 10 });
    const desc = await caller.catalog.equipment({ sortBy: "budget2570", sortDir: "desc", page: 1, pageSize: 10 });
    const ascValues = asc.rows.map(row => Number(row.budget2570));
    const descValues = desc.rows.map(row => Number(row.budget2570));
    expect(ascValues).toEqual([...ascValues].sort((left, right) => left - right));
    expect(descValues).toEqual([...descValues].sort((left, right) => right - left));
    expect(asc.rows[0]?.budget2570).not.toBeUndefined();
    expect(desc.rows[0]?.budget2570).not.toBeUndefined();
  });
});

describe("admin access control", () => {
  it("rejects data management requests from unauthenticated users", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.admin.importHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects data management requests from regular users", async () => {
    const caller = appRouter.createCaller(createContext({
      id: 2,
      openId: "regular-user",
      email: "user@example.com",
      name: "Regular User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }));
    await expect(caller.admin.importHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("project timeline APIs", () => {
  it("returns five fiscal-year timeline rows and includes planBook for project details", async () => {
    const caller = appRouter.createCaller(createContext());
    const catalog = await caller.catalog.projects({ page: 1, pageSize: 1 });
    const projectId = Number(catalog.rows[0]?.id);
    expect(projectId).toBeGreaterThan(0);
    const result = await caller.tracking.projectTimeline({ projectId });
    expect(result.timeline).toHaveLength(5);
    expect(result.timeline.map(row => row.fiscalYear)).toEqual([2566, 2567, 2568, 2569, 2570]);
    expect(result.project).toHaveProperty("planBook");
    expect(Number(result.timeline[0]?.plannedBudget ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("allows timeline reads but rejects timeline updates for unauthenticated users", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.tracking.upsert({ projectId: 1, fiscalYear: 2566, plannedBudget: 0, approvedBudget: 0, disbursedBudget: 0, progressPercent: 0, status: "ยังไม่ระบุ" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Excel Data Precision & Strategies", () => {
  it("returns exactly 7 distinct strategies and verified budget statuses without arbitrary 'ไม่ระบุ' placeholders", async () => {
    const caller = appRouter.createCaller(createContext());
    const summary = await caller.dashboard.summary();
    expect(summary.options.strategies.length).toBe(7);
    expect(summary.options.budgetStatuses).toContain("อนุมัติงบประมาณ");
    expect(summary.options.budgetStatuses).toContain("ยังไม่อนุมัติงบประมาณ");
    // Ensure no null/undefined or empty string items in strategies and plans
    expect(summary.options.strategies).toEqual([
      "ด้านการศึกษา ศาสนา และวัฒนธรรม",
      "ด้านสังคมและชุมชน",
      "ด้านสาธารณสุขและคุณภาพชีวิต",
      "ด้านเศรษฐกิจและการท่องเที่ยว",
      "ด้านโครงสร้างพื้นฐาน",
      "ด้านทรัพยากรธรรมชาติและสิ่งแวดล้อม",
      "ด้านการเมืองและการบริหาร"
    ]);
    expect(summary.options.departments).toEqual([
      "สำนักปลัดเทศบาล",
      "กองคลัง",
      "กองช่าง",
      "กองสาธารณสุข",
      "กองยุทธศาสตร์และงบประมาณ",
      "กองการศึกษา ศาสนาและวัฒนธรรม",
      "กองสวัสดิการสังคม",
      "สำนักปลัดเทศบาล / กองสวัสดิการสังคม",
      "ทต.หัวทะเล / อบจ.นม."
    ]);
    summary.options.strategies.forEach(s => {
      expect(s).toBeTruthy();
      expect(s).not.toBe("ไม่ระบุ");
    });
    summary.options.plans.forEach(p => {
      expect(p).toBeTruthy();
      expect(p).not.toBe("ไม่ระบุ");
    });
  });
});

describe("Plan Name Completeness", () => {
  it("ensures every single project and equipment item has a valid planName without null or empty values", async () => {
    const { getAllProjects, getAllEquipment } = await import("./db");
    const projects = await getAllProjects();
    const equipment = await getAllEquipment();
    expect(projects.length).toBe(888);
    expect(equipment.length).toBe(357);
    projects.forEach(p => {
      expect(p.planName).toBeTruthy();
      expect(typeof p.planName).toBe("string");
      expect(p.planName.trim().length).toBeGreaterThan(0);
    });
    equipment.forEach(eq => {
      expect(eq.planName).toBeTruthy();
      expect(typeof eq.planName).toBe("string");
      expect(eq.planName.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("filter value normalization", () => {
  it("merges duplicate plan names and keeps distinct plans distinct", () => {
    expect(normalizePlanName("แผนงานสร้างความเข้มแข็งของชุมชน")).toBe("แผนงานสร้างความเข้มแข็งและชุมชน");
    expect(normalizePlanName("แผนงานอุตสาหกรรมและการโยธา")).toBe("แผนงานอุตสาหกรรมและการโยธา");
    expect(normalizePlanName("แผนงานบริหารงานทั่วไป แผนงานรักษาความสงบภายใน")).toBe("หลายแผนงาน");
  });

  it("merges work type review variants into one label", () => {
    expect(normalizeWorkType("ซ่อมแซม ⚠ ตรวจสอบ")).toBe("ซ่อมแซม");
    expect(normalizeWorkType("อื่น ๆ ⚠ ตรวจสอบ")).toBe("อื่น ๆ");
  });

  it("uses the public-sector label normalization and standardizes village values", () => {
    expect(normalizeDepartment("กองการศึกษาฯ")).toBe("กองการศึกษา ศาสนาและวัฒนธรรม");
    expect(normalizeDepartment("กองการศึกษา  /  รร.ทต.หัวทะเล")).toBe("กองการศึกษา ศาสนาและวัฒนธรรม");
    expect(normalizeVillageNo("1")).toBe("หมู่ที่ 1");
    expect(normalizeVillageNo("หมู่ที่ 2")).toBe("หมู่ที่ 2");
    expect(normalizeVillageNo("5, 6, 7")).toBe("หลายหมู่");
  });

  it("normalizes the row fields used by catalog filters", () => {
    const normalized = normalizeProjectRow({ planName: "แผนงานรักษา ความสงบภายใน", workType: "วางท่อ ⚠ ตรวจสอบ", department: "กองการศึกษาฯ", villageNo: "7, 5" });
    expect(normalized).toMatchObject({ planName: "แผนงานรักษาความสงบภายใน", workType: "วางท่อ", department: "กองการศึกษา ศาสนาและวัฒนธรรม", villageNo: "หลายหมู่" });
  });
});
