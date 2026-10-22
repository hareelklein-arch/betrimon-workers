import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { formatMonth } from "@/lib/format";
import { payrollReport } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "manager") {
    return new Response("אין הרשאה", { status: 401 });
  }

  const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || new Date().getMonth() + 1;
  const report = await payrollReport(year, month);

  const header = ["שם", "טלפון", "שעות", "סהכ לתשלום", "פרטי תשלום"];
  const lines = [
    header.join(","),
    ...report.workers.map((row) =>
      [
        csv(row.user.name),
        csv(row.user.phone),
        row.hours.toString(),
        row.amount.toFixed(2),
        csv(row.user.profile?.bankDetails || ""),
      ].join(","),
    ),
    ["סהכ", "", report.totalHours.toString(), report.totalAmount.toFixed(2), ""].join(","),
  ];

  const bom = "\uFEFF";
  const filename = `payroll-${year}-${String(month).padStart(2, "0")}.csv`;
  return new Response(bom + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(`שכר-${formatMonth(year, month)}.csv`)}`,
    },
  });
}

function csv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
