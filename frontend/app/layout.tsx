import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import TopNav from "@/components/TopNav";
import "./globals.css";

const jbMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MathBridge — FCTM",
  description: "Turn implementation into intuition.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${jbMono.variable} h-full antialiased`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full bg-white text-[#1D1D1F]" style={{ fontFamily: "Pretendard, -apple-system, system-ui, sans-serif" }}>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
