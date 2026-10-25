"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { sendDateChatAction } from "@/lib/actions";
import { PleaseWait, busy, waitLabel } from "@/components/please-wait";

export function ChatRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 6000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}

export function ChatForm({ workDateKey }: { workDateKey: string }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="sticky bottom-24 mt-4 grid gap-2"
      action={(formData) => {
        busy(start, async () => {
          const result = await sendDateChatAction(formData);
          setError(result.ok ? "" : result.error);
          const form = document.querySelector("form.sticky") as HTMLFormElement | null;
          if (result.ok) form?.reset();
        });
      }}
    >
      <input type="hidden" name="workDateKey" value={workDateKey} />
      <label className="field">
        <textarea name="body" rows={2} placeholder="למשל: אני יכול/ה מ-16:00 עד 19:00" aria-label="הודעה" required />
      </label>
      <PleaseWait show={pending} />
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      <button className="btn" disabled={pending}>
        {waitLabel(pending, "שליחה")}
      </button>
    </form>
  );
}
