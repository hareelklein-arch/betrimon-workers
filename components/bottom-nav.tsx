"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string };

function matchingHref(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [clicked, setClicked] = useState<string | null>(null);

  useEffect(() => {
    setClicked(null);
  }, [pathname]);

  const current = clicked ?? matchingHref(pathname, items);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--line)] bg-[var(--card)]/95 backdrop-blur">
      <div
        className="mx-auto grid max-w-5xl gap-1 px-2 py-2"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = current === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-wait
              aria-current={active ? "page" : undefined}
              onClick={() => setClicked(item.href)}
              className="tab-link px-2 text-xs sm:text-sm"
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
