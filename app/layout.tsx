import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { OfflineBanner } from "@/components/offline-banner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Collection",
  description: "Suivi de collection de mangas, tome par tome",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="bg-bg text-text min-h-full antialiased">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
