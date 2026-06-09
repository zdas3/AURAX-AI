import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AURAX AI | Institutional Gold Trading Intelligence Platform",
  description: "Futuristic institutional-grade Gold (XAUUSD) trading platform combining Smart Money Concepts (SMC), ICT, technical analysis indicators, news sentiment, and ensemble AI forecasts.",
  keywords: "XAUUSD, Gold trading, AI trading, Smart Money Concepts, SMC, Forex AI, Trading terminal",
  authors: [{ name: "Aurax Intelligence Team" }]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col bg-obsidian-950 text-gray-100 font-sans selection:bg-gold-500 selection:text-obsidian-950">
        {children}
      </body>
    </html>
  );
}
