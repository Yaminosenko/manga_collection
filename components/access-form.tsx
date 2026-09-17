"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CLASSE_BOUTON, CLASSE_BOUTON_DISCRET, Champ } from "@/components/champ";
import { seConnecter } from "@/lib/auth-actions";
import {
  CHEMIN_INSCRIPTION,
  LIBELLE_DEVERROUILLER,
  LIBELLE_IDENTIFIANT,
  LIBELLE_MOT_DE_PASSE,
  LIBELLE_VERS_INSCRIPTION,
} from "@/lib/constants";
import type { EtatAcces } from "@/lib/domain";

export function AccessForm() {
  const [etat, action, enCours] = useActionState<EtatAcces, FormData>(seConnecter, {
    erreur: null,
  });

  return (
    <form action={action} className="flex w-full flex-col gap-[12px]">
      <Champ
        nom="identifiant"
        libelle={LIBELLE_IDENTIFIANT}
        autoComplete="username"
        autoFocus
      />
      <Champ
        nom="motDePasse"
        libelle={LIBELLE_MOT_DE_PASSE}
        type="password"
        autoComplete="current-password"
      />

      <button type="submit" disabled={enCours} className={CLASSE_BOUTON}>
        {LIBELLE_DEVERROUILLER}
      </button>

      {etat.erreur ? (
        <p className="text-center text-[13px] text-neutral-400">{etat.erreur}</p>
      ) : null}

      <Link href={CHEMIN_INSCRIPTION} className={`${CLASSE_BOUTON_DISCRET} text-center`}>
        {LIBELLE_VERS_INSCRIPTION}
      </Link>
    </form>
  );
}
