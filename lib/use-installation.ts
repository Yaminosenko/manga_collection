"use client";

import { useSyncExternalStore } from "react";
import {
  CLE_GLOBALE_INSTALLATION,
  CLE_STOCKAGE_INSTALLATION,
  DELAI_RELANCE_INSTALLATION_MS,
  DELAI_REPLI_INSTALLATION_MS,
  REPORTS_INSTALLATION_MAX,
  REQUETE_AUTONOME,
} from "@/lib/constants";

type InviteInstallation = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InviteInstallation;
  }
}

export type FormeInvite =
  | "aucune"
  | "invite"
  | "menu-chrome"
  | "geste-safari"
  | "geste-ios-autre"
  | "webview";

type Plateforme =
  | "serveur"
  | "webview"
  | "ios-safari"
  | "ios-autre"
  | "chromium"
  | "autre";

type ReportInstallation = { installee: boolean; reports: number; dernierLe: number };

const REPORT_VIERGE: ReportInstallation = { installee: false, reports: 0, dernierLe: 0 };

const OUVERTURE = Date.now();

const abonnes = new Set<() => void>();

let brutEnCache: string | null = null;
let reportEnCache: ReportInstallation = REPORT_VIERGE;
let brutLu = false;
let plateformeEnCache: Plateforme | null = null;
let repliAtteint = false;
let minuterieRepli: ReturnType<typeof setTimeout> | null = null;
let ecouteInstallation = false;

function notifier(): void {
  for (const abonne of abonnes) {
    abonne();
  }
}

function lireBrut(): string | null {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE_INSTALLATION);
  } catch {
    return null;
  }
}

function analyser(brut: string | null): ReportInstallation {
  if (!brut) {
    return REPORT_VIERGE;
  }
  try {
    const valeur = JSON.parse(brut) as ReportInstallation;
    return typeof valeur.installee === "boolean" &&
      Number.isFinite(valeur.reports) &&
      Number.isFinite(valeur.dernierLe)
      ? valeur
      : REPORT_VIERGE;
  } catch {
    return REPORT_VIERGE;
  }
}

function report(): ReportInstallation {
  const brut = lireBrut();
  if (!brutLu || brut !== brutEnCache) {
    brutLu = true;
    brutEnCache = brut;
    reportEnCache = analyser(brut);
  }
  return reportEnCache;
}

function memoriser(valeur: ReportInstallation): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE_INSTALLATION, JSON.stringify(valeur));
  } catch {
    brutLu = true;
    brutEnCache = null;
    reportEnCache = valeur;
  }
  notifier();
}

function detecter(): Plateforme {
  const agent = navigator.userAgent;
  if (/; wv\)/.test(agent)) {
    return "webview";
  }
  if (/iPhone|iPad|iPod/.test(agent)) {
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(agent) ? "ios-autre" : "ios-safari";
  }
  if (/Chrome\//.test(agent)) {
    return "chromium";
  }
  return "autre";
}

function plateforme(): Plateforme {
  if (plateformeEnCache === null) {
    plateformeEnCache = detecter();
  }
  return plateformeEnCache;
}

function invite(): InviteInstallation | null {
  const fenetre = window as unknown as Record<string, InviteInstallation | null>;
  return fenetre[CLE_GLOBALE_INSTALLATION] ?? null;
}

function oublierInvite(): void {
  const fenetre = window as unknown as Record<string, InviteInstallation | null>;
  fenetre[CLE_GLOBALE_INSTALLATION] = null;
}

function estAutonome(): boolean {
  const autonome = window.matchMedia(REQUETE_AUTONOME).matches;
  const iOS = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return autonome || iOS;
}

function souscrire(surChangement: () => void): () => void {
  abonnes.add(surChangement);
  window.addEventListener("beforeinstallprompt", surChangement);
  window.addEventListener("storage", surChangement);
  const media = window.matchMedia(REQUETE_AUTONOME);
  media.addEventListener("change", surChangement);
  if (!ecouteInstallation) {
    ecouteInstallation = true;
    window.addEventListener("appinstalled", surInstallation);
  }
  if (!repliAtteint && minuterieRepli === null) {
    minuterieRepli = setTimeout(() => {
      repliAtteint = true;
      notifier();
    }, DELAI_REPLI_INSTALLATION_MS);
  }
  return () => {
    abonnes.delete(surChangement);
    window.removeEventListener("beforeinstallprompt", surChangement);
    window.removeEventListener("storage", surChangement);
    media.removeEventListener("change", surChangement);
  };
}

function surInstallation(): void {
  oublierInvite();
  memoriser({ ...report(), installee: true });
}

function instantane(): FormeInvite {
  const memoire = report();
  if (memoire.installee || estAutonome()) {
    return "aucune";
  }
  if (memoire.reports >= REPORTS_INSTALLATION_MAX) {
    return "aucune";
  }
  if (memoire.dernierLe > 0 && OUVERTURE - memoire.dernierLe < DELAI_RELANCE_INSTALLATION_MS) {
    return "aucune";
  }
  if (invite() !== null) {
    return "invite";
  }
  switch (plateforme()) {
    case "webview":
      return "webview";
    case "ios-safari":
      return "geste-safari";
    case "ios-autre":
      return "geste-ios-autre";
    case "chromium":
      return repliAtteint ? "menu-chrome" : "aucune";
    default:
      return "aucune";
  }
}

function instantaneServeur(): FormeInvite {
  return "aucune";
}

function reporter(): void {
  const memoire = report();
  memoriser({ ...memoire, reports: memoire.reports + 1, dernierLe: Date.now() });
}

function installer(): void {
  const demande = invite();
  if (demande === null) {
    return;
  }
  void demande.prompt();
  void demande.userChoice
    .then((choix) => {
      oublierInvite();
      if (choix.outcome === "dismissed") {
        reporter();
        return;
      }
      notifier();
    })
    .catch(() => {
      oublierInvite();
      notifier();
    });
}

export function useInviteInstallation(): {
  forme: FormeInvite;
  installer: () => void;
  reporter: () => void;
} {
  const forme = useSyncExternalStore(souscrire, instantane, instantaneServeur);
  return { forme, installer, reporter };
}
