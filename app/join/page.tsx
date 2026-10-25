import { JoinForm } from "@/components/join-form";
import { isValidJoinToken } from "@/lib/join";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const token = (await searchParams).t || "";
  if (!isValidJoinToken(token)) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="card w-full p-6">
          <h1 className="text-2xl font-black">הקישור לא תקין</h1>
          <p className="mt-2 text-[var(--muted)]">בקשו מהמנהלת קישור רישום חדש.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <JoinForm token={token} />
    </div>
  );
}
