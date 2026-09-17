"use client";

import { useEffect, type RefObject } from "react";

import { PANNEAUX, type ClePanneau } from "@/lib/constants";

export function indexDuPanneau(cle: ClePanneau): number {
  return PANNEAUX.findIndex((option) => option.cle === cle);
}

export function comportementDefilement(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function usePanneauVisible(
  piste: RefObject<HTMLElement | null>,
  panneauInitial: ClePanneau,
  surChangement: (cle: ClePanneau) => void,
): void {
  useEffect(() => {
    const rail = piste.current;
    if (rail === null) {
      return;
    }

    rail.scrollTo({ left: indexDuPanneau(panneauInitial) * rail.clientWidth });

    const surDefilement = () => {
      const atteint = PANNEAUX[Math.round(rail.scrollLeft / rail.clientWidth)];
      if (atteint === undefined) {
        return;
      }
      surChangement(atteint.cle);
      if (window.location.pathname !== atteint.route) {
        window.history.replaceState(null, "", atteint.route);
      }
    };

    rail.addEventListener("scroll", surDefilement, { passive: true });
    return () => rail.removeEventListener("scroll", surDefilement);
  }, [piste, panneauInitial, surChangement]);
}
