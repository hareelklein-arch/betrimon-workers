const TZ = "Asia/Jerusalem";

function part(value: Date, type: Intl.DateTimeFormatPartTypes) {
  const found = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value)
    .find((item) => item.type === type);
  return Number(found?.value || 0);
}

export function israelNowParts(now = new Date()) {
  return {
    year: part(now, "year"),
    month: part(now, "month"),
    day: part(now, "day"),
    hour: part(now, "hour"),
  };
}

export function addIsraelDays(parts: { year: number; month: number; day: number }, days: number) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function israelDateKey(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
