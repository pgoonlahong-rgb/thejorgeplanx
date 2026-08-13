import { TRPCError } from "@trpc/server";
import { z } from "zod";
import xlsx from "xlsx";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getAllEquipment, getAllProjects, getAllProjectTimelines, getDb, getProjectTimeline, getRecentImportRuns, upsertProjectTimeline } from "./db";
import { equipment, importRuns, projectTimelines, projects } from "../drizzle/schema";
import { storagePut } from "./storage";

const YEARS = [2566, 2567, 2568, 2569, 2570] as const;
const CREDIT = "จัดทำโดย ฝ่ายแผนงานและงบประมาณ กองยุทธศาสตร์และงบประมาณ เทศบาลตำบลหัวทะเล By. เดอะจอร์จ";
const TIMELINE_STATUSES = ["ยังไม่ระบุ", "ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น", "ล่าช้า", "ยกเลิก"] as const;

const CANONICAL_STRATEGIES = [
  "ด้านการศึกษา ศาสนา และวัฒนธรรม",
  "ด้านสังคมและชุมชน",
  "ด้านสาธารณสุขและคุณภาพชีวิต",
  "ด้านเศรษฐกิจและการท่องเที่ยว",
  "ด้านโครงสร้างพื้นฐาน",
  "ด้านทรัพยากรธรรมชาติและสิ่งแวดล้อม",
  "ด้านการเมือง การบริหาร"
] as const;

const CANONICAL_DEPARTMENTS = [
  "สำนักปลัดเทศบาล",
  "กองคลัง",
  "กองช่าง",
  "กองสาธารณสุข",
  "กองยุทธศาสตร์และงบประมาณ",
  "กองการศึกษา ศาสนาและวัฒนธรรม",
  "กองสวัสดิการสังคม",
  "สำนักปลัดเทศบาล / กองสวัสดิการสังคม",
  "ทต.หัวทะเล / อบจ.นม."
] as const;

const CANONICAL_PLANS = [
  "แผนงานบริหารงานทั่วไป",
  "แผนงานรักษาความสงบภายใน",
  "แผนงานการศึกษา",
  "แผนงานสาธารณสุข",
  "แผนงานสังคมสงเคราะห์",
  "แผนงานเคหะและชุมชน",
  "แผนงานสร้างความเข้มแข็งและชุมชน",
  "แผนงานการศาสนาวัฒนธรรมและนันทนาการ",
  "แผนงานอุตสาหกรรมและการโยธา",
  "แผนงานการเกษตร",
  "แผนงานการพานิชย์",
  "งบกลาง"
] as const;

const CANONICAL_EQUIPMENT_TYPES = [
  "ครุภัณฑ์สำนักงาน",
  "ครุภัณฑ์การศึกษา",
  "ครุภัณฑ์ยานพาหนะและขนส่ง",
  "ครุภัณฑ์การเกษตร",
  "ครุภัณฑ์ก่อสร้าง",
  "ครุภัณฑ์งานบ้านงานครัว",
  "ครุภัณฑ์ไฟฟ้าและวิทยุ",
  "ครุภัณฑ์โฆษณาและเผยแพร่",
  "ครุภัณฑ์วิทยาศาสตร์หรือการแพทย์",
  "ครุภัณฑ์งานโรงงาน",
  "ครุภัณฑ์กีฬา",
  "ครุภัณฑ์สำรวจ",
  "ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์",
  "ครุภัณฑ์อื่น"
] as const;

type AnyRecord = Record<string, any>;

function numeric(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function budgetTotal(row: AnyRecord) {
  return YEARS.reduce((sum, year) => sum + numeric(row[`budget${year}`]), 0);
}

function groupBy<T>(rows: T[], key: (row: T) => string | null | undefined, isStrategyKey = false, isDepartmentKey = false, isPlanKey = false, isEquipmentTypeKey = false) {
  const map = new Map<string, { name: string; count: number; budget: number }>();
  for (const row of rows) {
    const name = key(row)?.trim();
    if (!name || name === "ไม่ระบุ") continue;
    const current = map.get(name) ?? { name, count: 0, budget: 0 };
    current.count += 1;
    current.budget += budgetTotal(row as AnyRecord);
    map.set(name, current);
  }
  const items = Array.from(map.values());
  if (isStrategyKey) {
    return items.sort((a, b) => {
      const idxA = CANONICAL_STRATEGIES.indexOf(a.name as any);
      const idxB = CANONICAL_STRATEGIES.indexOf(b.name as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "th");
    });
  }
  if (isDepartmentKey) {
    return items.sort((a, b) => {
      const idxA = CANONICAL_DEPARTMENTS.indexOf(a.name as any);
      const idxB = CANONICAL_DEPARTMENTS.indexOf(b.name as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "th");
    });
  }
  if (isPlanKey) {
    return items.sort((a, b) => {
      const idxA = CANONICAL_PLANS.indexOf(a.name as any);
      const idxB = CANONICAL_PLANS.indexOf(b.name as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "th");
    });
  }
  if (isEquipmentTypeKey) {
    return items.sort((a, b) => {
      const idxA = CANONICAL_EQUIPMENT_TYPES.indexOf(a.name as any);
      const idxB = CANONICAL_EQUIPMENT_TYPES.indexOf(b.name as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name, "th");
    });
  }
  return items.sort((a, b) => b.budget - a.budget);
}

function optionsFrom<T>(rows: T[], key: (row: T) => string | null | undefined, isStrategyKey = false, isDepartmentKey = false, isPlanKey = false, isEquipmentTypeKey = false, isPlanBookKey = false) {
  const rawList = Array.from(new Set(rows.map(key).filter((value): value is string => Boolean(value && value.trim())).map(value => value.trim())));
  if (isPlanBookKey) {
    return rawList.sort((a, b) => {
      // Parse book format like "เล่มที่ 1 (พ.ศ. 2566)" or "เพิ่มเติม 1/2567" or numbers
      const parseBookInfo = (str: string) => {
        const yearMatch = str.match(/(25\d\d)/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
        const numMatch = str.match(/(\d+)/);
        const num = numMatch ? parseInt(numMatch[1], 10) : 0;
        return { year, num };
      };
      const infoA = parseBookInfo(a);
      const infoB = parseBookInfo(b);
      if (infoA.year !== infoB.year) return infoA.year - infoB.year;
      return infoA.num - infoB.num;
    });
  }
  if (isStrategyKey) {
    return rawList.sort((a, b) => {
      const idxA = CANONICAL_STRATEGIES.indexOf(a as any);
      const idxB = CANONICAL_STRATEGIES.indexOf(b as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "th");
    });
  }
  if (isDepartmentKey) {
    return rawList.sort((a, b) => {
      const idxA = CANONICAL_DEPARTMENTS.indexOf(a as any);
      const idxB = CANONICAL_DEPARTMENTS.indexOf(b as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "th");
    });
  }
  if (isPlanKey) {
    return rawList.sort((a, b) => {
      const idxA = CANONICAL_PLANS.indexOf(a as any);
      const idxB = CANONICAL_PLANS.indexOf(b as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "th");
    });
  }
  if (isEquipmentTypeKey) {
    return rawList.sort((a, b) => {
      const idxA = CANONICAL_EQUIPMENT_TYPES.indexOf(a as any);
      const idxB = CANONICAL_EQUIPMENT_TYPES.indexOf(b as any);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, "th");
    });
  }
  return rawList.sort((a, b) => a.localeCompare(b, "th"));
}

const timelineInput = z.object({
  projectId: z.number().int().positive(),
  fiscalYear: z.number().int().refine(year => YEARS.includes(year as (typeof YEARS)[number]), "ปีงบประมาณต้องอยู่ระหว่าง 2566-2570"),
  plannedBudget: z.coerce.number().min(0).default(0),
  approvedBudget: z.coerce.number().min(0).default(0),
  disbursedBudget: z.coerce.number().min(0).default(0),
  progressPercent: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(TIMELINE_STATUSES).default("ยังไม่ระบุ"),
  note: z.string().max(2000).optional().nullable(),
});

const filterInput = z.object({
  search: z.string().optional().default(""),
  strategy: z.string().optional().default("all"),
  planName: z.string().optional().default("all"),
  department: z.string().optional().default("all"),
  villageNo: z.string().optional().default("all"),
  workType: z.string().optional().default("all"),
  budgetStatus: z.string().optional().default("all"),
  budgetYear: z.string().optional().default("all"),
  planBook: z.string().optional().default("all"),
  pageNo: z.string().optional().default(""),
  itemNo: z.string().optional().default(""),
  equipmentType: z.string().optional().default("all"),
  exceededOnly: z.boolean().optional().default(false),
  sortBy: z.enum(["projectName", "equipmentName", "totalBudget", "budget2566", "budget2570", "department"]).optional().default("projectName"),
  sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

function matchesFilter(row: AnyRecord, input: z.infer<typeof filterInput>) {
  const query = input.search.trim().toLocaleLowerCase();
  const searchable = [row.projectName, row.codeId, row.target, row.department, row.strategy, row.planName, row.villageNo].filter(Boolean).join(" ").toLocaleLowerCase();
  if (query && !searchable.includes(query)) return false;
  if (input.strategy !== "all" && row.strategy !== input.strategy) return false;
  if (input.planName !== "all" && row.planName !== input.planName) return false;
  if (input.department !== "all" && row.department !== input.department) return false;
  if (input.villageNo !== "all" && row.villageNo !== input.villageNo) return false;
  if (input.workType !== "all" && row.workType !== input.workType) return false;
  if (input.budgetStatus !== "all" && row.budgetStatus !== input.budgetStatus) return false;
  if (input.planBook !== "all" && row.planBook !== input.planBook) return false;
  if (input.pageNo && !String(row.pageNo ?? "").toLocaleLowerCase().includes(input.pageNo.trim().toLocaleLowerCase())) return false;
  if (input.itemNo && !String(row.itemNo ?? "").toLocaleLowerCase().includes(input.itemNo.trim().toLocaleLowerCase())) return false;
  if (input.equipmentType !== "all" && row.equipmentType !== input.equipmentType) return false;
  if (input.exceededOnly && !row.isExceeded) return false;
  if (input.budgetYear !== "all") {
    const yearKey = `budget${input.budgetYear}`;
    if (numeric(row[yearKey]) <= 0) return false;
  }
  return true;
}

export function visibleProject(row: AnyRecord) {
  // planBook is returned for the detail dialog; the table/export column lists intentionally omit it.
  return { ...row };
}

export function visibleEquipment(row: AnyRecord) {
  // Keep the same contract for equipment details while table/export columns remain curated in the UI.
  return { ...row };
}

function sortRows(rows: AnyRecord[], sortBy: string, sortDir: string) {
  const factor = sortDir === "desc" ? -1 : 1;
  return rows.sort((left, right) => {
    const leftValue = sortBy === "projectName" ? (left.projectName ?? left.equipmentName ?? "") : sortBy === "equipmentName" ? (left.equipmentName ?? left.projectName ?? "") : left[sortBy];
    const rightValue = sortBy === "projectName" ? (right.projectName ?? right.equipmentName ?? "") : sortBy === "equipmentName" ? (right.equipmentName ?? right.projectName ?? "") : right[sortBy];
    if (sortBy === "totalBudget" || sortBy.startsWith("budget")) return (numeric(leftValue) - numeric(rightValue)) * factor;
    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), "th", { numeric: true }) * factor;
  });
}

function cleanNum(value: any) {
  if (value === undefined || value === null || value === "" || Number.isNaN(value)) return "0";
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed.toString() : "0";
}

function cleanInt(value: any) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? Math.floor(parsed) : 0;
}

function cleanStr(value: any) {
  if (value === undefined || value === null) return null;
  const valueString = String(value).trim();
  return valueString && valueString.toLowerCase() !== "nan" ? valueString : null;
}

function collapseSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizePlanName(value: unknown) {
  const raw = cleanStr(value);
  if (!raw) return null;
  const text = collapseSpaces(raw);
  if (text.includes(" แผนงาน")) return "หลายแผนงาน";
  if (text.includes("บริหาร") || text.includes("บริหารทั่วไป")) return "แผนงานบริหารงานทั่วไป";
  if (text.includes("สงบ") || text.includes("รักษาความสงบ")) return "แผนงานรักษาความสงบภายใน";
  if (text.includes("การศึกษา") && !text.includes("ศาสนา")) return "แผนงานการศึกษา";
  if (text.includes("สาธารณสุข")) return "แผนงานสาธารณสุข";
  if (text.includes("สังคมสงเคราะห์")) return "แผนงานสังคมสงเคราะห์";
  if (text.includes("เคหะ") || text.includes("ชุมชน")) {
    if (text.includes("เข้มแข็ง")) return "แผนงานสร้างความเข้มแข็งและชุมชน";
    return "แผนงานเคหะและชุมชน";
  }
  if (text.includes("ศาสนา") || text.includes("วัฒนธรรม") || text.includes("นันทนาการ")) return "แผนงานการศาสนาวัฒนธรรมและนันทนาการ";
  if (text.includes("อุตสาหกรรม") || text.includes("โยธา")) return "แผนงานอุตสาหกรรมและการโยธา";
  if (text.includes("เกษตร")) return "แผนงานการเกษตร";
  if (text.includes("พานิชย์") || text.includes("พาณิชย์")) return "แผนงานการพานิชย์";
  if (text.includes("งบกลาง")) return "งบกลาง";
  return text;
}

export function normalizeEquipmentType(value: unknown) {
  const raw = cleanStr(value);
  if (!raw) return "ครุภัณฑ์อื่น";
  const text = collapseSpaces(raw);
  for (const t of CANONICAL_EQUIPMENT_TYPES) {
    if (text.includes(t) || t.includes(text)) return t;
  }
  if (text.includes("สำนักงาน")) return "ครุภัณฑ์สำนักงาน";
  if (text.includes("การศึกษา")) return "ครุภัณฑ์การศึกษา";
  if (text.includes("ยานพาหนะ") || text.includes("ขนส่ง")) return "ครุภัณฑ์ยานพาหนะและขนส่ง";
  if (text.includes("การเกษตร")) return "ครุภัณฑ์การเกษตร";
  if (text.includes("ก่อสร้าง")) return "ครุภัณฑ์ก่อสร้าง";
  if (text.includes("บ้าน") || text.includes("ครัว")) return "ครุภัณฑ์งานบ้านงานครัว";
  if (text.includes("ไฟฟ้า") || text.includes("วิทยุ")) return "ครุภัณฑ์ไฟฟ้าและวิทยุ";
  if (text.includes("โฆษณา") || text.includes("เผยแพร่")) return "ครุภัณฑ์โฆษณาและเผยแพร่";
  if (text.includes("วิทยาศาสตร์") || text.includes("การแพทย์")) return "ครุภัณฑ์วิทยาศาสตร์หรือการแพทย์";
  if (text.includes("โรงงาน")) return "ครุภัณฑ์งานโรงงาน";
  if (text.includes("กีฬา")) return "ครุภัณฑ์กีฬา";
  if (text.includes("สำรวจ")) return "ครุภัณฑ์สำรวจ";
  if (text.includes("คอมพิวเตอร์") || text.includes("อิเล็กทรอนิกส์")) return "ครุภัณฑ์คอมพิวเตอร์หรืออิเล็กทรอนิกส์";
  return "ครุภัณฑ์อื่น";
}

export function normalizeWorkType(value: unknown) {
  const raw = cleanStr(value);
  if (!raw) return null;
  const text = collapseSpaces(raw.replace(/\s*⚠\s*ตรวจสอบ\s*$/, ""));
  return text || "อื่น ๆ";
}

export function normalizeDepartment(value: unknown) {
  const raw = cleanStr(value);
  if (!raw) return null;
  const text = collapseSpaces(raw);
  if (text.includes("กองการศึกษา") || text.includes("โรงเรียนเทศบาลตำบลหัวทะเล") || text.includes("รร.ทต.หัวทะเล") || text.includes("ศพด")) {
    return "กองการศึกษา ศาสนาและวัฒนธรรม";
  }
  if (text.includes("สำนักปลัด") && text.includes("กองสวัสดิการ")) return "สำนักปลัดเทศบาล / กองสวัสดิการสังคม";
  if (text.includes("สำนักปลัด")) return "สำนักปลัดเทศบาล";
  if (text.includes("กองคลัง")) return "กองคลัง";
  if (text.includes("กองช่าง")) return "กองช่าง";
  if (text.includes("กองสาธารณสุข")) return "กองสาธารณสุข";
  if (text.includes("กองยุทธศาสตร์")) return "กองยุทธศาสตร์และงบประมาณ";
  if (text.includes("กองสวัสดิการ")) return "กองสวัสดิการสังคม";
  return text.split("/").map(part => collapseSpaces(part)).join(" / ");
}

export function normalizeVillageNo(value: unknown) {
  const raw = cleanStr(value);
  if (!raw) return null;
  const text = collapseSpaces(raw);
  if (text.includes("ภาพรวม") || text.includes("ตรวจสอบ") || text.includes("⚠")) return null;
  const numbers = text.match(/\d+/g) ?? [];
  if (numbers.length > 1 || /[,/]/.test(text)) return "หลายหมู่";
  if (numbers.length === 1) return `หมู่ที่ ${Number(numbers[0])}`;
  return null;
}

export function normalizeProjectRow(row: AnyRecord): AnyRecord {
  return { ...row, planName: normalizePlanName(row.planName), workType: normalizeWorkType(row.workType), department: normalizeDepartment(row.department), villageNo: normalizeVillageNo(row.villageNo) };
}

export function normalizeEquipmentRow(row: AnyRecord): AnyRecord {
  return { ...row, planName: normalizePlanName(row.planName), equipmentType: normalizeEquipmentType(row.equipmentType), department: normalizeDepartment(row.department) };
}

function readSheet(workbook: xlsx.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new TRPCError({ code: "BAD_REQUEST", message: `ไม่พบชีท ${name} ในไฟล์ Excel` });
  const rows = xlsx.utils.sheet_to_json<AnyRecord>(sheet);
  let lastStrategy = "";
  let lastPlan = "";
  let lastEquipmentType = "";
  let lastDepartment = "";
  return rows.map(row => {
    if (row["ยุทธศาสตร์"]) {
      lastStrategy = String(row["ยุทธศาสตร์"]).trim();
    } else if (lastStrategy) {
      row["ยุทธศาสตร์"] = lastStrategy;
    }
    if (row["แผนงาน"]) {
      lastPlan = String(row["แผนงาน"]).trim();
    } else if (lastPlan) {
      row["แผนงาน"] = lastPlan;
    }
    if (row["ประเภทครุภัณฑ์"]) {
      lastEquipmentType = String(row["ประเภทครุภัณฑ์"]).trim();
    } else if (lastEquipmentType) {
      row["ประเภทครุภัณฑ์"] = lastEquipmentType;
    }
    if (row["หน่วยงานรับผิดชอบ"]) {
      lastDepartment = String(row["หน่วยงานรับผิดชอบ"]).trim();
    } else if (lastDepartment) {
      row["หน่วยงานรับผิดชอบ"] = lastDepartment;
    }
    return row;
  });
}

export function cleanBudgetStatus(value: any) {
  const raw = cleanStr(value);
  if (!raw) return "ยังไม่อนุมัติงบประมาณ";
  if (raw.includes("อนุมัติ")) return "อนุมัติงบประมาณ";
  return "ยังไม่อนุมัติงบประมาณ";
}

export function projectInsert(row: AnyRecord, isExceeded: number) {
  const budget2566 = cleanNum(row[2566]);
  const budget2567 = cleanNum(row[2567]);
  const budget2568 = cleanNum(row[2568]);
  const budget2569 = cleanNum(row[2569]);
  const budget2570 = cleanNum(row[2570]);
  const totalBudget = [budget2566, budget2567, budget2568, budget2569, budget2570].reduce((sum, value) => sum + Number(value), 0).toString();
  const rawStatus = cleanStr(row["สถานะงบประมาณ"]);
  const budgetStatus = cleanBudgetStatus(rawStatus);
  return {
    rowNo: cleanInt(row["ลำดับที่"]), codeId: cleanStr(row["รหัส ID"]), strategy: cleanStr(row["ยุทธศาสตร์"]), planName: normalizePlanName(row["แผนงาน"]), projectName: String(row["ชื่อโครงการ"] ?? "ไม่ระบุชื่อโครงการ"), target: cleanStr(row["เป้าหมาย (ผลผลิตของโครงการ)"]),
    budget2566, budget2567, budget2568, budget2569, budget2570, totalBudget,
    department: normalizeDepartment(row["หน่วยงานรับผิดชอบ"]), workType: normalizeWorkType(row["ประเภทงาน (ยศ.5"] ?? row["ประเภทงาน (ยศ.5)"]), villageNo: normalizeVillageNo(row["หมู่ที่ (ยศ.5)"]), planBook: cleanStr(row["เล่มแผนพัฒนาฯ"]), pageNo: cleanStr(row["หน้า"]), itemNo: cleanStr(row["ข้อ"]), recheck: cleanStr(row["ตรวจซ้ำ"]), sourceInfo: cleanStr(row["แหล่งข้อมูล"]), oldCodeId: cleanStr(row["รหัส ID เดิม"]), budgetStatus, budgetYearReceived: cleanStr(row["ปีงบประมาณที่ได้รับ"]), actualBudgetReceived: cleanNum(row["งบที่ได้รับจริง (บาท)"]), actionPlanCount: cleanInt(row["จำนวนครั้งที่ปรากฏในแผนดำเนินงาน"]), actionPlanName: cleanStr(row["ชื่อโครงการในแผนดำเนินงาน"]), checkPdf: cleanStr(row["ตรวจกับ PDF"]), isExceeded,
  };
}

export function equipmentInsert(row: AnyRecord) {
  const budget2566 = cleanNum(row[2566]);
  const budget2567 = cleanNum(row[2567]);
  const budget2568 = cleanNum(row[2568]);
  const budget2569 = cleanNum(row[2569]);
  const budget2570 = cleanNum(row[2570]);
  const totalBudget = [budget2566, budget2567, budget2568, budget2569, budget2570].reduce((sum, value) => sum + Number(value), 0).toString();
  const rawStatus = cleanStr(row["สถานะงบประมาณ"]);
  const budgetStatus = cleanBudgetStatus(rawStatus);
  return {
    rowNo: cleanInt(row["ลำดับที่"]), codeId: cleanStr(row["รหัส ID"]), planName: normalizePlanName(row["แผนงาน"]), equipmentType: normalizeEquipmentType(row["ประเภทครุภัณฑ์"]), equipmentName: String(row["ชื่อครุภัณฑ์"] ?? "ไม่ระบุชื่อครุภัณฑ์"), target: cleanStr(row["เป้าหมาย (ผลผลิตของครุภัณฑ์)"]),
    budget2566, budget2567, budget2568, budget2569, budget2570, totalBudget,
    department: normalizeDepartment(row["หน่วยงานรับผิดชอบ"]), planBook: cleanStr(row["เล่มแผนพัฒนาฯ"]), pageNo: cleanStr(row["หน้า"]), itemNo: cleanStr(row["ข้อ"]), recheck: cleanStr(row["ตรวจซ้ำ"]), sourceInfo: cleanStr(row["แหล่งข้อมูล"]), oldCodeId: cleanStr(row["รหัส ID เดิม"]), budgetStatus, budgetYearReceived: cleanStr(row["ปีงบประมาณที่ได้รับ"]), actualBudgetReceived: cleanNum(row["งบที่ได้รับจริง (บาท)"]), actionPlanCount: cleanInt(row["จำนวนครั้งที่ปรากฏในแผนดำเนินงาน"]), actionPlanName: cleanStr(row["ชื่อโครงการในแผนดำเนินงาน"]), checkPdf: cleanStr(row["ตรวจกับ PDF"]),
  };
}

export const appRouter = router({
  system: systemRouter,
  meta: publicProcedure.query(() => ({ credit: CREDIT, years: YEARS.map(String) })),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dashboard: router({
    summary: publicProcedure.query(async () => {
      const [rawProjectRows, rawEquipmentRows, recentImports, timelineRows] = await Promise.all([getAllProjects(), getAllEquipment(), getRecentImportRuns(1), getAllProjectTimelines()]);
      const projectRows = rawProjectRows.map(normalizeProjectRow);
      const equipmentRows = rawEquipmentRows.map(normalizeEquipmentRow);
      const projectBudget = projectRows.reduce((sum, row) => sum + numeric(row.totalBudget), 0);
      const equipmentBudget = equipmentRows.reduce((sum, row) => sum + numeric(row.totalBudget), 0);
      const planBudgetByYear = YEARS.map(year => ({ year: String(year), budget: projectRows.reduce((sum, row) => sum + numeric(row[`budget${year}`]), 0) }));
      const trackedProjectIds = new Set(timelineRows.map(row => row.projectId));
      const trackingApproved = timelineRows.reduce((sum, row) => sum + numeric(row.approvedBudget), 0);
      const trackingDisbursed = timelineRows.reduce((sum, row) => sum + numeric(row.disbursedBudget), 0);
      const trackingStatuses = Array.from(new Set(timelineRows.map(row => row.status))).map(status => ({ name: status, count: timelineRows.filter(row => row.status === status).length }));
      return {
        credit: CREDIT,
        counts: { projects: projectRows.length, exceeded: projectRows.filter(row => row.isExceeded === 1).length, equipment: equipmentRows.length },
        budgets: { projects: projectBudget, equipment: equipmentBudget, total: projectBudget + equipmentBudget },
        byStrategy: groupBy(projectRows, row => row.strategy, true),
        byDepartment: groupBy(projectRows, row => row.department, false, true, false, false),
        byPlan: groupBy(projectRows, row => row.planName, false, false, true, false),
        byYear: planBudgetByYear,
        byBudgetStatus: groupBy(projectRows, row => row.budgetStatus),
        equipmentByType: groupBy(equipmentRows, row => row.equipmentType, false, false, false, true),
        tracking: { trackedProjects: trackedProjectIds.size, timelineRows: timelineRows.length, approvedBudget: trackingApproved, disbursedBudget: trackingDisbursed, averageProgress: timelineRows.length ? timelineRows.reduce((sum, row) => sum + numeric(row.progressPercent), 0) / timelineRows.length : 0, statuses: trackingStatuses },
        options: {
          strategies: optionsFrom(projectRows, row => row.strategy, true, false, false, false), plans: optionsFrom([...projectRows, ...equipmentRows], row => row.planName, false, false, true, false), departments: optionsFrom([...projectRows, ...equipmentRows], row => row.department, false, true, false, false), villages: optionsFrom(projectRows, row => row.villageNo), workTypes: optionsFrom(projectRows, row => row.workType), equipmentTypes: optionsFrom(equipmentRows, row => row.equipmentType, false, false, false, true), budgetStatuses: optionsFrom([...projectRows, ...equipmentRows], row => row.budgetStatus), planBooks: optionsFrom([...projectRows, ...equipmentRows], row => row.planBook, false, false, false, false, true),
        },
        latestImport: recentImports[0] ?? null,
      };
    }),
  }),

  catalog: router({
    projects: publicProcedure.input(filterInput).query(async ({ input }) => {
      const rows = sortRows((await getAllProjects()).map(normalizeProjectRow).filter(row => matchesFilter(row as AnyRecord, input)) as AnyRecord[], input.sortBy, input.sortDir);
      const start = (input.page - 1) * input.pageSize;
      return { rows: rows.slice(start, start + input.pageSize).map(row => visibleProject(row)), total: rows.length, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(rows.length / input.pageSize)) };
    }),
    equipment: publicProcedure.input(filterInput.omit({ strategy: true, villageNo: true, workType: true, exceededOnly: true })).query(async ({ input }) => {
      const rows = sortRows((await getAllEquipment()).map(normalizeEquipmentRow).filter(row => matchesFilter(row as AnyRecord, input as any)) as AnyRecord[], input.sortBy, input.sortDir);
      const start = (input.page - 1) * input.pageSize;
      return { rows: rows.slice(start, start + input.pageSize).map(row => visibleEquipment(row)), total: rows.length, page: input.page, pageSize: input.pageSize, totalPages: Math.max(1, Math.ceil(rows.length / input.pageSize)) };
    }),
    projectById: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const row = (await getAllProjects()).map(normalizeProjectRow).find(item => item.id === input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบโครงการ" });
      return visibleProject(row);
    }),
    equipmentById: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const row = (await getAllEquipment()).map(normalizeEquipmentRow).find(item => item.id === input.id);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบครุภัณฑ์" });
      return visibleEquipment(row);
    }),
    exportProjects: publicProcedure.input(filterInput).query(async ({ input }) => ({ rows: sortRows((await getAllProjects()).map(normalizeProjectRow).filter(row => matchesFilter(row as AnyRecord, input)) as AnyRecord[], input.sortBy, input.sortDir).map(row => visibleProject(row)) })),
    exportEquipment: publicProcedure.input(filterInput.omit({ strategy: true, villageNo: true, workType: true, exceededOnly: true })).query(async ({ input }) => ({ rows: sortRows((await getAllEquipment()).map(normalizeEquipmentRow).filter(row => matchesFilter(row as AnyRecord, input as any)) as AnyRecord[], input.sortBy, input.sortDir).map(row => visibleEquipment(row)) })),
  }),

  tracking: router({
    projectTimeline: publicProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ input }) => {
      const project = (await getAllProjects()).map(normalizeProjectRow).find(row => row.id === input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบโครงการ" });
      const existing = new Map((await getProjectTimeline(input.projectId)).map(row => [row.fiscalYear, row]));
      const timeline = YEARS.map(year => {
        const saved = existing.get(year);
        return {
          id: saved?.id ?? null,
          projectId: input.projectId,
          fiscalYear: year,
          plannedBudget: saved?.plannedBudget ?? project[`budget${year}` as keyof typeof project] ?? "0",
          approvedBudget: saved?.approvedBudget ?? "0",
          disbursedBudget: saved?.disbursedBudget ?? "0",
          progressPercent: saved?.progressPercent ?? "0",
          status: saved?.status ?? "ยังไม่ระบุ",
          note: saved?.note ?? null,
          tracked: Boolean(saved),
          updatedAt: saved?.updatedAt ?? null,
        };
      });
      return { project: visibleProject(project), timeline };
    }),
    upsert: adminProcedure.input(timelineInput).mutation(async ({ input, ctx }) => {
      const project = (await getAllProjects()).map(normalizeProjectRow).find(row => row.id === input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบโครงการ" });
      await upsertProjectTimeline({ projectId: input.projectId, fiscalYear: input.fiscalYear, plannedBudget: input.plannedBudget.toFixed(2), approvedBudget: input.approvedBudget.toFixed(2), disbursedBudget: input.disbursedBudget.toFixed(2), progressPercent: input.progressPercent.toFixed(2), status: input.status, note: input.note ?? null, updatedBy: ctx.user.id });
      return { success: true, timeline: await getProjectTimeline(input.projectId) } as const;
    }),
  }),

  admin: router({
    importExcel: adminProcedure.input(z.object({ fileName: z.string().min(1), fileBase64: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      let workbook: xlsx.WorkBook;
      try {
        const buffer = Buffer.from(input.fileBase64, "base64");
        workbook = xlsx.read(buffer, { type: "buffer" });
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถอ่านไฟล์ Excel ได้" });
      }

      const projectRows = readSheet(workbook, "บัญชีโครงการ");
      const exceededRows = readSheet(workbook, "โครงการเกินศักยภาพ");
      const equipmentRows = readSheet(workbook, "บัญชีครุภัณฑ์");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้" });

      const stored = await storagePut(`plan-imports/${input.fileName}`, Buffer.from(input.fileBase64, "base64"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await db.delete(projectTimelines);
      await db.delete(projects);
      await db.delete(equipment);
      const projectValues = [...projectRows.map(row => projectInsert(row, 0)), ...exceededRows.map(row => projectInsert(row, 1))];
      const equipmentValues = equipmentRows.map(row => equipmentInsert(row));
      for (let index = 0; index < projectValues.length; index += 100) await db.insert(projects).values(projectValues.slice(index, index + 100));
      for (let index = 0; index < equipmentValues.length; index += 100) await db.insert(equipment).values(equipmentValues.slice(index, index + 100));
      await db.insert(importRuns).values({ fileName: input.fileName, storageKey: stored.key, projectRows: projectRows.length, exceededRows: exceededRows.length, equipmentRows: equipmentRows.length, uploadedBy: ctx.user.name ?? ctx.user.email ?? ctx.user.openId });
      return { success: true, projectRows: projectRows.length, exceededRows: exceededRows.length, equipmentRows: equipmentRows.length, storedUrl: stored.url };
    }),
    importHistory: adminProcedure.query(() => getRecentImportRuns(10)),
  }),
});

export type AppRouter = typeof appRouter;
