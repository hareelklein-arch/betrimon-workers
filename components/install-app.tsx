"use client";

import { useEffect, useState } from "react";
import { isAppInstalled } from "@/lib/push-client";
import { PleaseWait, waitLabel } from "@/components/please-wait";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function inAppBrowser() {
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat|TikTok|; wv\)|; wv /i.test(ua)) return true;
  const ios = /iPad|iPhone|iPod/i.test(ua);
  if (ios && !/Safari/i.test(ua)) return true;
  return false;
}

function openInChrome() {
  const url = window.location.href.replace(/^https?:\/\//, "");
  window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function InstallApp() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (isAppInstalled()) {
      window.location.replace("/");
      return;
    }
    setInstalled(false);
    setIos(/iphone|ipad|ipod/i.test(ua));
    setAndroid(/android/i.test(ua));
    setEmbedded(inAppBrowser());
    setReady(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      window.location.replace("/");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installNow() {
    if (!installEvent) return;
    setPending(true);
    setMessage("");
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setPending(false);
    if (choice.outcome === "accepted") {
      setInstalled(true);
    } else {
      setMessage("ההתקנה בוטלה. אפשר לנסות שוב מהכפתור.");
    }
  }

  if (!ready) return null;

  if (installed) {
    return (
      <div className="card p-6">
        <h1 className="text-3xl font-black">האפליקציה כבר במסך הבית</h1>
        <p className="mt-3 text-[var(--muted)]">פתחו אותה מהאייקון החדש בטלפון, לא מהדפדפן.</p>
        <a href="/" className="btn mt-5 w-full">
          כניסה
        </a>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <p className="text-sm text-[var(--muted)]">בית רימון</p>
      <h1 className="mt-1 text-3xl font-black">התקנת האפליקציה</h1>
      <p className="mt-3 text-[var(--muted)]">
        זה מוסיף את האפליקציה למסך הבית. אחרי ההתקנה פותחים משם — מסך מלא, בלי דפדפן.
      </p>

      {embedded ? (
        <div className="mt-5 rounded-2xl bg-[#fff4e5] p-4">
          <p className="font-extrabold">זה נפתח מתוך וואטסאפ</p>
          <p className="mt-2 text-sm">כדי להתקין צריך לפתוח בדפדפן, ואז לוחצים התקנה.</p>
          {android ? (
            <button type="button" className="btn mt-4 w-full" onClick={openInChrome}>
              פתיחה בכרום להתקנה
            </button>
          ) : (
            <p className="mt-3 text-sm font-bold">
              לחצו על ⋯ למטה ← «פתיחה ב-Safari», ואז הוסיפו למסך הבית.
            </p>
          )}
        </div>
      ) : null}

      <PleaseWait show={pending} />

      {!embedded && installEvent ? (
        <button type="button" className="btn mt-5 w-full" disabled={pending} onClick={installNow}>
          {waitLabel(pending, "התקנה עכשיו")}
        </button>
      ) : null}

      {!embedded && ios ? (
        <ol className="mt-5 grid gap-3 text-sm font-bold">
          <li>1. לחצו על כפתור השיתוף (הריבוע עם החץ) למטה.</li>
          <li>2. גללו ובחרו «הוספה למסך הבית».</li>
          <li>3. לחצו «הוסף», ופתחו מהאייקון החדש.</li>
        </ol>
      ) : null}

      {!embedded && android && !installEvent ? (
        <p className="mt-5 text-sm font-bold">
          בכרום: תפריט ⋮ למעלה ← «התקנת אפליקציה» / «הוספה למסך הבית».
        </p>
      ) : null}

      {!embedded && !ios && !android && !installEvent ? (
        <p className="mt-5 text-sm font-bold">פתחו את הקישור הזה בטלפון כדי להתקין.</p>
      ) : null}

      {message ? <p className="mt-4 text-sm font-bold text-[var(--danger)]">{message}</p> : null}
    </div>
  );
}
