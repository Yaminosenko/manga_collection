"use client";

import { useEffect, type RefObject } from "react";

import { VARIABLE_HAUTEUR_BANDEAU } from "@/lib/constants";

export function useHauteurBandeau(bandeau: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = bandeau.current;
    if (element === null) {
      return;
    }

    const poser = () => {
      document.documentElement.style.setProperty(
        VARIABLE_HAUTEUR_BANDEAU,
        `${element.offsetHeight}px`,
      );
    };

    poser();
    const observateur = new ResizeObserver(poser);
    observateur.observe(element);

    return () => {
      observateur.disconnect();
      document.documentElement.style.removeProperty(VARIABLE_HAUTEUR_BANDEAU);
    };
  }, [bandeau]);
}
