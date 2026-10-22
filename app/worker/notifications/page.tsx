import { requireUser } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications-page";

export default async function WorkerNotificationsPage() {
  const user = await requireUser();
  return <NotificationsView userId={user.id} />;
}
