import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#05070b] px-4 text-slate-100">
      <Card className="w-full max-w-lg border border-[#243049] bg-[#0e1420] shadow-2xl shadow-black/40">
        <CardContent className="pb-8 pt-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-rose-500/15" />
              <AlertCircle className="relative h-16 w-16 text-rose-400" />
            </div>
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-400">ระบบสืบค้นข้อมูลแผนพัฒนาท้องถิ่น</p>
          <h1 className="mb-2 text-4xl font-bold text-white">404</h1>
          <h2 className="mb-4 text-xl font-semibold text-slate-200">ไม่พบหน้าที่ต้องการ</h2>
          <p className="mb-8 leading-relaxed text-slate-400">
            ขออภัย ไม่พบหน้าหรือเส้นทางที่คุณกำลังเปิด
            <br />
            กรุณากลับไปยังหน้าภาพรวมของระบบ
          </p>
          <Button onClick={handleGoHome} className="rounded-lg bg-sky-500 px-6 py-2.5 text-slate-950 shadow-md transition-all duration-200 hover:bg-sky-400 hover:shadow-lg">
            <Home className="mr-2 h-4 w-4" />
            กลับหน้าภาพรวม
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
