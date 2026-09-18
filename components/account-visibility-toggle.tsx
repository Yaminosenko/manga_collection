"use client";

import { useState, useTransition } from "react";
import { changerVisibilite } from "@/lib/auth-actions";
import { LIBELLE_VISIBLE_DANS_COMMUNAUTE } from "@/lib/constants";

export function AccountVisibilityToggle({ visible }: { visible: boolean }) {
  const [actif, setActif] = useState(visible);
  const [enregistrement, demarrer] = useTransition();

  function basculer() {
    const souhaite = !actif;
    setActif(souhaite);
    demarrer(async () => {
      await changerVisibilite(souhaite);
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      disabled={enregistrement}
      onClick={basculer}
      className="bg-surface text-text flex min-h-11 items-center justify-between gap-[12px] rounded-md px-[14px] text-left text-[13px] transition-opacity disabled:opacity-50"
    >
      {LIBELLE_VISIBLE_DANS_COMMUNAUTE}
      <span
        aria-hidden="true"
        className={`flex h-[24px] w-[42px] flex-none items-center rounded-full p-[3px] transition-colors ${
          actif ? "bg-accent" : "bg-neutral-800"
        }`}
      >
        <span
          className={`bg-text size-[18px] rounded-full transition-transform ${
            actif ? "translate-x-[18px]" : ""
          }`}
        />
      </span>
    </button>
  );
}
