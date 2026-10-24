import * as XLSX from "xlsx";

export type ParsedScheduleRow = {
  line: number;
  date: Date | null;
  dateRaw: string;
  jobName: string;
  siteName: string;
  workerNames: string[];
  traineeNames: string[];
};

export type ScheduleParseResult = {
  rows: ParsedScheduleRow[];
  error?: string;
};

const HEADER_MAP: Record<string, string> = {
  תאריך: "date",
  date: "date",
  יום: "date",
  "סוג עבודה": "job",
  עבודה: "job",
  סוג: "job",
  job: "job",
  מקום: "site",
  מיקום: "site",
  site: "site",
  עובדים: "workers",
  שמות: "workers",
  names: "workers",
  עובד: "name",
  שם: "name",
  name: "name",
  מתלמדים: "trainees",
  trainees: "trainees",
  מתלמד: "trainee",
  trainee: "trainee",
  הערות: "notes",
  notes: "notes",
};

export function decodeTableBytes(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer);
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  return buffer.toString("utf8");
}

export function isSpreadsheetBinary(buffer: Buffer) {
  return (
    (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) ||
    (buffer.length >= 8 && buffer[0] === 0xd0 && buffer[1] === 0xcf)
  );
}

export function parseScheduleTable(grid: unknown[][]) {
  const table = grid
    .map((row) => (Array.isArray(row) ? row.map(cellToText) : []))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (table.length < 2) {
    return { rows: [], error: "הטבלה ריקה. צריך שורת כותרות ולפחות שורת שיבוץ אחת." } satisfies ScheduleParseResult;
  }

  const header = table[0].map(normalizeHeader);
  const cols = header.map((title) => HEADER_MAP[title] ?? "");
  if (!cols.includes("date") || !cols.includes("job") || !cols.includes("site")) {
    return {
      rows: [],
      error: "חסרות כותרות. צריך לפחות: תאריך, סוג עבודה, מקום, ועמודת עובדים או שם.",
    } satisfies ScheduleParseResult;
  }
  if (!cols.includes("workers") && !cols.includes("name")) {
    return {
      rows: [],
      error: "חסרה עמודת עובדים. השתמשו ב«עובדים» (כמה שמות) או ב«שם» (שם אחד בכל שורה).",
    } satisfies ScheduleParseResult;
  }

  const rows: ParsedScheduleRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const line = table[i];
    const get = (key: string) => {
      const index = cols.indexOf(key);
      return index === -1 ? "" : (line[index] ?? "").trim();
    };
    const dateRaw = get("date");
    const jobName = get("job");
    const siteName = get("site");
    const workerNames = splitNames(get("workers"));
    const traineeNames = splitNames(get("trainees"));
    const singleName = get("name");
    const traineeCell = get("trainee");

    if (singleName) {
      if (isYesValue(traineeCell)) traineeNames.push(singleName);
      else workerNames.push(singleName);
    } else if (traineeCell && !isYesNoValue(traineeCell)) {
      traineeNames.push(...splitNames(traineeCell));
    }

    rows.push({
      line: i + 1,
      date: parseFlexibleDate(dateRaw),
      dateRaw,
      jobName,
      siteName,
      workerNames: uniqueNames(workerNames),
      traineeNames: uniqueNames(traineeNames.filter((name) => !workerNames.includes(name))),
    });
  }

  return { rows } satisfies ScheduleParseResult;
}

export function parseCsvGrid(text: string) {
  const rows = parseDelimited(text);
  return parseScheduleTable(rows);
}

export function parseFlexibleDate(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return ymd(year, Number(dmy[2]), Number(dmy[1]));
  }
  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
    const date = new Date(utc);
    return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  return null;
}

export function foldName(value: string) {
  return value.replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function matchNamed<T extends { name: string }>(name: string, items: T[]) {
  const target = foldName(name);
  if (!target) return null;
  const exact = items.filter((item) => foldName(item.name) === target);
  if (exact.length === 1) return exact[0];
  const loose = items.filter((item) => {
    const n = foldName(item.name);
    return n.includes(target) || target.includes(n);
  });
  return loose.length === 1 ? loose[0] : null;
}

function cellToText(cell: unknown) {
  if (cell == null || cell === "") return "";
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(cell.getDate()).padStart(2, "0")}`;
  }
  if (typeof cell === "number") {
    if (cell > 20000 && cell < 80000 && Number.isInteger(cell)) {
      const utc = Date.UTC(1899, 11, 30) + cell * 86400000;
      const date = new Date(utc);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }
    return String(cell);
  }
  return String(cell).trim();
}

function normalizeHeader(value: string) {
  return value.replace(/^\ufeff/, "").replace(/[\u200e\u200f*]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function splitNames(value: string) {
  return uniqueNames(
    value
      .split(/[,;|/+\n]+/)
      .map((part) => part.replace(/^ו[\s-]+/, "").trim())
      .filter(Boolean),
  );
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = foldName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name.trim());
  }
  return out;
}

function isYesValue(value: string) {
  return ["כן", "yes", "true", "1", "v", "✔", "✓"].includes(foldName(value));
}

function isNoValue(value: string) {
  return ["לא", "no", "false", "0", ""].includes(foldName(value));
}

function isYesNoValue(value: string) {
  return isYesValue(value) || isNoValue(value);
}

export async function readScheduleFile(buffer: Buffer, filename: string): Promise<ScheduleParseResult> {
  if (isSpreadsheetBinary(buffer) || /\.xlsx?$/i.test(filename)) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return { rows: [], error: "הקובץ ריק." };
      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: "",
      }) as unknown[][];
      return parseScheduleTable(grid);
    } catch {
      return { rows: [], error: "לא הצלחנו לקרוא את קובץ האקסל. שמרו כ-CSV והעלו שוב." };
    }
  }
  return parseCsvGrid(decodeTableBytes(buffer));
}

function ymd(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(year, month - 1, day);
}

function parseDelimited(text: string) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const comma = (firstLine.match(/,/g) ?? []).length;
  const semi = (firstLine.match(/;/g) ?? []).length;
  const delim = semi > comma ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      pushCell();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      continue;
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
}
