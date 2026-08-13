import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import xlsx from "xlsx";
import * as schema from "../drizzle/schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL");
    process.exit(1);
  }

  const pool = mysql.createPool(connectionString);
  const db = drizzle(pool, { schema, mode: "default" });

  console.log("Reading excel file...");
  const excelPath = "/home/ubuntu/upload/แผนพัฒนาท้องถิ่น_ตรวจสอบงบประมาณ-1.xlsx";
  const workbook = xlsx.readFile(excelPath);

  console.log("Clearing existing data...");
  await db.delete(schema.projects);
  await db.delete(schema.equipment);

  const cleanNum = (val: any) => {
    if (val === undefined || val === null || val === "" || Number.isNaN(val)) return "0";
    if (typeof val === "number") {
      if (Number.isNaN(val)) return "0";
      return val.toString();
    }
    const cleaned = val.toString().replace(/,/g, "").trim();
    if (cleaned === "" || cleaned === "-" || cleaned.toLowerCase() === "nan") return "0";
    const num = parseFloat(cleaned);
    return isNaN(num) ? "0" : num.toString();
  };

  const cleanInt = (val: any) => {
    if (val === undefined || val === null || val === "" || Number.isNaN(val)) return 0;
    if (typeof val === "number") {
      return Number.isNaN(val) ? 0 : Math.floor(val);
    }
    const cleaned = val.toString().replace(/,/g, "").trim();
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
  };

  const cleanStr = (val: any) => {
    if (val === undefined || val === null) return null;
    const s = val.toString().trim();
    if (s === "" || s.toLowerCase() === "nan") return null;
    return s;
  };

  // 1. บัญชีโครงการ
  const projSheet = workbook.Sheets["บัญชีโครงการ"];
  const projRows: any[] = xlsx.utils.sheet_to_json(projSheet);
  console.log(`Importing บัญชีโครงการ: ${projRows.length} rows`);

  for (const row of projRows) {
    const b66 = cleanNum(row[2566]);
    const b67 = cleanNum(row[2567]);
    const b68 = cleanNum(row[2568]);
    const b69 = cleanNum(row[2569]);
    const b70 = cleanNum(row[2570]);
    const tot = (parseFloat(b66) + parseFloat(b67) + parseFloat(b68) + parseFloat(b69) + parseFloat(b70)).toString();

    await db.insert(schema.projects).values({
      rowNo: row["ลำดับที่"] ? cleanInt(row["ลำดับที่"]) : null,
      codeId: cleanStr(row["รหัส ID"]),
      strategy: cleanStr(row["ยุทธศาสตร์"]),
      planName: cleanStr(row["แผนงาน"]),
      projectName: row["ชื่อโครงการ"]?.toString() || "ไม่ระบุชื่อโครงการ",
      target: cleanStr(row["เป้าหมาย (ผลผลิตของโครงการ)"]),
      budget2566: b66,
      budget2567: b67,
      budget2568: b68,
      budget2569: b69,
      budget2570: b70,
      totalBudget: tot,
      department: cleanStr(row["หน่วยงานรับผิดชอบ"]),
      workType: cleanStr(row["ประเภทงาน (ยศ.5)"]),
      villageNo: cleanStr(row["หมู่ที่ (ยศ.5)"]),
      planBook: cleanStr(row["เล่มแผนพัฒนาฯ"]),
      pageNo: cleanStr(row["หน้า"]),
      itemNo: cleanStr(row["ข้อ"]),
      recheck: cleanStr(row["ตรวจซ้ำ"]),
      sourceInfo: cleanStr(row["แหล่งข้อมูล"]),
      oldCodeId: cleanStr(row["รหัส ID เดิม"]),
      budgetStatus: cleanStr(row["สถานะงบประมาณ"]),
      budgetYearReceived: cleanStr(row["ปีงบประมาณที่ได้รับ"]),
      actualBudgetReceived: cleanNum(row["งบที่ได้รับจริง (บาท)"]),
      actionPlanCount: cleanInt(row["จำนวนครั้งที่ปรากฏในแผนดำเนินงาน"]),
      actionPlanName: cleanStr(row["ชื่อโครงการในแผนดำเนินงาน"]),
      checkPdf: cleanStr(row["ตรวจกับ PDF"]),
      isExceeded: 0,
    });
  }

  // 2. โครงการเกินศักยภาพ
  const excSheet = workbook.Sheets["โครงการเกินศักยภาพ"];
  const excRows: any[] = xlsx.utils.sheet_to_json(excSheet);
  console.log(`Importing โครงการเกินศักยภาพ: ${excRows.length} rows`);

  for (const row of excRows) {
    const b66 = cleanNum(row[2566]);
    const b67 = cleanNum(row[2567]);
    const b68 = cleanNum(row[2568]);
    const b69 = cleanNum(row[2569]);
    const b70 = cleanNum(row[2570]);
    const tot = (parseFloat(b66) + parseFloat(b67) + parseFloat(b68) + parseFloat(b69) + parseFloat(b70)).toString();

    await db.insert(schema.projects).values({
      rowNo: row["ลำดับที่"] ? cleanInt(row["ลำดับที่"]) : null,
      codeId: cleanStr(row["รหัส ID"]),
      strategy: cleanStr(row["ยุทธศาสตร์"]),
      planName: cleanStr(row["แผนงาน"]),
      projectName: row["ชื่อโครงการ"]?.toString() || "ไม่ระบุชื่อโครงการ",
      target: cleanStr(row["เป้าหมาย (ผลผลิตของโครงการ)"]),
      budget2566: b66,
      budget2567: b67,
      budget2568: b68,
      budget2569: b69,
      budget2570: b70,
      totalBudget: tot,
      department: cleanStr(row["หน่วยงานรับผิดชอบ"]),
      workType: cleanStr(row["ประเภทงาน (ยศ.5)"]),
      villageNo: cleanStr(row["หมู่ที่ (ยศ.5)"]),
      planBook: cleanStr(row["เล่มแผนพัฒนาฯ"]),
      pageNo: cleanStr(row["หน้า"]),
      itemNo: cleanStr(row["ข้อ"]),
      recheck: cleanStr(row["ตรวจซ้ำ"]),
      sourceInfo: cleanStr(row["แหล่งข้อมูล"]),
      oldCodeId: cleanStr(row["รหัส ID เดิม"]),
      budgetStatus: cleanStr(row["สถานะงบประมาณ"]),
      budgetYearReceived: cleanStr(row["ปีงบประมาณที่ได้รับ"]),
      actualBudgetReceived: cleanNum(row["งบที่ได้รับจริง (บาท)"]),
      actionPlanCount: cleanInt(row["จำนวนครั้งที่ปรากฏในแผนดำเนินงาน"]),
      actionPlanName: cleanStr(row["ชื่อโครงการในแผนดำเนินงาน"]),
      checkPdf: cleanStr(row["ตรวจกับ PDF"]),
      isExceeded: 1,
    });
  }

  // 3. บัญชีครุภัณฑ์
  const eqSheet = workbook.Sheets["บัญชีครุภัณฑ์"];
  const eqRows: any[] = xlsx.utils.sheet_to_json(eqSheet);
  console.log(`Importing บัญชีครุภัณฑ์: ${eqRows.length} rows`);

  for (const row of eqRows) {
    const b66 = cleanNum(row[2566]);
    const b67 = cleanNum(row[2567]);
    const b68 = cleanNum(row[2568]);
    const b69 = cleanNum(row[2569]);
    const b70 = cleanNum(row[2570]);
    const tot = (parseFloat(b66) + parseFloat(b67) + parseFloat(b68) + parseFloat(b69) + parseFloat(b70)).toString();

    await db.insert(schema.equipment).values({
      rowNo: row["ลำดับที่"] ? cleanInt(row["ลำดับที่"]) : null,
      codeId: cleanStr(row["รหัส ID"]),
      planName: cleanStr(row["แผนงาน"]),
      equipmentType: cleanStr(row["ประเภทครุภัณฑ์"]),
      equipmentName: row["ชื่อครุภัณฑ์"]?.toString() || "ไม่ระบุชื่อครุภัณฑ์",
      target: cleanStr(row["เป้าหมาย (ผลผลิตของครุภัณฑ์)"]),
      budget2566: b66,
      budget2567: b67,
      budget2568: b68,
      budget2569: b69,
      budget2570: b70,
      totalBudget: tot,
      department: cleanStr(row["หน่วยงานรับผิดชอบ"]),
      planBook: cleanStr(row["เล่มแผนพัฒนาฯ"]),
      pageNo: cleanStr(row["หน้า"]),
      itemNo: cleanStr(row["ข้อ"]),
      recheck: cleanStr(row["ตรวจซ้ำ"]),
      sourceInfo: cleanStr(row["แหล่งข้อมูล"]),
      oldCodeId: cleanStr(row["รหัส ID เดิม"]),
      budgetStatus: cleanStr(row["สถานะงบประมาณ"]),
      budgetYearReceived: cleanStr(row["ปีงบประมาณที่ได้รับ"]),
      actualBudgetReceived: cleanNum(row["งบที่ได้รับจริง (บาท)"]),
      actionPlanCount: cleanInt(row["จำนวนครั้งที่ปรากฏในแผนดำเนินงาน"]),
      actionPlanName: cleanStr(row["ชื่อโครงการในแผนดำเนินงาน"]),
      checkPdf: cleanStr(row["ตรวจกับ PDF"]),
    });
  }

  console.log("All data imported successfully via TypeScript!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Import error:", err);
  process.exit(1);
});
