"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  CLES_STOCKAGE_TRI,
  CROISSANT_PAR_DEFAUT,
  TRIS_PAR_PANNEAU,
  TRI_PAR_DEFAUT,
  type CleTri,
  type ClePanneau,
} from "@/lib/constants";

export type PreferenceTri = { tri: CleTri; croissant: boolean };

const PREFERENCE_PAR_DEFAUT: PreferenceTri = {
  tri: TRI_PAR_DEFAUT,
  croissant: CROISSANT_PAR_DEFAUT[TRI_PAR_DEFAUT],
};

const abonnes = new Set<() => void>();
const brutsEnCache = new Map<string, string | null>();
const preferencesEnCache = new Map<string, PreferenceTri>();

function analyser(brut: string | null, panneau: ClePanneau): PreferenceTri {
  if (!brut) {
    return PREFERENCE_PAR_DEFAUT;
  }
  try {
    const valeur = JSON.parse(brut) as PreferenceTri;
    return TRIS_PAR_PANNEAU[panneau].includes(valeur.tri) &&
      typeof valeur.croissant === "boolean"
      ? valeur
      : PREFERENCE_PAR_DEFAUT;
  } catch {
    return PREFERENCE_PAR_DEFAUT;
  }
}

function lireBrut(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
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

function instantane(panneau: ClePanneau): PreferenceTri {
  const cle = CLES_STOCKAGE_TRI[panneau];
  const brut = lireBrut(cle);
  if (brut !== brutsEnCache.get(cle)) {
    brutsEnCache.set(cle, brut);
    preferencesEnCache.set(cle, analyser(brut, panneau));
  }
  return preferencesEnCache.get(cle) ?? PREFERENCE_PAR_DEFAUT;
}

function memoriser(panneau: ClePanneau, preference: PreferenceTri): void {
  const cle = CLES_STOCKAGE_TRI[panneau];
  try {
    window.localStorage.setItem(cle, JSON.stringify(preference));
  } catch {
    brutsEnCache.set(cle, null);
    preferencesEnCache.set(cle, preference);
  }
  notifier();
}

function instantaneServeur(): PreferenceTri {
  return PREFERENCE_PAR_DEFAUT;
}

export function usePreferenceTri(
  panneau: ClePanneau,
): [PreferenceTri, (preference: PreferenceTri) => void] {
  const lire = useCallback(() => instantane(panneau), [panneau]);
  const ecrire = useCallback(
    (preference: PreferenceTri) => memoriser(panneau, preference),
    [panneau],
  );
  return [useSyncExternalStore(souscrire, lire, instantaneServeur), ecrire];
}
