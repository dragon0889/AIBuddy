import type { ReactNode } from "react";

export const metadata = { title: "AIBuddy", description: "Học AI cùng con – an toàn, vui, hiểu sâu" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", fontSize: 18, margin: 0, padding: 24 }}>{children}</body>
    </html>
  );
}
