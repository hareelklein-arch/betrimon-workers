import { requireManager } from "@/lib/auth";
import { NotificationsView } from "@/components/notifications-page";

export default async function ManagerNotificationsPage() {
  const user = await requireManager();
  return <NotificationsView userId={user.id} />;
}
