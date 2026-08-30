import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { GuestBanner } from "@/components/guest-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { roleCourant } from "@/lib/guard";
import {
  COULEUR_FOND_APPLICATION,
  LARGEUR_MAX_APPLICATION,
  NOM_APPLICATION_COURT,
} from "@/lib/constants";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: NOM_APPLICATION_COURT,
  description: "Suivi de collection de mangas, tome par tome",
  applicationName: NOM_APPLICATION_COURT,
  appleWebApp: {
    capable: true,
    title: NOM_APPLICATION_COURT,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: COULEUR_FOND_APPLICATION,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const role = await roleCourant();
  return (
    <html lang="fr" className={`${inter.variable} h-full`}>
      <body className="bg-bg text-text min-h-full pt-[env(safe-area-inset-top)] antialiased">
        <div
          className="mx-auto w-full"
          style={{ maxWidth: LARGEUR_MAX_APPLICATION }}
        >
          <OfflineBanner />
          {role === "invite" ? <GuestBanner /> : null}
          {children}
        </div>
      </body>
    </html>
  );
}
