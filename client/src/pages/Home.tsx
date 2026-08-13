import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { buildPrintDocument, exportMatrix } from "@/lib/export-utils";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownRight, ArrowUpDown, ArrowUpRight, BarChart3, Building2, ChevronLeft, ChevronRight, ClipboardList, Database, Download, FileSpreadsheet, Filter, Gauge, Landmark, LayoutDashboard, LogIn, Package, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Upload, WalletCards, X,
} from "lucide-react";

const chartColors = ["#ef476f", "#118ab2", "#06d6a0", "#f9c74f", "#4361ee", "#8b5cf6", "#ff7f51", "#2ec4b6"];
const years = ["2566", "2567", "2568", "2569", "2570"];

type View = "dashboard" | "projects" | "equipment" | "admin";
type SortBy = "projectName" | "equipmentName" | "totalBudget" | "budget2566" | "budget2570" | "department";
type SortDir = "asc" | "desc";
type Filters = { search: string; strategy: string; planName: string; department: string; villageNo: string; workType: string; budgetStatus: string; budgetYear: string; planBook: string; pageNo: string; itemNo: string; equipmentType: string; sortBy: SortBy; sortDir: SortDir; exceededOnly: boolean; page: number; pageSize: number };
const emptyFilters: Filters = { search: "", strategy: "all", planName: "all", department: "all", villageNo: "all", workType: "all", budgetStatus: "all", budgetYear: "all", planBook: "all", pageNo: "", itemNo: "", equipmentType: "all", sortBy: "projectName", sortDir: "asc", exceededOnly: false, page: 1, pageSize: 20 };

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0 บาท";
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ลบ.`;
  return `${amount.toLocaleString("th-TH", { maximumFractionDigits: 0 })} บาท`;
}

function fullMoney(value: unknown) {
  return `${Number(value ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 2 })} บาท`;
}

function shortText(value: unknown, max = 62) {
  const text = String(value ?? "-");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function downloadExcel(kind: "projects" | "equipment", rows: any[]) {
  const matrix = exportMatrix(kind, rows);
  const worksheet = XLSX.utils.aoa_to_sheet([matrix.headers, ...matrix.rows]);
  worksheet["!cols"] = matrix.headers.map((header, index) => ({ wch: Math.min(42, Math.max(12, Math.max(header.length, ...matrix.rows.slice(0, 80).map(row => String(row[index] ?? "").length)) + 2)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, kind === "projects" ? "โครงการ" : "ครุภัณฑ์");
  XLSX.writeFile(workbook, `${kind === "projects" ? "ผลการค้นหาโครงการ" : "ผลการค้นหาครุภัณฑ์"}.xlsx`);
}

function printPdf(kind: "projects" | "equipment", rows: any[]) {
  const { html } = buildPrintDocument(kind, rows);
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) throw new Error("เบราว์เซอร์ปิดกั้นหน้าต่างสำหรับสร้าง PDF");
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint: string; icon: any; tone: string }) {
  return (
    <Card className={`stat-card border-0 overflow-hidden ${tone}`}>
      <CardContent className="p-5 relative">
        <div className="absolute right-4 top-4 opacity-20"><Icon className="h-12 w-12" /></div>
        <div className="relative">
          <div className="flex items-center gap-2 text-white/75 text-sm font-medium"><Icon className="h-4 w-4" />{label}</div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-xs text-white/70">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label className="filter-label">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-900 text-slate-100"><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent className="z-[100] border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
          <SelectItem value="all" className="cursor-pointer text-slate-100 focus:bg-slate-800 focus:text-white">ทั้งหมด</SelectItem>
          {options.map(option => <SelectItem key={option} value={option} className="cursor-pointer text-slate-100 focus:bg-slate-800 focus:text-white">{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterPanel({ filters, setFilters, options, onReset }: { filters: Filters; setFilters: (next: Filters) => void; options: any; onReset: () => void }) {
  const patch = (next: Partial<Filters>) => setFilters({ ...filters, ...next, page: 1 });
  return (
    <Card className="filter-panel border-slate-200/80 shadow-sm">
      <CardContent className="p-5">
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0 space-y-1.5">
              <label className="filter-label">ค้นหาคำสำคัญ</label>
              <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={filters.search} onChange={event => patch({ search: event.target.value })} placeholder="ชื่อโครงการ รหัส เป้าหมาย หรือหมู่บ้าน" className="h-10 pl-9 bg-white" /></div>
            </div>
            <Button variant="outline" className="h-10 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white" onClick={onReset}><X className="mr-2 h-4 w-4" />ล้างตัวกรอง</Button>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <FilterSelect label="ยุทธศาสตร์" value={filters.strategy} options={options.strategies ?? []} onChange={value => patch({ strategy: value })} />
            <FilterSelect label="แผนงาน" value={filters.planName} options={options.plans ?? []} onChange={value => patch({ planName: value })} />
            <FilterSelect label="ส่วนราชการ" value={filters.department} options={options.departments ?? []} onChange={value => patch({ department: value })} />
            <FilterSelect label="หมู่ที่" value={filters.villageNo} options={options.villages ?? []} onChange={value => patch({ villageNo: value })} />
            <FilterSelect label="ประเภทงาน" value={filters.workType} options={options.workTypes ?? []} onChange={value => patch({ workType: value })} />
            <FilterSelect label="ปีงบประมาณ" value={filters.budgetYear} options={years} onChange={value => patch({ budgetYear: value })} />
            <FilterSelect label="สถานะงบ" value={filters.budgetStatus} options={options.budgetStatuses ?? []} onChange={value => patch({ budgetStatus: value })} />
            <FilterSelect label="ประเภทครุภัณฑ์" value={filters.equipmentType} options={options.equipmentTypes ?? []} onChange={value => patch({ equipmentType: value })} />
            <FilterSelect label="เล่มแผนพัฒนา" value={filters.planBook} options={options.planBooks ?? []} onChange={value => patch({ planBook: value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_1fr] sm:items-end">
            <div className="space-y-1.5"><label className="filter-label">หน้า</label><Input value={filters.pageNo} onChange={event => patch({ pageNo: event.target.value })} placeholder="เช่น 53" className="h-10 bg-white" /></div>
            <div className="space-y-1.5"><label className="filter-label">ข้อ</label><Input value={filters.itemNo} onChange={event => patch({ itemNo: event.target.value })} placeholder="เช่น 1" className="h-10 bg-white" /></div>
            <p className="hidden text-xs leading-5 text-slate-500 sm:block">จัดกลุ่มตัวกรองเป็นสัดส่วน เพื่อให้เลือกข้อมูลได้ชัดเจนและไม่บังกัน</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
          <Filter className="h-3.5 w-3.5 text-sky-400" />เล่มแผนพัฒนาใช้เป็นตัวกรอง และจะแสดงในรายละเอียดเมื่อคลิกดูโครงการ
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-slate-300"><SlidersHorizontal className="h-3 w-3" />ค้นหาแบบผสมได้</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center"><Search className="mb-3 h-9 w-9 text-slate-300" /><p className="font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-400">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></div>;
}

function ExportButtons({ onExcel, onPdf, onCsv, busy }: { onExcel: () => void; onPdf: () => void; onCsv: () => void; busy?: boolean }) {
  return <div className="flex flex-wrap gap-2">
    <Button onClick={onExcel} variant="outline" size="sm" disabled={busy} className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"><FileSpreadsheet className="mr-1.5 h-4 w-4" />Excel</Button>
    <Button onClick={onPdf} variant="outline" size="sm" disabled={busy} className="border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"><Download className="mr-1.5 h-4 w-4" />PDF</Button>
    <Button onClick={onCsv} variant="outline" size="sm" disabled={busy} className="border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:text-sky-200"><Download className="mr-1.5 h-4 w-4" />CSV</Button>
  </div>;
}

function ProjectsTable({ rows, total, filters, setFilters, onDetail, onExport, onExportExcel, onExportPdf, exportBusy }: { rows: any[]; total: number; filters: Filters; setFilters: (next: Filters) => void; onDetail: (row: any) => void; onExport: () => void; onExportExcel: () => void; onExportPdf: () => void; exportBusy?: boolean }) {
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const sort = (sortBy: Filters["sortBy"]) => setFilters({ ...filters, sortBy, sortDir: filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc", page: 1 });
  const sortIcon = (sortBy: Filters["sortBy"]) => <ArrowUpDown className={`ml-1 inline h-3.5 w-3.5 ${filters.sortBy === sortBy ? "text-blue-600" : "text-slate-300"}`} />;
  const pageLabel = `${((filters.page - 1) * filters.pageSize) + 1}-${Math.min(filters.page * filters.pageSize, total)} จาก ${total.toLocaleString("th-TH")} รายการ`;
  return (
    <Card className="border-slate-200/80 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-white px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">รายการโครงการ</CardTitle><p className="mt-1 text-xs text-slate-500">แสดงเป้าหมาย งบประมาณ ส่วนราชการ และจุดอ้างอิงแผน · ส่งออกตามตัวกรองปัจจุบัน</p></div><ExportButtons onExcel={onExportExcel} onPdf={onExportPdf} onCsv={onExport} busy={exportBusy} /></div></CardHeader>
      {rows.length === 0 ? <EmptyState title="ไม่พบรายการโครงการ" /> : <>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50/70"><TableHead className="w-[80px]">ลำดับที่</TableHead><TableHead className="w-[340px] cursor-pointer select-none" onClick={() => sort("projectName")}>ชื่อโครงการ{sortIcon("projectName")}</TableHead><TableHead className="cursor-pointer select-none text-right" onClick={() => sort("totalBudget")}>งบประมาณ{sortIcon("totalBudget")}</TableHead><TableHead className="cursor-pointer select-none" onClick={() => sort("department")}>ส่วนราชการ{sortIcon("department")}</TableHead><TableHead className="w-[80px]">หน้า</TableHead><TableHead className="w-[80px]">ข้อ</TableHead><TableHead>สถานะอนุมัติงบประมาณ</TableHead></TableRow></TableHeader><TableBody>
          {rows.map((row, idx) => {
            const rowNo = ((filters.page - 1) * filters.pageSize) + idx + 1;
            return <TableRow key={row.id} className="cursor-pointer" onClick={() => onDetail(row)}><TableCell className="font-medium text-slate-500">{rowNo}</TableCell><TableCell><div className="font-semibold text-slate-900">{shortText(row.projectName, 72)}</div><div className="mt-1 text-xs text-blue-400 font-medium">{shortText(row.planName, 50)}</div><div className="mt-0.5 text-[11px] text-slate-400">{row.codeId ?? "ไม่มีรหัส"}{row.isExceeded ? <Badge className="ml-2 bg-rose-100 text-rose-700 hover:bg-rose-100">เกินศักยภาพ</Badge> : null}</div></TableCell><TableCell className="text-right font-semibold text-slate-800">{fullMoney(row.totalBudget)}</TableCell><TableCell className="text-sm">{shortText(row.department, 34)}</TableCell><TableCell className="text-sm text-slate-600">{row.pageNo ?? "-"}</TableCell><TableCell className="text-sm text-slate-600">{row.itemNo ?? "-"}</TableCell><TableCell className="text-sm"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.budgetStatus === "อนุมัติงบประมาณ" ? "bg-sky-950 text-sky-300 border border-sky-800" : "bg-rose-950 text-rose-300 border border-rose-800"}`}>{row.budgetStatus ?? "ยังไม่ระบุ"}</span></TableCell></TableRow>;
          })}
        </TableBody></Table></div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">{total ? pageLabel : "0 รายการ"}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft className="h-4 w-4" />ก่อนหน้า</Button><span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">หน้า {filters.page} / {totalPages}</span><Button size="sm" variant="outline" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>ถัดไป<ChevronRight className="h-4 w-4" /></Button></div></div>
      </>}
    </Card>
  );
}

function EquipmentTable({ rows, total, filters, setFilters, onDetail, onExport, onExportExcel, onExportPdf, exportBusy }: { rows: any[]; total: number; filters: Filters; setFilters: (next: Filters) => void; onDetail: (row: any) => void; onExport: () => void; onExportExcel: () => void; onExportPdf: () => void; exportBusy?: boolean }) {
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const sort = (sortBy: Filters["sortBy"]) => setFilters({ ...filters, sortBy, sortDir: filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc", page: 1 });
  const sortIcon = (sortBy: Filters["sortBy"]) => <ArrowUpDown className={`ml-1 inline h-3.5 w-3.5 ${filters.sortBy === sortBy ? "text-blue-600" : "text-slate-300"}`} />;
  const pageLabel = `${((filters.page - 1) * filters.pageSize) + 1}-${Math.min(filters.page * filters.pageSize, total)} จาก ${total.toLocaleString("th-TH")} รายการ`;
  return <Card className="border-slate-200/80 shadow-sm overflow-hidden"><CardHeader className="border-b border-slate-100 bg-white px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">บัญชีครุภัณฑ์</CardTitle><p className="mt-1 text-xs text-slate-500">ค้นหาตามชื่อ ประเภท แผนงาน ส่วนราชการ และปีงบประมาณ · ส่งออกตามตัวกรองปัจจุบัน</p></div><ExportButtons onExcel={onExportExcel} onPdf={onExportPdf} onCsv={onExport} busy={exportBusy} /></div></CardHeader>{rows.length === 0 ? <EmptyState title="ไม่พบรายการครุภัณฑ์" /> : <><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50/70"><TableHead className="w-[80px]">ลำดับที่</TableHead><TableHead>ประเภท</TableHead><TableHead className="w-[280px] cursor-pointer select-none" onClick={() => sort("equipmentName")}>ชื่อครุภัณฑ์{sortIcon("equipmentName")}</TableHead><TableHead className="cursor-pointer select-none text-right" onClick={() => sort("totalBudget")}>งบประมาณ{sortIcon("totalBudget")}</TableHead><TableHead className="cursor-pointer select-none" onClick={() => sort("department")}>ส่วนราชการ{sortIcon("department")}</TableHead><TableHead>เล่มแผนพัฒนา</TableHead><TableHead className="w-[70px]">หน้า</TableHead><TableHead className="w-[70px]">ข้อ</TableHead><TableHead>สถานะอนุมัติงบประมาณ</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, idx) => {
    const rowNo = ((filters.page - 1) * filters.pageSize) + idx + 1;
    return <TableRow key={row.id} className="cursor-pointer" onClick={() => onDetail(row)}><TableCell className="font-medium text-slate-500">{rowNo}</TableCell><TableCell className="text-sm">{shortText(row.equipmentType, 32)}</TableCell><TableCell><div className="font-semibold text-slate-900">{shortText(row.equipmentName, 72)}</div><div className="mt-1 text-xs text-slate-400">{row.codeId ?? "ไม่มีรหัส"}</div></TableCell><TableCell className="text-right font-semibold text-slate-800">{fullMoney(row.totalBudget)}</TableCell><TableCell className="text-sm">{shortText(row.department, 32)}</TableCell><TableCell className="text-sm text-slate-600">{row.planBook ?? "-"}</TableCell><TableCell className="text-sm text-slate-600">{row.pageNo ?? "-"}</TableCell><TableCell className="text-sm text-slate-600">{row.itemNo ?? "-"}</TableCell><TableCell className="text-sm"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.budgetStatus === "อนุมัติงบประมาณ" ? "bg-sky-950 text-sky-300 border border-sky-800" : "bg-rose-950 text-rose-300 border border-rose-800"}`}>{row.budgetStatus ?? "ยังไม่ระบุ"}</span></TableCell></TableRow>;
  })}</TableBody></Table></div><div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">{total ? pageLabel : "0 รายการ"}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}><ChevronLeft className="h-4 w-4" />ก่อนหน้า</Button><span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">หน้า {filters.page} / {totalPages}</span><Button size="sm" variant="outline" disabled={filters.page >= totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>ถัดไป<ChevronRight className="h-4 w-4" /></Button></div></div></>}</Card>;
}

const timelineStatuses = ["ยังไม่ระบุ", "ยังไม่เริ่ม", "กำลังดำเนินการ", "เสร็จสิ้น", "ล่าช้า", "ยกเลิก"] as const;

function ProjectTimeline({ projectId, isAdmin }: { projectId: number; isAdmin: boolean }) {
  const timelineQuery = trpc.tracking.projectTimeline.useQuery({ projectId });
  const saveMutation = trpc.tracking.upsert.useMutation({ onSuccess: () => { timelineQuery.refetch(); toast.success("บันทึกสถานะโครงการแล้ว"); } });
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  useEffect(() => {
    if (timelineQuery.data?.timeline) setDrafts(Object.fromEntries(timelineQuery.data.timeline.map((item: any) => [item.fiscalYear, { plannedBudget: String(item.plannedBudget ?? 0), approvedBudget: String(item.approvedBudget ?? 0), disbursedBudget: String(item.disbursedBudget ?? 0), progressPercent: String(item.progressPercent ?? 0), status: item.status ?? "ยังไม่ระบุ", note: item.note ?? "" }])));
  }, [timelineQuery.data]);
  if (timelineQuery.isLoading) return <div className="loading-card"><RefreshCw className="h-5 w-5 animate-spin text-blue-600" />กำลังโหลด Timeline การเบิกจ่าย...</div>;
  if (timelineQuery.error || !timelineQuery.data) return <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">ไม่สามารถโหลดข้อมูล Timeline ได้</div>;
  const rows = timelineQuery.data.timeline as any[];
  const totalApproved = rows.reduce((sum, item) => sum + Number(item.approvedBudget ?? 0), 0);
  const totalDisbursed = rows.reduce((sum, item) => sum + Number(item.disbursedBudget ?? 0), 0);
  const overallProgress = totalApproved > 0 ? Math.min(100, (totalDisbursed / totalApproved) * 100) : rows.reduce((sum, item) => sum + Number(item.progressPercent ?? 0), 0) / Math.max(rows.length, 1);
  const updateField = (year: number, field: string, value: string) => setDrafts(previous => ({ ...previous, [year]: { ...(previous[year] ?? {}), [field]: value } }));
  const saveYear = (item: any) => {
    const form = drafts[item.fiscalYear] ?? item;
    saveMutation.mutate({ projectId, fiscalYear: item.fiscalYear, plannedBudget: Number(form.plannedBudget) || 0, approvedBudget: Number(form.approvedBudget) || 0, disbursedBudget: Number(form.disbursedBudget) || 0, progressPercent: Math.min(100, Math.max(0, Number(form.progressPercent) || 0)), status: form.status, note: form.note || null });
  };
  return <Card className="border-slate-200/80 shadow-sm"><CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Timeline สถานะและการเบิกจ่าย</CardTitle><p className="mt-1 text-xs text-slate-500">ติดตามงบแผน งบอนุมัติ งบเบิกจ่าย และความคืบหน้ารายปี พ.ศ. 2566–2570</p></div><div className="text-left sm:text-right"><p className="text-xs text-slate-400">เบิกจ่ายสะสม / อนุมัติ</p><p className="text-lg font-extrabold text-blue-700">{fullMoney(totalDisbursed)} <span className="text-xs font-medium text-slate-400">/ {fullMoney(totalApproved)}</span></p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${overallProgress}%` }} /></div><p className="mt-1 text-right text-[11px] text-slate-400">ความคืบหน้าภาพรวม {overallProgress.toFixed(1)}%</p></CardHeader><CardContent className="space-y-4 p-4">{rows.map(item => { const form = drafts[item.fiscalYear] ?? { plannedBudget: item.plannedBudget ?? 0, approvedBudget: item.approvedBudget ?? 0, disbursedBudget: item.disbursedBudget ?? 0, progressPercent: item.progressPercent ?? 0, status: item.status ?? "ยังไม่ระบุ", note: item.note ?? "" }; const percent = Math.min(100, Math.max(0, Number(form.progressPercent) || 0)); return <div key={item.fiscalYear} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="rounded-lg bg-blue-100 px-2.5 py-1 text-sm font-extrabold text-blue-700">พ.ศ. {item.fiscalYear}</span><Badge className={form.status === "เสร็จสิ้น" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : form.status === "ล่าช้า" ? "bg-rose-100 text-rose-700 hover:bg-rose-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>{form.status}</Badge></div>{item.tracked ? <span className="text-[11px] text-slate-400">อัปเดตแล้ว</span> : <span className="text-[11px] text-slate-400">รอข้อมูลติดตาม</span>}</div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-400">งบแผน</p><p className="mt-1 font-bold text-slate-700">{fullMoney(form.plannedBudget)}</p></div><div><p className="text-slate-400">งบอนุมัติ</p><p className="mt-1 font-bold text-slate-700">{fullMoney(form.approvedBudget)}</p></div><div><p className="text-slate-400">เบิกจ่าย</p><p className="mt-1 font-bold text-emerald-700">{fullMoney(form.disbursedBudget)}</p></div></div><div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} /></div><span className="w-12 text-right text-xs font-bold text-slate-600">{percent.toFixed(0)}%</span></div>{isAdmin && <div className="mt-4 grid gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"><div><label className="filter-label">งบแผน</label><Input value={form.plannedBudget} onChange={event => updateField(item.fiscalYear, "plannedBudget", event.target.value)} className="mt-1 h-9" inputMode="decimal" /></div><div><label className="filter-label">งบอนุมัติ</label><Input value={form.approvedBudget} onChange={event => updateField(item.fiscalYear, "approvedBudget", event.target.value)} className="mt-1 h-9" inputMode="decimal" /></div><div><label className="filter-label">เบิกจ่าย</label><Input value={form.disbursedBudget} onChange={event => updateField(item.fiscalYear, "disbursedBudget", event.target.value)} className="mt-1 h-9" inputMode="decimal" /></div><div><label className="filter-label">ความคืบหน้า (%)</label><Input value={form.progressPercent} onChange={event => updateField(item.fiscalYear, "progressPercent", event.target.value)} className="mt-1 h-9" inputMode="decimal" /></div><div><label className="filter-label">สถานะ</label><Select value={form.status} onValueChange={value => updateField(item.fiscalYear, "status", value)}><SelectTrigger className="mt-1 h-9 bg-white"><SelectValue /></SelectTrigger><SelectContent>{timelineStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2 lg:col-span-2"><label className="filter-label">หมายเหตุ</label><Input value={form.note} onChange={event => updateField(item.fiscalYear, "note", event.target.value)} className="mt-1 h-9" placeholder="เช่น อยู่ระหว่างจัดซื้อจัดจ้าง" /></div><div className="flex items-end"><Button onClick={() => saveYear(item)} disabled={saveMutation.isPending} className="h-9 w-full bg-blue-600 hover:bg-blue-700">{saveMutation.isPending ? "กำลังบันทึก..." : "บันทึกปีนี้"}</Button></div></div>}{form.note && !isAdmin && <p className="mt-3 text-xs text-slate-500">หมายเหตุ: {form.note}</p>}</div>; })}</CardContent></Card>;
}

function DetailDialog({ row, kind, onClose }: { row: any; kind: "project" | "equipment" | null; onClose: () => void }) {
  if (!row) return null;
  const isProject = kind === "project";
  return <Dialog open={Boolean(row)} onOpenChange={open => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><div className="flex items-center gap-2"><Badge className={isProject ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>{isProject ? "รายละเอียดโครงการ" : "รายละเอียดครุภัณฑ์"}</Badge>{row.isExceeded ? <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">เกินศักยภาพ</Badge> : null}</div><DialogTitle className="pt-2 text-xl leading-relaxed">{row.projectName ?? row.equipmentName}</DialogTitle></DialogHeader><div className="space-y-5"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">เป้าหมาย / ผลผลิต</p><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{row.target || "ไม่มีข้อมูลเป้าหมาย"}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{years.map(year => <div key={year} className="rounded-xl border border-slate-100 bg-white p-3"><p className="text-xs text-slate-400">พ.ศ. {year}</p><p className="mt-1 text-sm font-bold text-slate-800">{fullMoney(row[`budget${year}`])}</p></div>)}</div>      <div className="grid gap-3 sm:grid-cols-2"><div className="detail-item"><span>ยุทธศาสตร์</span><strong>{row.strategy ?? "-"}</strong></div><div className="detail-item"><span>แผนงาน</span><strong>{row.planName ?? "-"}</strong></div><div className="detail-item"><span>ส่วนราชการรับผิดชอบ</span><strong>{row.department ?? "-"}</strong></div><div className="detail-item"><span>สถานะงบประมาณ</span><strong>{row.budgetStatus ?? "-"}</strong></div><div className="detail-item"><span>ปีดำเนินการ</span><strong>{row.budgetYearReceived ?? "-"}</strong></div><div className="detail-item"><span>งบประมาณ</span><strong>{fullMoney(row.actualBudgetReceived)}</strong></div><div className="detail-item"><span>หน้า</span><strong>{row.pageNo ?? "-"}</strong></div><div className="detail-item"><span>ข้อ</span><strong>{row.itemNo ?? "-"}</strong></div><div className="detail-item"><span>เล่มแผนพัฒนา</span><strong>{row.planBook ?? "-"}</strong></div></div><p className="text-xs text-slate-400">แสดงเล่มแผนพัฒนาเพิ่มเติมเพื่อใช้ประกอบการอ้างอิงรายการโครงการ</p></div></DialogContent></Dialog>;
}

function Dashboard({ summary, onDrilldown }: { summary: any; onDrilldown: (filter: Partial<Filters>) => void }) {
  const topStrategies = summary?.byStrategy ?? [];
  const topDepartments = summary?.byDepartment ?? [];
  const topPlans = summary?.byPlan ?? [];
  return <div className="dashboard-dark space-y-8"><SectionTitle eyebrow="OVERVIEW / 2566—2570" title="ภาพรวมแผนพัฒนา" description="สรุปข้อมูลโครงการ งบประมาณ และครุภัณฑ์จากฐานข้อมูลล่าสุด" action={<Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />ข้อมูลพร้อมใช้งาน</Badge>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="โครงการทั้งหมด" value={(summary?.counts.projects ?? 0).toLocaleString("th-TH")} hint="รวมโครงการปกติและเกินศักยภาพ" icon={ClipboardList} tone="stat-blue" /><StatCard label="งบโครงการรวม" value={money(summary?.budgets.projects)} hint="งบตามแผน 5 ปี" icon={WalletCards} tone="stat-pink" /><StatCard label="ครุภัณฑ์ทั้งหมด" value={(summary?.counts.equipment ?? 0).toLocaleString("th-TH")} hint="จากบัญชีครุภัณฑ์" icon={Package} tone="stat-green" /><StatCard label="งบรวมทุกหมวด" value={money(summary?.budgets.total)} hint="โครงการ + ครุภัณฑ์" icon={Gauge} tone="stat-navy" /></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]"><Card className="chart-card"><CardHeader><CardTitle>งบประมาณโครงการรายปี</CardTitle><p className="text-xs text-slate-500">เปรียบเทียบงบประมาณตามปี พ.ศ. 2566–2570</p></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={summary?.byYear ?? []} margin={{ top: 12, right: 12, left: 12, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 12 }} /><YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={value => `${(value / 1000000).toFixed(0)} ลบ.`} width={55} /><Tooltip formatter={(value: any) => [fullMoney(value), "งบประมาณ"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} /><Line type="monotone" dataKey="budget" stroke="#4361ee" strokeWidth={4} dot={{ fill: "#4361ee", strokeWidth: 3, r: 5 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer></div></CardContent></Card><Card className="chart-card"><CardHeader><CardTitle>สถานะงบประมาณ</CardTitle><p className="text-xs text-slate-500">จำนวนรายการตามสถานะในข้อมูลนำเข้า</p></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary?.byBudgetStatus ?? []} dataKey="count" nameKey="name" innerRadius={72} outerRadius={105} paddingAngle={3}>{(summary?.byBudgetStatus ?? []).map((entry: any) => <Cell key={entry.name} fill={entry.name === "อนุมัติงบประมาณ" ? "#38bdf8" : entry.name === "ยังไม่อนุมัติงบประมาณ" ? "#f43f5e" : "#facc15"} stroke="#0e1420" strokeWidth={3} />)}</Pie><Tooltip formatter={(value: any) => [`${Number(value).toLocaleString("th-TH")} รายการ`, "จำนวน"]} contentStyle={{ background: "#111827", border: "1px solid #334155", borderRadius: 12, color: "#f8fafc" }} labelStyle={{ color: "#f8fafc" }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => <span style={{ color: value === "อนุมัติงบประมาณ" ? "#7dd3fc" : value === "ยังไม่อนุมัติงบประมาณ" ? "#fda4af" : "#fde68a" }}>{value}</span>} /></PieChart></ResponsiveContainer></div></CardContent></Card></div>
    <div className="grid gap-5 xl:grid-cols-2"><Card className="chart-card"><CardHeader><CardTitle>งบประมาณตามยุทธศาสตร์</CardTitle><p className="text-xs text-slate-500">คลิกแท่งกราฟเพื่อดูรายการโครงการที่เกี่ยวข้อง</p></CardHeader><CardContent><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={topStrategies} layout="vertical" margin={{ left: 10, right: 20, top: 10, bottom: 8 }} onClick={(state: any) => state?.activePayload?.[0]?.payload?.name && onDrilldown({ strategy: state.activePayload[0].payload.name })}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tickFormatter={value => `${(value / 1000000).toFixed(0)} ลบ.`} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#cbd5e1" }} /><Tooltip formatter={(value: any) => [fullMoney(value), "งบประมาณ"]} /><Bar dataKey="budget" radius={[0, 7, 7, 0]} cursor="pointer">{topStrategies.map((entry: any, index: number) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card><Card className="chart-card"><CardHeader><CardTitle>งบประมาณตามส่วนราชการ</CardTitle><p className="text-xs text-slate-500">คลิกส่วนราชการเพื่อเจาะลึกรายการ</p></CardHeader><CardContent><div className="h-[560px] overflow-y-auto"><div className="h-[540px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={topDepartments} layout="vertical" margin={{ left: 6, right: 18, top: 10, bottom: 8 }} onClick={(state: any) => state?.activePayload?.[0]?.payload?.name && onDrilldown({ department: state.activePayload[0].payload.name })}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis type="number" tickFormatter={value => `${(value / 1000000).toFixed(0)} ลบ.`} tick={{ fontSize: 11, fill: "#64748b" }} /><YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10, fill: "#cbd5e1" }} /><Tooltip formatter={(value: any) => [fullMoney(value), "งบประมาณ"]} /><Bar dataKey="budget" radius={[7, 7, 0, 0]} cursor="pointer">{topDepartments.map((entry: any, index: number) => <Cell key={entry.name} fill={chartColors[(index + 2) % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div></div></CardContent></Card></div>
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]"><Card className="chart-card"><CardHeader><CardTitle>สรุปตามแผนงาน</CardTitle></CardHeader><CardContent><div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">{topPlans.map((item: any, index: number) => <button key={item.name} onClick={() => onDrilldown({ planName: item.name })} className="group flex w-full items-center gap-3 text-left"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: chartColors[index % chartColors.length] }}>{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-700 group-hover:text-blue-700">{item.name}</span><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${Math.max(8, (item.budget / Math.max(topPlans[0]?.budget || 1, 1)) * 100)}%`, backgroundColor: chartColors[index % chartColors.length] }} /></span></span><span className="text-right text-sm font-bold text-slate-800">{money(item.budget)}<span className="block text-[10px] font-normal text-slate-400">{item.count} โครงการ</span></span></button>)}</div></CardContent></Card><Card className="chart-card"><CardHeader><CardTitle>ประเภทครุภัณฑ์</CardTitle><p className="text-xs text-slate-500">จำนวนและงบประมาณตามประเภท</p></CardHeader><CardContent><div className="h-[560px] overflow-y-auto"><div className="h-[540px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary?.equipmentByType ?? []} layout="vertical" margin={{ left: 6, right: 18, top: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} /><YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10, fill: "#cbd5e1" }} /><Tooltip formatter={(value: any, name: string) => [name === "count" ? `${value} รายการ` : fullMoney(value), name === "count" ? "จำนวน" : "งบประมาณ"]} /><Bar dataKey="count" fill="#06d6a0" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></div></CardContent></Card></div>
  </div>;
}

function AdminPanel({ isAdmin, onImported }: { isAdmin: boolean; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const importMutation = trpc.admin.importExcel.useMutation();
  const history = trpc.admin.importHistory.useQuery(undefined, { enabled: isAdmin });
  const submit = async () => {
    if (!file) return toast.error("กรุณาเลือกไฟล์ Excel ก่อน");
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) return toast.error("รองรับเฉพาะไฟล์ Excel เท่านั้น");
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) { for (let cursor = index; cursor < Math.min(index + chunk, bytes.length); cursor += 1) binary += String.fromCharCode(bytes[cursor]); }
      const result = await importMutation.mutateAsync({ fileName: file.name, fileBase64: btoa(binary) });
      toast.success(`นำเข้าข้อมูลสำเร็จ: ${result.projectRows + result.exceededRows} โครงการ และ ${result.equipmentRows} ครุภัณฑ์`);
      setFile(null); onImported(); history.refetch();
    } catch (error: any) { toast.error(error?.message ?? "นำเข้าข้อมูลไม่สำเร็จ"); } finally { setBusy(false); }
  };
  if (!isAdmin) return <Card className="border-rose-100 bg-rose-50/50"><CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center"><ShieldCheck className="h-12 w-12 text-rose-400" /><h3 className="mt-4 text-lg font-bold text-slate-800">พื้นที่สำหรับผู้ดูแลระบบ</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">การอัปโหลดและรีเฟรชข้อมูลจำกัดเฉพาะบัญชีเจ้าของระบบเท่านั้น หากเป็นเจ้าของระบบ กรุณาเข้าสู่ระบบก่อน</p><Button onClick={() => startLogin()} className="mt-5 bg-slate-950 hover:bg-slate-800"><LogIn className="mr-2 h-4 w-4" />เข้าสู่ระบบผู้ดูแล</Button></CardContent></Card>;
  return <div className="space-y-6"><SectionTitle eyebrow="ADMIN / DATA MANAGEMENT" title="จัดการข้อมูลระบบ" description="อัปโหลด Excel เพื่อแทนที่ข้อมูลเดิมทั้งชุด โดยระบบจะตรวจสอบชื่อชีทและบันทึกประวัติการนำเข้า" /><Card className="border-slate-200/80 shadow-sm"><CardContent className="p-6"><div className="upload-zone"><FileSpreadsheet className="h-11 w-11 text-emerald-500" /><h3 className="mt-4 font-bold text-slate-800">เลือกไฟล์ Excel แผนพัฒนา</h3><p className="mt-1 text-sm text-slate-500">ต้องมี 3 ชีท: บัญชีโครงการ, โครงการเกินศักยภาพ และ บัญชีครุภัณฑ์</p><label className="mt-5 inline-flex cursor-pointer items-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"><Upload className="mr-2 h-4 w-4" />{file ? file.name : "เลือกไฟล์ .xlsx"}<input type="file" accept=".xlsx,.xls" className="hidden" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>{file && <Button onClick={submit} disabled={busy} className="ml-2 bg-emerald-600 hover:bg-emerald-700">{busy ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}{busy ? "กำลังนำเข้า..." : "ยืนยันการรีเฟรชข้อมูล"}</Button>}<p className="mt-4 text-xs text-amber-600">ข้อควรระวัง: การนำเข้าไฟล์ใหม่จะแทนที่ข้อมูลโครงการและครุภัณฑ์ในระบบทั้งหมด</p><div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-left text-xs leading-6 text-blue-800"><strong>การอัปเดต Timeline:</strong> ไปที่เมนูค้นหาโครงการ แล้วคลิกแถวโครงการที่ต้องการ ระบบจะแสดง Timeline พ.ศ. 2566–2570 ให้กรอกงบอนุมัติ เบิกจ่าย เปอร์เซ็นต์ความคืบหน้า สถานะ และหมายเหตุแยกตามปี</div></div></CardContent></Card><Card className="border-slate-200/80 shadow-sm"><CardHeader><CardTitle className="text-base">ประวัติการนำเข้า</CardTitle></CardHeader><CardContent>{(history.data ?? []).length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีประวัติการนำเข้า</p> : <div className="space-y-3">{history.data?.map(item => <div key={item.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-800">{item.fileName}</p><p className="text-xs text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString("th-TH") : "-"} · โดย {item.uploadedBy ?? "-"}</p></div><div className="flex gap-2 text-xs"><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{item.projectRows + item.exceededRows} โครงการ</Badge><Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{item.equipmentRows} ครุภัณฑ์</Badge></div></div>)}</div>}</CardContent></Card></div>;
}

export default function Home() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<any>(null);
  const [selectedKind, setSelectedKind] = useState<"project" | "equipment" | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const summary = trpc.dashboard.summary.useQuery();
  const utils = trpc.useUtils();
  const projectInput = useMemo(() => filters, [filters]);
  const equipmentInput = useMemo(() => ({ search: filters.search, planName: filters.planName, department: filters.department, budgetStatus: filters.budgetStatus, budgetYear: filters.budgetYear, planBook: filters.planBook, pageNo: filters.pageNo, itemNo: filters.itemNo, equipmentType: filters.equipmentType, sortBy: filters.sortBy, sortDir: filters.sortDir, page: filters.page, pageSize: filters.pageSize }), [filters]);
  const projects = trpc.catalog.projects.useQuery(projectInput, { enabled: view === "projects" });
  const equipment = trpc.catalog.equipment.useQuery(equipmentInput, { enabled: view === "equipment" });
  const patchFilters = (next: Filters) => setFilters(next);
  const reset = () => setFilters({ ...emptyFilters });
  const drilldown = (partial: Partial<Filters>) => { setFilters({ ...emptyFilters, ...partial }); setView("projects"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const exportCsv = async (kind: "projects" | "equipment") => {
    try {
      const query = kind === "projects" ? await utils.catalog.exportProjects.fetch(filters) : await utils.catalog.exportEquipment.fetch(equipmentInput);
      const rows = query.rows as any[];
      if (!rows.length) return toast.info("ไม่มีข้อมูลสำหรับส่งออก");
      const headers = Object.keys(rows[0]).filter(key => !["id", "createdAt"].includes(key));
      const labels: Record<string, string> = { codeId: "รหัส ID", projectName: "ชื่อโครงการ", equipmentName: "ชื่อครุภัณฑ์", strategy: "ยุทธศาสตร์", planName: "แผนงาน", target: "เป้าหมาย", department: "ส่วนราชการรับผิดชอบ", pageNo: "หน้า", itemNo: "ข้อ", totalBudget: "งบรวม 5 ปี", budget2566: "2566", budget2567: "2567", budget2568: "2568", budget2569: "2569", isExceeded: "เกินศักยภาพ" };
      const csv = [headers.map(header => labels[header] ?? header), ...rows.map(row => headers.map(header => `"${String(row[header] ?? "").replace(/"/g, '""')}"`))].map(line => line.join(",")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${kind === "projects" ? "โครงการ" : "ครุภัณฑ์"}-แผนพัฒนา.csv`; link.click(); URL.revokeObjectURL(url);
    } catch { toast.error("ส่งออกข้อมูลไม่สำเร็จ"); }
  };
  const fetchExportRows = async (kind: "projects" | "equipment") => {
    const query = kind === "projects" ? await utils.catalog.exportProjects.fetch(filters) : await utils.catalog.exportEquipment.fetch(equipmentInput);
    return query.rows as any[];
  };
  const exportExcel = async (kind: "projects" | "equipment") => {
    setExportBusy(true);
    try {
      const rows = await fetchExportRows(kind);
      if (!rows.length) return toast.info("ไม่มีข้อมูลสำหรับส่งออก");
      downloadExcel(kind, rows);
      toast.success(`สร้างไฟล์ Excel แล้ว ${rows.length.toLocaleString("th-TH")} รายการ`);
    } catch (error: any) {
      toast.error(error?.message ?? "ส่งออก Excel ไม่สำเร็จ");
    } finally {
      setExportBusy(false);
    }
  };
  const exportPdf = async (kind: "projects" | "equipment") => {
    setExportBusy(true);
    try {
      const rows = await fetchExportRows(kind);
      if (!rows.length) return toast.info("ไม่มีข้อมูลสำหรับส่งออก");
      printPdf(kind, rows);
      toast.success("เปิดหน้าพิมพ์ PDF แล้ว กรุณาเลือก Save as PDF");
    } catch (error: any) {
      toast.error(error?.message ?? "ส่งออก PDF ไม่สำเร็จ");
    } finally {
      setExportBusy(false);
    }
  };
  const changeView = (next: View) => { setView(next); if (next === "dashboard") reset(); };
  const pageTitle = view === "dashboard" ? "ภาพรวมแผนพัฒนา" : view === "projects" ? "สืบค้นโครงการ" : view === "equipment" ? "สืบค้นครุภัณฑ์" : "จัดการข้อมูล";
  return <div className={`app-shell ${view === "dashboard" ? "overview-shell" : ""}`}><header className="app-header sticky top-0 z-40"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-7"><div className="flex min-w-0 items-center gap-3"><img src="/manus-storage/1000048796_47746527.png" alt="โลโก้กองยุทธศาสตร์และงบประมาณ" className="h-10 w-10 rounded-full object-cover border border-white/20 shadow-sm" /><div className="min-w-0"><p className="truncate text-sm font-extrabold text-white sm:text-base">ระบบสืบค้นข้อมูลแผนพัฒนาท้องถิ่น 2566-2570 และที่เพิ่มเติม</p><p className="truncate text-[10px] text-white/55 sm:text-xs">LOCAL DEVELOPMENT PLAN / 2566—2570 + เพิ่มเติม</p></div></div><div className="hidden max-w-xl flex-1 text-center lg:block"><p className="credit-line">จัดทำโดย ฝ่ายแผนงานและงบประมาณ กองยุทธศาสตร์และงบประมาณ By.เดอะจอร์จ</p></div><div className="flex items-center gap-2"><span className="hidden text-xs text-white/65 sm:inline">{user ? `สวัสดี ${user.name ?? "ผู้ดูแล"}` : "ผู้ใช้งานทั่วไป"}</span>{user ? <Button variant="outline" size="sm" onClick={() => setView("admin")} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Admin</Button> : <Button variant="outline" size="sm" onClick={() => startLogin()} className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"><LogIn className="mr-1.5 h-3.5 w-3.5" />เข้าสู่ระบบ</Button>}</div></div><div className="border-t border-white/10 lg:hidden"><p className="credit-line mx-auto max-w-[1500px] px-4 py-2 sm:px-7">จัดทำโดย ฝ่ายแผนงานและงบประมาณ กองยุทธศาสตร์และงบประมาณ By.เดอะจอร์จ</p></div></header>
    <div className="mx-auto flex max-w-[1500px] flex-col lg:flex-row"><aside className="sidebar-nav border-b border-slate-200 bg-white lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:w-[245px] lg:shrink-0 lg:border-b-0 lg:border-r"><div className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-2 lg:p-4"><p className="hidden px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 lg:block">เมนูหลัก</p>{([{ id: "dashboard", label: "แดชบอร์ดภาพรวม", icon: LayoutDashboard }, { id: "projects", label: "ค้นหาโครงการ", icon: ClipboardList }, { id: "equipment", label: "ค้นหาครุภัณฑ์", icon: Package }, { id: "admin", label: "จัดการข้อมูล", icon: Database }] as { id: View; label: string; icon: any }[]).map(item => <button key={item.id} onClick={() => changeView(item.id)} className={`nav-item ${view === item.id ? "nav-item-active" : ""}`}><item.icon className="h-4 w-4" /><span>{item.label}</span>{item.id === "admin" && !user ? <span className="ml-auto text-[10px] text-slate-400">ล็อกอิน</span> : null}</button>)}</div><div className="hidden border-t border-slate-100 px-6 py-5 lg:block"><p className="text-xs font-semibold text-slate-500">ขอบเขตข้อมูล</p><p className="mt-2 text-xs leading-5 text-slate-400">แผนพัฒนาท้องถิ่น<br />พ.ศ. 2566–2570<br />ข้อมูลจาก Excel ล่าสุด</p></div></aside><main className={`min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-9 ${view === "dashboard" ? "overview-main" : ""}`}><div className="mb-7 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{view === "dashboard" ? "CONTROL CENTER" : "DATA EXPLORER"}</p><h1 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">{pageTitle}</h1></div>{view !== "dashboard" && <Button variant="outline" className="bg-white" onClick={() => changeView("dashboard")}><ArrowUpRight className="mr-2 h-4 w-4 rotate-[-45deg]" />กลับภาพรวม</Button>}</div>
      {view === "dashboard" && <Dashboard summary={summary.data} onDrilldown={drilldown} />}
      {view === "projects" && <div className="space-y-5"><SectionTitle eyebrow="PROJECT EXPLORER" title="ค้นหาโครงการ" description="ค้นหาและกรองโครงการจากยุทธศาสตร์ แผนงาน ส่วนราชการ ปีงบประมาณ และเล่มแผน" /><FilterPanel filters={filters} setFilters={patchFilters} options={summary.data?.options ?? {}} onReset={reset} />{projects.isLoading ? <div className="loading-card"><RefreshCw className="h-6 w-6 animate-spin text-blue-600" />กำลังโหลดรายการโครงการ...</div> : <ProjectsTable rows={projects.data?.rows ?? []} total={projects.data?.total ?? 0} filters={filters} setFilters={patchFilters} onDetail={row => { setSelected(row); setSelectedKind("project"); }} onExport={() => exportCsv("projects")} onExportExcel={() => exportExcel("projects")} onExportPdf={() => exportPdf("projects")} exportBusy={exportBusy} />}</div>}
      {view === "equipment" && <div className="space-y-5"><SectionTitle eyebrow="EQUIPMENT EXPLORER" title="ค้นหาครุภัณฑ์" description="ดูจำนวน ประเภท งบประมาณ ส่วนราชการ และจุดอ้างอิงของครุภัณฑ์" /><FilterPanel filters={filters} setFilters={patchFilters} options={summary.data?.options ?? {}} onReset={reset} />{equipment.isLoading ? <div className="loading-card"><RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />กำลังโหลดรายการครุภัณฑ์...</div> : <EquipmentTable rows={equipment.data?.rows ?? []} total={equipment.data?.total ?? 0} filters={filters} setFilters={patchFilters} onDetail={row => { setSelected(row); setSelectedKind("equipment"); }} onExport={() => exportCsv("equipment")} onExportExcel={() => exportExcel("equipment")} onExportPdf={() => exportPdf("equipment")} exportBusy={exportBusy} />}</div>}
      {view === "admin" && <AdminPanel isAdmin={user?.role === "admin"} onImported={() => { summary.refetch(); projects.refetch(); equipment.refetch(); }} />}
      <DetailDialog row={selected} kind={selectedKind} onClose={() => { setSelected(null); setSelectedKind(null); }} />
      <footer className="mt-12 border-t border-slate-200 py-6 text-center"><p className="text-xs font-medium text-slate-500">จัดทำโดย ฝ่ายแผนงานและงบประมาณ กองยุทธศาสตร์และงบประมาณ By.เดอะจอร์จ</p><p className="mt-1 text-[10px] text-slate-400">ระบบสืบค้นข้อมูลแผนพัฒนาท้องถิ่น 2566-2570 และที่เพิ่มเติม</p></footer></main></div></div>;
}
