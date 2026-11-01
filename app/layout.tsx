import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { Suspense } from "react";
import { WaitHost } from "@/components/please-wait";
import { RegisterSW } from "@/components/register-sw";
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
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f6f4a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>
        {children}
        <RegisterSW />
        <Suspense fallback={null}>
          <WaitHost />
        </Suspense>
      </body>
    </html>
  );
}
