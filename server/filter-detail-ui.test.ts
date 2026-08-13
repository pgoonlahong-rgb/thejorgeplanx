import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("project search UI contract", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");

  it("uses responsive filter grids and opaque Select surfaces", () => {
    expect(source).toContain("grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4");
    expect(source).toContain("border-slate-700 bg-slate-900 text-slate-100");
    expect(source).toContain("z-[100] border-slate-700 bg-slate-950 text-slate-100 shadow-2xl");
  });

  it("shows plan book in details and does not render the project timeline", () => {
    expect(source).toContain("<span>เล่มแผนพัฒนา</span>");
    expect(source).toContain("row.planBook ?? \"-\"");
    expect(source).not.toContain("{isProject && <ProjectTimeline projectId={row.id} isAdmin={isAdmin} />}");
  });
});

  it("uses the requested Thai filter labels for public-sector and village groups", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(source).toContain('label="ส่วนราชการ"');
    expect(source).toContain('label="หมู่ที่"');
    expect(source).toContain("options.villages ?? []");
  });

  it("renders projects table with exact required headers and equipment table columns", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(source).toContain("ลำดับที่");
    expect(source).toContain("ชื่อโครงการ");
    expect(source).toContain("งบประมาณ");
    expect(source).toContain("ส่วนราชการ");
    expect(source).toContain("หน้า");
    expect(source).toContain("ข้อ");
    expect(source).toContain("สถานะอนุมัติงบประมาณ");
    expect(source).toContain("ชื่อครุภัณฑ์");
    expect(source).toContain("เล่มแผนพัฒนา");
  });
