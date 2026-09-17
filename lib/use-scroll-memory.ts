"use client";

import { useEffect, type RefObject } from "react";

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

export function useMemoireDefilement(
  reference: RefObject<HTMLElement | null>,
  cle: string,
): void {
  useEffect(() => {
    const scroller = reference.current;
    if (scroller === null) {
      return;
    }

    const position = lire(cle) ?? 0;
    let restauration = position !== scroller.scrollTop;

    if (restauration) {
      scroller.scrollTo(0, position);
    }

    const surDefilement = () => {
      if (restauration) {
        restauration = false;
        return;
      }
      memoriser(cle, scroller.scrollTop);
    };

    scroller.addEventListener("scroll", surDefilement, { passive: true });
    return () => scroller.removeEventListener("scroll", surDefilement);
  }, [reference, cle]);
}
