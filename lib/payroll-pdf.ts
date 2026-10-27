import { readFile } from "fs/promises";
import path from "path";
import * as fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatMonth } from "@/lib/format";

type Report = {
  year: number;
  month: number;
  totalHours: number;
  totalAmount: number;
  workers: {
    hours: number;
    amount: number;
    user: {
      name: string;
      profile?: { paymentMethod: string | null; bankDetails: string | null } | null;
    };
  }[];
};

function visualLine(text: string) {
  const tokens = text.match(/[\u0590-\u05FF]+|[^\u0590-\u05FF]+/g) ?? [text];
  return tokens
    .map((token) => (/[\u0590-\u05FF]/.test(token) ? Array.from(token).reverse().join("") : token))
    .reverse()
    .join("");
}

function fitText(font: PDFFont, text: string, size: number, maxWidth: number) {
  let value = visualLine(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) {
    value = value.slice(1);
  }
  return `${value}...`;
}

function drawRight(page: PDFPage, font: PDFFont, text: string, right: number, y: number, size: number, maxWidth: number) {
  const value = fitText(font, text, size, maxWidth);
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: right - width, y, size, font, color: rgb(0.11, 0.16, 0.14) });
}

export async function buildPayrollPdf(report: Report) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(path.join(process.cwd(), "lib/fonts/NotoSansHebrew-Regular.ttf"));
  const font = await pdf.embedFont(fontBytes);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const title = `דוח שכר · ${formatMonth(report.year, report.month)}`;
  const columns = [
    { key: "name" as const, title: "שם", width: 130 },
    { key: "hours" as const, title: "שעות עבודה", width: 90 },
    { key: "amount" as const, title: "שכר", width: 90 },
    { key: "payment" as const, title: "פרטי תשלום", width: 223 },
  ];
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const tableRight = margin + tableWidth;
  const rowHeight = 22;
  const headerFill = rgb(0.9, 0.95, 0.91);
  const totalFill = rgb(0.85, 0.92, 0.83);
  const line = rgb(0.12, 0.24, 0.17);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 48;

  drawRight(page, font, title, tableRight, y, 16, tableWidth);
  y -= 28;
  drawRight(page, font, "בית רימון — שעות מאושרות לתשלום", tableRight, y, 10, tableWidth);
  y -= 24;

  function ensureRow(fill?: ReturnType<typeof rgb>) {
    if (y < margin + rowHeight + 16) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - 48;
      drawHeader();
    }
    if (fill) {
      page.drawRectangle({
        x: margin,
        y: y - 6,
        width: tableWidth,
        height: rowHeight,
        color: fill,
      });
    }
  }

  function drawHeader() {
    page.drawRectangle({
      x: margin,
      y: y - 6,
      width: tableWidth,
      height: rowHeight,
      color: headerFill,
      borderColor: line,
      borderWidth: 0.6,
    });
    let right = tableRight;
    for (const col of columns) {
      page.drawRectangle({
        x: right - col.width,
        y: y - 6,
        width: col.width,
        height: rowHeight,
        borderColor: line,
        borderWidth: 0.6,
      });
      drawRight(page, font, col.title, right - 8, y, 10, col.width - 16);
      right -= col.width;
    }
    y -= rowHeight;
  }

  function drawRow(values: string[], fill?: ReturnType<typeof rgb>) {
    ensureRow(fill);
    let right = tableRight;
    columns.forEach((col, index) => {
      page.drawRectangle({
        x: right - col.width,
        y: y - 6,
        width: col.width,
        height: rowHeight,
        borderColor: line,
        borderWidth: 0.6,
      });
      drawRight(page, font, values[index] || "", right - 8, y, 10, col.width - 16);
      right -= col.width;
    });
    y -= rowHeight;
  }

  drawHeader();

  for (const row of report.workers) {
    const method = row.user.profile?.paymentMethod === "bank" ? "העברה בנקאית" : "ביט";
    const details = row.user.profile?.bankDetails?.trim();
    drawRow([
      row.user.name,
      row.hours.toFixed(2),
      row.amount.toFixed(2),
      details ? `${method}: ${details}` : method,
    ]);
  }

  drawRow(["סה״כ", report.totalHours.toFixed(2), report.totalAmount.toFixed(2), ""], totalFill);

  return pdf.save();
}
