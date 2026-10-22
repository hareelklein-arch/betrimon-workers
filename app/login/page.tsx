import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/forms";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === "manager" ? "/manager" : "/worker");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="card w-full p-6">
        <p className="text-sm text-[var(--muted)]">בית רימון</p>
        <h1 className="mb-2 text-3xl font-black">ניהול עובדים ושכר</h1>
        <p className="mb-5 text-[var(--muted)]">נכנסים עם מספר הטלפון. במצב פיתוח הקוד הוא 123456.</p>
        <LoginForm />
        <div className="mt-6 rounded-2xl bg-[#eef4ef] p-4 text-sm">
          <p className="font-bold">חשבונות דמו</p>
          <p>מנהל: 0500000001</p>
          <p>עובדים: 0500000002, 0500000003, 0500000004</p>
        </div>
      </div>
    </div>
  );
}
