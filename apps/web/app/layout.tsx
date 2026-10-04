import type { ReactNode } from "react";
import { I18nProvider } from "../lib/i18n";
import "./globals.css";

export const metadata = { title: "AIBuddy", description: "Học AI cùng con – hiểu AI và biết dùng AI an toàn", manifest: "/manifest.webmanifest" };
export const viewport = { themeColor: "#2563eb", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
