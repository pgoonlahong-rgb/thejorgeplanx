import { describe, expect, it } from "vitest";
import { buildPrintDocument, exportMatrix } from "../client/src/lib/export-utils";

describe("search export utilities", () => {
  it("maps project rows to labeled columns without exposing plan book", () => {
    const result = exportMatrix("projects", [{
      codeId: "P-001",
      projectName: "ปรับปรุงถนน <สายหลัก>",
      strategy: "ยุทธศาสตร์ที่ 1",
      planName: "แผนงานอุตสาหกรรมและการโยธา",
      target: "หมู่บ้านที่ 1",
      department: "กองช่าง",
      budgetYearReceived: "2567",
      budget2567: 125000,
      totalBudget: 125000,
      planBook: "เล่มที่ 1",
    }]);

    expect(result.headers).toContain("ชื่อโครงการ");
    expect(result.headers).toContain("งบปี 2567");
    expect(result.headers).not.toContain("เล่มแผน");
    expect(result.rows[0]).toContain("P-001");
    expect(result.rows[0]).toContain(125000);
    expect(result.rows[0]).not.toContain("เล่มที่ 1");
  });

  it("builds a printable PDF document with Thai title, rows, and escaped HTML", () => {
    const result = buildPrintDocument("equipment", [{
      codeId: "E-001",
      equipmentName: "เครื่องคอมพิวเตอร์ <สำนักงาน>",
      equipmentType: "ครุภัณฑ์คอมพิวเตอร์",
      planName: "แผนงานบริหารงานทั่วไป",
      department: "สำนักปลัด",
      totalBudget: 45000,
    }]);

    expect(result.title).toBe("ผลการค้นหาครุภัณฑ์");
    expect(result.html).toContain("ระบบสืบค้นข้อมูลแผนพัฒนาท้องถิ่น 2566-2570 และที่เพิ่มเติม");
    expect(result.html).toContain("เครื่องคอมพิวเตอร์ &lt;สำนักงาน&gt;");
    expect(result.html).not.toContain("เครื่องคอมพิวเตอร์ <สำนักงาน>");
    expect(result.html).toContain("จำนวน 1 รายการ");
  });
});
