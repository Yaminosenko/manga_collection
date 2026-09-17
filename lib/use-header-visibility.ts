"use client";

import { useEffect, useState, type RefObject } from "react";

const DEFILEMENT_MINIMAL = 8;
const DELAI_RESTAURATION_MS = 150;

export function useEnTeteEscamotable(
  bandeau: RefObject<HTMLElement | null>,
  scroller: RefObject<HTMLElement | null>,
  cle: string,
): boolean {
  const [visible, setVisible] = useState(true);
  const [clePrecedente, setClePrecedente] = useState(cle);

  if (clePrecedente !== cle) {
    setClePrecedente(cle);
    setVisible(true);
  }

  useEffect(() => {
    const cible = scroller.current;
    if (cible === null) {
      return;
    }

    let dernier = cible.scrollTop;
    let restauration = true;
    const finRestauration = window.setTimeout(() => {
      restauration = false;
    }, DELAI_RESTAURATION_MS);

    const surDefilement = () => {
      const courant = cible.scrollTop;
      const delta = courant - dernier;

      if (restauration) {
        dernier = courant;
        return;
      }

      if (courant <= (bandeau.current?.offsetHeight ?? 0)) {
        setVisible(true);
        dernier = courant;
        return;
      }

      if (Math.abs(delta) < DEFILEMENT_MINIMAL) {
        return;
      }

      setVisible(delta < 0);
      dernier = courant;
    };

    cible.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      window.clearTimeout(finRestauration);
      cible.removeEventListener("scroll", surDefilement);
    };
  }, [bandeau, scroller, cle]);

  return visible;
}
