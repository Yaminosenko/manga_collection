"use client";

import { useSyncExternalStore } from "react";
import {
  CLE_STOCKAGE_TRI,
  CROISSANT_PAR_DEFAUT,
  TRIS,
  TRI_PAR_DEFAUT,
  type CleTri,
} from "@/lib/constants";

export type PreferenceTri = { tri: CleTri; croissant: boolean };

const PREFERENCE_PAR_DEFAUT: PreferenceTri = {
  tri: TRI_PAR_DEFAUT,
  croissant: CROISSANT_PAR_DEFAUT[TRI_PAR_DEFAUT],
};

const abonnes = new Set<() => void>();

let brutEnCache: string | null = null;
let preferenceEnCache: PreferenceTri = PREFERENCE_PAR_DEFAUT;

function analyser(brut: string | null): PreferenceTri {
  if (!brut) {
    return PREFERENCE_PAR_DEFAUT;
  }
  try {
    const valeur = JSON.parse(brut) as PreferenceTri;
    return TRIS.some((option) => option.cle === valeur.tri) &&
      typeof valeur.croissant === "boolean"
      ? valeur
      : PREFERENCE_PAR_DEFAUT;
  } catch {
    return PREFERENCE_PAR_DEFAUT;
  }
}

function lireBrut(): string | null {
  try {
    return window.localStorage.getItem(CLE_STOCKAGE_TRI);
  } catch {
    return null;
  }
}

function notifier(): void {
  for (const abonne of abonnes) {
    abonne();
  }
}

function souscrire(surChangement: () => void): () => void {
  abonnes.add(surChangement);
  window.addEventListener("storage", surChangement);
  return () => {
    abonnes.delete(surChangement);
    window.removeEventListener("storage", surChangement);
  };
}

function instantane(): PreferenceTri {
  const brut = lireBrut();
  if (brut !== brutEnCache) {
    brutEnCache = brut;
    preferenceEnCache = analyser(brut);
  }
  return preferenceEnCache;
}

function instantaneServeur(): PreferenceTri {
  return PREFERENCE_PAR_DEFAUT;
}

function memoriser(preference: PreferenceTri): void {
  try {
    window.localStorage.setItem(CLE_STOCKAGE_TRI, JSON.stringify(preference));
  } catch {
    brutEnCache = null;
    preferenceEnCache = preference;
  }
  notifier();
}

export function usePreferenceTri(): [PreferenceTri, (preference: PreferenceTri) => void] {
  const preference = useSyncExternalStore(souscrire, instantane, instantaneServeur);
  return [preference, memoriser];
}
