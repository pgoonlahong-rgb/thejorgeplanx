export type ExportKind = "projects" | "equipment";

export const exportLabels: Record<string, string> = {
  codeId: "รหัส ID", projectName: "ชื่อโครงการ", equipmentName: "ชื่อครุภัณฑ์", strategy: "ยุทธศาสตร์", planName: "แผนงาน",
  equipmentType: "ประเภทครุภัณฑ์", target: "เป้าหมาย", department: "หน่วยงานรับผิดชอบ", budgetYearReceived: "ปีงบประมาณที่ได้รับ",
  budget2566: "งบปี 2566", budget2567: "งบปี 2567", budget2568: "งบปี 2568", budget2569: "งบปี 2569", budget2570: "งบปี 2570",
  totalBudget: "งบรวม 5 ปี", budgetStatus: "สถานะงบประมาณ", pageNo: "หน้า", itemNo: "ข้อ", isExceeded: "โครงการเกินศักยภาพ",
};

export const projectExportColumns = ["codeId", "projectName", "strategy", "planName", "target", "department", "budgetYearReceived", "budget2566", "budget2567", "budget2568", "budget2569", "budget2570", "totalBudget", "budgetStatus", "pageNo", "itemNo"];
export const equipmentExportColumns = ["codeId", "equipmentName", "equipmentType", "planName", "target", "department", "budgetYearReceived", "budget2566", "budget2567", "budget2568", "budget2569", "budget2570", "totalBudget", "budgetStatus", "pageNo", "itemNo"];

export function exportMatrix(kind: ExportKind, rows: any[]) {
  const columns = kind === "projects" ? projectExportColumns : equipmentExportColumns;
  return {
    headers: columns.map(column => exportLabels[column] ?? column),
    rows: rows.map(row => columns.map(column => row[column] ?? "")),
  };
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" }[character] ?? character));
}

export function buildPrintDocument(kind: ExportKind, rows: any[]) {
  const matrix = exportMatrix(kind, rows);
  const title = kind === "projects" ? "ผลการค้นหาโครงการ" : "ผลการค้นหาครุภัณฑ์";
  const table = `<table><thead><tr>${matrix.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${matrix.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return { title, html: `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:'Noto Sans Thai','Tahoma',sans-serif;color:#111827;font-size:8px}h1{font-size:16px;margin:0 0 3px}p{margin:0 0 10px;color:#475569;font-size:9px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:4px 5px;vertical-align:top;word-break:break-word}th{background:#e2e8f0;color:#0f172a;font-weight:700}tr:nth-child(even){background:#f8fafc}</style></head><body><h1>ระบบสืบค้นข้อมูลแผนพัฒนาท้องถิ่น 2566-2570 และที่เพิ่มเติม</h1><p>${escapeHtml(title)} · จำนวน ${rows.length.toLocaleString("th-TH")} รายการ</p>${table}</body></html>` };
}
