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
    const position = lire(cle);
    if (position !== null) {
      window.scrollTo(0, position);
    }

    const surDefilement = () => memoriser(cle, window.scrollY);
    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => window.removeEventListener("scroll", surDefilement);
  }, [cle]);
}
