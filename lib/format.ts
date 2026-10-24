const heDate = new Intl.DateTimeFormat("he-IL", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
});

const heDateTime = new Intl.DateTimeFormat("he-IL", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const heMonth = new Intl.DateTimeFormat("he-IL", {
  month: "long",
  year: "numeric",
});

export function formatDate(value: Date | string) {
  return heDate.format(new Date(value));
}

export function formatDateTime(value: Date | string) {
  return heDateTime.format(new Date(value));
}

function clock12AndPeriod(hour: number) {
  if (hour === 0) return { clock12: 12, period: "בלילה" };
  if (hour < 5) return { clock12: hour, period: "בלילה" };
  if (hour < 12) return { clock12: hour, period: "בבוקר" };
  if (hour === 12) return { clock12: 12, period: "בצהריים" };
  if (hour < 17) return { clock12: hour - 12, period: "בצהריים" };
  return { clock12: hour - 12, period: "בערב" };
}

export function formatClock24(hour: number, minute = 0) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatSpokenTime(hour: number, minute = 0) {
  const { clock12, period } = clock12AndPeriod(hour);
  const minutePart = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${clock12}${minutePart} ${period}`;
}

export function formatTime(value: Date | string) {
  const date = new Date(value);
  const hour = date.getHours();
  const minute = date.getMinutes();
  return `${formatClock24(hour, minute)} · ${formatSpokenTime(hour, minute)}`;
}

export function parseTimeInput(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hour: hours, minute: minutes };
}

export function formatMonth(year: number, month: number) {
  return heMonth.format(new Date(year, month - 1, 1));
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatHours(hours: number) {
  return `${hours.toLocaleString("he-IL", { maximumFractionDigits: 2 })} שעות`;
}

export function toTimeInput(value: Date) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeLocal(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1);
}

export function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export function ageOn(birthDate: Date, onDate = new Date()) {
  let age = onDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = onDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("972") && digits.length >= 11) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith("0")) {
    return digits;
  }
  return digits;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  submitted: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
  scheduled: "משובץ",
  swapped: "הוחלף",
  cancelled: "בוטל",
  open: "פתוח",
  taken: "נלקחה",
  expired: "פג תוקף",
};

export const ROLE_LABELS: Record<string, string> = {
  worker: "עובד",
  manager: "מנהל",
};
