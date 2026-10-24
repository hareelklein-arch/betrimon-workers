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
  const title = `דוח שכר · ${formatMonth(year, month)}`;

  const rows = report.workers.map((row) => {
    const method = row.user.profile?.paymentMethod === "bank" ? "העברה בנקאית" : "ביט";
    const details = row.user.profile?.bankDetails?.trim();
    return {
      name: row.user.name,
      hours: row.hours,
      amount: row.amount,
      payment: details ? `${method}: ${details}` : method,
    };
  });

  const table = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="utf-8" />
<style>
  table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 14px; direction: rtl; }
  caption { font-size: 18px; font-weight: 800; padding: 8px; text-align: right; }
  th, td { border: 1px solid #1f3d2b; padding: 8px 12px; vertical-align: middle; }
  th { background: #e7f3ea; font-weight: 800; text-align: center; }
  td.name { font-weight: 700; text-align: right; }
  td.num { text-align: left; mso-number-format: '#,##0.00'; }
  td.pay { text-align: right; mso-number-format: '\\@'; }
  tr.total td { background: #d9ead3; font-weight: 800; }
</style>
</head>
<body>
<table>
  <caption>${escapeHtml(title)}</caption>
  <thead>
    <tr>
      <th>שם</th>
      <th>שעות עבודה</th>
      <th>שכר</th>
      <th>פרטי תשלום</th>
    </tr>
  </thead>
  <tbody>
    ${rows
      .map(
        (row) => `
    <tr>
      <td class="name">${escapeHtml(row.name)}</td>
      <td class="num">${row.hours.toFixed(2)}</td>
      <td class="num">${row.amount.toFixed(2)}</td>
      <td class="pay">${escapeHtml(row.payment)}</td>
    </tr>`,
      )
      .join("")}
    <tr class="total">
      <td class="name">סה״כ</td>
      <td class="num">${report.totalHours.toFixed(2)}</td>
      <td class="num">${report.totalAmount.toFixed(2)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
</body>
</html>`;

  const filename = `שכר-${formatMonth(year, month)}.xls`;
  return new Response(table, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="payroll-${year}-${String(month).padStart(2, "0")}.xls"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
