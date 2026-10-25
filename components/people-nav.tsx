import Link from "next/link";

export const PEOPLE_TABS = [
  { id: "workers", label: "עובדים", title: "עובדים", subtitle: "הוספה, עריכה ומחיקה של עובדים ומנהלים." },
  { id: "sites", label: "מקומות", title: "מקומות עבודה", subtitle: "המקומות שאליהם משבצים." },
  { id: "jobs", label: "סוגי עבודה", title: "סוגי עבודה", subtitle: "ניקיון, שמירה ושאר הסוגים." },
  { id: "rates", label: "תעריפים", title: "תעריפים", subtitle: "שכר לשעה לפי סוג עבודה, עובד או גיל." },
] as const;

export type PeopleTab = (typeof PEOPLE_TABS)[number]["id"];

export function parsePeopleTab(value?: string): PeopleTab {
  return PEOPLE_TABS.some((tab) => tab.id === value) ? (value as PeopleTab) : "workers";
}

export function PeopleNav({ current }: { current: PeopleTab }) {
  return (
    <nav className="sticky top-0 z-10 mb-4 grid grid-cols-4 gap-1 bg-[var(--bg)]/95 py-2 backdrop-blur">
      {PEOPLE_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/manager/people?tab=${tab.id}`}
          className={`btn px-1 text-xs sm:px-2 sm:text-sm ${current === tab.id ? "" : "btn-secondary"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
