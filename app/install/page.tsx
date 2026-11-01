import { InstallApp } from "@/components/install-app";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "התקנת אפליקציית בית רימון",
  description: "הוספת האפליקציה למסך הבית בטלפון",
  appleWebApp: {
    capable: true,
    title: "עובדים",
  },
};

export default function InstallPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-8">
      <div className="w-full">
        <InstallApp />
      </div>
    </div>
  );
}
