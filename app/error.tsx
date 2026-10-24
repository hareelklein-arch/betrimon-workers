"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full p-6">
        <h1 className="text-2xl font-black">משהו השתבש אחרי הכניסה</h1>
        <p className="mt-2 text-[var(--muted)]">רעננו את הדף, ואם זה חוזר בדקו שחיבור Supabase ב-Vercel כולל pgbouncer=true.</p>
        <button className="btn mt-4" type="button" onClick={() => reset()}>
          ניסיון נוסף
        </button>
      </div>
    </div>
  );
}
