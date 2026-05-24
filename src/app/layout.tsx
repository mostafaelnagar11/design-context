import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Design Context",
  description: "Your design system. Inside Claude.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
