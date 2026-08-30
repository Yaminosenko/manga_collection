"use client";

import { useActionState } from "react";
import { deverrouiller } from "@/lib/auth-actions";
import { LIBELLE_DEVERROUILLER, LIBELLE_MOT_DE_PASSE } from "@/lib/constants";
import type { EtatAcces } from "@/lib/domain";

export function AccessForm() {
  const [etat, action, enCours] = useActionState<EtatAcces, FormData>(deverrouiller, {
    erreur: null,
  });

  return (
    <form action={action} className="flex w-full flex-col gap-[12px]">
      <input
        type="password"
        name="motDePasse"
        autoComplete="current-password"
        aria-label={LIBELLE_MOT_DE_PASSE}
        placeholder={LIBELLE_MOT_DE_PASSE}
        required
        autoFocus
        className="bg-surface text-text min-h-11 w-full rounded-md border border-neutral-800 px-[14px] text-[14px] placeholder:text-neutral-600 focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={enCours}
        className="border-accent text-accent flex min-h-11 w-full items-center justify-center rounded-md border text-[14px] font-medium tracking-[0.06em] uppercase transition-colors hover:bg-accent/12 active:bg-accent/22 disabled:opacity-50"
      >
        {LIBELLE_DEVERROUILLER}
      </button>
      {etat.erreur ? (
        <p className="text-center text-[13px] text-neutral-400">{etat.erreur}</p>
      ) : null}
    </form>
  );
}
