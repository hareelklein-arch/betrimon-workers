"use client";

import { useEffect, useState } from "react";
import {
  isAppInstalled,
  notificationsAllowed,
  notificationsUndecided,
  promptNotificationsIfNeeded,
} from "@/lib/push-client";
import { PleaseWait, waitLabel } from "@/components/please-wait";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function SetupNudge() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [notifyOk, setNotifyOk] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function refresh() {
    const appInstalled = isAppInstalled();
    const allowed = notificationsAllowed();
    setInstalled(appInstalled);
    setNotifyOk(allowed);
    setIosHint(/iphone|ipad|ipod/i.test(navigator.userAgent) && !appInstalled);
    setReady(true);
  }

  useEffect(() => {
    refresh();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function ask() {
      if (cancelled || !notificationsUndecided()) return;
      const result = await promptNotificationsIfNeeded();
      if (cancelled) return;
      refresh();
      if (!result.ok && Notification.permission === "denied") {
        setMessage("אפשר לאשר התראות אחר כך בהגדרות הדפדפן.");
      }
    }

    const timer = window.setTimeout(() => {
      void ask();
    }, 400);
    const onFirstGesture = () => {
      void ask();
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true, capture: true });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onFirstGesture, { capture: true });
    };
  }, []);

  if (!ready || (installed && notifyOk)) return null;

  async function installApp() {
    if (!installEvent) return;
    setPending(true);
    setMessage("");
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setPending(false);
    if (choice.outcome === "accepted") setInstalled(true);
    refresh();
  }

  return (
    <section className="card mb-5 border-[var(--primary)] bg-[#e7f3ea] p-4">
      <h3 className="text-lg font-extrabold">התקינו את האפליקציה ואשרו התראות</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        בכניסה הראשונה יופיע חלון של הדפדפן לאישור התראות. כדי לקבל שיבוצים ועדכונים בטלפון צריך גם להוסיף למסך הבית. אחרי
        שעושים את זה פעם אחת, ההודעה לא תופיע בכניסה הבאה.
      </p>
      <ul className="mt-3 grid gap-1 text-sm font-bold">
        <li>{installed ? "נוספה למסך הבית" : "עדיין לא במסך הבית"}</li>
        <li>{notifyOk ? "התראות אושרו" : "ממתינים לאישור התראות של הדפדפן"}</li>
      </ul>
      <PleaseWait show={pending} />
      {!installed && installEvent ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={pending} onClick={installApp}>
            {waitLabel(pending, "הוספה למסך הבית")}
          </button>
        </div>
      ) : null}
      {!installed && iosHint ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          באייפון: כפתור שיתוף ← «הוספה למסך הבית», ואז פותחים מהאייקון החדש.
        </p>
      ) : null}
      {!installed && !installEvent && !iosHint ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          בדפדפן: תפריט ← «הוספה למסך הבית» / «התקנת אפליקציה», ואז פותחים משם.
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm font-bold text-[var(--danger)]">{message}</p> : null}
    </section>
  );
}
