import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatMonth } from "@/lib/format";
import { buildPayrollPdf } from "@/lib/payroll-pdf";
import { payrollReport } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "manager") {
    return new Response("אין הרשאה", { status: 401 });
  }

  const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || new Date().getMonth() + 1;
  const report = await payrollReport(year, month);
  const bytes = await buildPayrollPdf(report);
  const filename = `שכר-${formatMonth(year, month)}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="payroll-${year}-${String(month).padStart(2, "0")}.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
