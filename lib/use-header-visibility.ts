"use client";

import { useEffect, useState, type RefObject } from "react";

const DEFILEMENT_MINIMAL = 8;
const DELAI_RESTAURATION_MS = 150;

export function useEnTeteEscamotable(
  reference: RefObject<HTMLElement | null>,
  cle: string,
): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let dernier = window.scrollY;
    let restauration = true;
    const finRestauration = window.setTimeout(() => {
      restauration = false;
    }, DELAI_RESTAURATION_MS);

    const surDefilement = () => {
      const courant = window.scrollY;
      const delta = courant - dernier;

      if (restauration) {
        dernier = courant;
        return;
      }

      if (courant <= (reference.current?.offsetHeight ?? 0)) {
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

    window.addEventListener("scroll", surDefilement, { passive: true });
    return () => {
      window.clearTimeout(finRestauration);
      window.removeEventListener("scroll", surDefilement);
    };
  }, [reference, cle]);

  return visible;
}
