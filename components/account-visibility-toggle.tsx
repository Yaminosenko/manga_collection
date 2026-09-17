"use client";

import { useState, useTransition } from "react";
import { changerVisibilite } from "@/lib/auth-actions";
import { CLASSE_MENTION } from "@/components/champ";
import {
  LIBELLE_VISIBLE_DANS_COMMUNAUTE,
  MENTION_VISIBILITE_ACTIVE,
  MENTION_VISIBILITE_COUPEE,
} from "@/lib/constants";

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
    <div className="flex flex-col gap-[8px]">
      <button
        type="button"
        role="switch"
        aria-checked={actif}
        disabled={enregistrement}
        onClick={basculer}
        className="bg-surface flex min-h-11 items-center justify-between gap-[12px] rounded-md px-[14px] text-left text-[13px] text-text transition-opacity disabled:opacity-50"
      >
        {LIBELLE_VISIBLE_DANS_COMMUNAUTE}
        <span
          aria-hidden="true"
          className={`flex h-[24px] w-[42px] flex-none items-center rounded-full p-[3px] transition-colors ${
            actif ? "bg-accent" : "bg-neutral-800"
          }`}
        >
          <span
            className={`size-[18px] rounded-full bg-text transition-transform ${
              actif ? "translate-x-[18px]" : ""
            }`}
          />
        </span>
      </button>

      <p className={CLASSE_MENTION}>
        {actif ? MENTION_VISIBILITE_ACTIVE : MENTION_VISIBILITE_COUPEE}
      </p>
    </div>
  );
}
