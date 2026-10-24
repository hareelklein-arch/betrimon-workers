"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full p-6">
        <h1 className="text-2xl font-black">שגיאה אחרי הכניסה</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm">{error.message}</p>
        {error.digest ? <p className="mt-2 text-xs text-[var(--muted)]">digest: {error.digest}</p> : null}
        <button className="btn mt-4" type="button" onClick={() => reset()}>
          ניסיון נוסף
        </button>
      </div>
    </div>
  );
}
