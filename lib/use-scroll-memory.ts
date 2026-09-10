"use client";

import { useEffect } from "react";

function lire(cle: string): number | null {
  try {
    const brut = window.sessionStorage.getItem(cle);
    if (brut === null) {
      return null;
    }
    const position = Number(brut);
    return Number.isFinite(position) && position >= 0 ? position : null;
  } catch {
    return null;
  }
}

function memoriser(cle: string, position: number): void {
  try {
    window.sessionStorage.setItem(cle, String(position));
  } catch {
    return;
  }
}

export function useMemoireDefilement(cle: string): void {
  useEffect(() => {
    window.scrollTo(0, lire(cle) ?? 0);

    const surDefilement = () => memoriser(cle, window.scrollY);
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => window.removeEventListener("scroll", surDefilement);
  }, [cle]);
}
