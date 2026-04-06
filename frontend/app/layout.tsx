import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwingMaster AI — Swing Trade Alert System",
  description: "AI-powered swing trading alerts for US stocks. Conservative, beginner-friendly, real-time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-base text-text-primary antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
