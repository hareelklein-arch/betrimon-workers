import { redirect } from "next/navigation";
import { demoAuthEnabled, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/forms";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "manager" ? "/manager" : "/worker");
  }

  const demo = demoAuthEnabled();

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full p-6">
        <p className="text-sm text-[var(--muted)]">בית רימון</p>
        <h1 className="mb-2 text-3xl font-black">ניהול עובדים ושכר</h1>
        <p className="mb-5 text-[var(--muted)]">נכנסים עם שם משתמש וסיסמה.</p>
        <LoginForm />
        {demo ? (
          <div className="mt-6 rounded-2xl bg-[#eef4ef] p-4 text-sm">
            <p className="font-bold">חשבונות דמו</p>
            <p>מנהלת: avigail / betrimon</p>
            <p>עובדים: liam, noam, hadar, ariel, mika, ido, rotem, guy</p>
            <p>סיסמה לכולם: betrimon</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
