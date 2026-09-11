"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CLASSE_BOUTON, CLASSE_BOUTON_DISCRET, Champ } from "@/components/champ";
import { sInscrire } from "@/lib/auth-actions";
import {
  CHEMIN_ACCES,
  LIBELLE_CREER_COMPTE,
  LIBELLE_EMAIL,
  LIBELLE_IDENTIFIANT,
  LIBELLE_MOT_DE_PASSE,
  LIBELLE_MOT_DE_PASSE_CONFIRMATION,
  LIBELLE_VERS_ACCES,
  MENTION_EMAIL_INSCRIPTION,
} from "@/lib/constants";
import type { EtatInscription } from "@/lib/domain";

export function SignupForm() {
  const [etat, action, enCours] = useActionState<EtatInscription, FormData>(sInscrire, {
    erreur: null,
    identifiant: "",
    email: "",
  });

  return (
    <form action={action} className="flex w-full flex-col gap-[12px]">
      <Champ
        nom="identifiant"
        libelle={LIBELLE_IDENTIFIANT}
        autoComplete="username"
        valeurInitiale={etat.identifiant}
        autoFocus
      />
      <Champ
        nom="email"
        libelle={LIBELLE_EMAIL}
        type="email"
        autoComplete="email"
        valeurInitiale={etat.email}
        mention={MENTION_EMAIL_INSCRIPTION}
      />
      <Champ
        nom="motDePasse"
        libelle={LIBELLE_MOT_DE_PASSE}
        type="password"
        autoComplete="new-password"
      />
      <Champ
        nom="confirmation"
        libelle={LIBELLE_MOT_DE_PASSE_CONFIRMATION}
        type="password"
        autoComplete="new-password"
      />

      <button type="submit" disabled={enCours} className={CLASSE_BOUTON}>
        {LIBELLE_CREER_COMPTE}
      </button>

      {etat.erreur ? (
        <p className="text-center text-[13px] text-neutral-400">{etat.erreur}</p>
      ) : null}

      <Link href={CHEMIN_ACCES} className={`${CLASSE_BOUTON_DISCRET} text-center`}>
        {LIBELLE_VERS_ACCES}
      </Link>
    </form>
  );
}
