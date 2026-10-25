import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Suspense } from "react";
import { WaitHost } from "@/components/please-wait";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "בית רימון — עובדים",
  description: "ניהול משמרות, שעות ושכר לבני נוער ביישוב",
  applicationName: "בית רימון עובדים",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "עובדים",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f6f4a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>
        {children}
        <Suspense fallback={null}>
          <WaitHost />
        </Suspense>
      </body>
    </html>
  );
}
