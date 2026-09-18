"use client";

import { useActionState } from "react";
import { CLASSE_BOUTON, Champ, MessageFormulaire } from "@/components/champ";
import { changerIdentite } from "@/lib/auth-actions";
import {
  LIBELLE_EMAIL,
  LIBELLE_ENREGISTRER,
  LIBELLE_IDENTIFIANT,
  LIBELLE_MOT_DE_PASSE_ACTUEL,
  LIBELLE_NOM_AFFICHE,
} from "@/lib/constants";
import type { CompteAffiche, EtatCompte } from "@/lib/domain";

const ETAT_INITIAL: EtatCompte = { erreur: null, message: null };

export function AccountIdentityForm({ compte }: { compte: CompteAffiche }) {
  const [etat, enregistrer, enCours] = useActionState<EtatCompte, FormData>(
    changerIdentite,
    ETAT_INITIAL,
  );

  return (
    <form action={enregistrer} className="flex flex-col gap-[12px] px-[18px] pb-[18px]">
      <Champ
        nom="identifiant"
        libelle={LIBELLE_IDENTIFIANT}
        autoComplete="username"
        valeurInitiale={compte.identifiant ?? ""}
      />
      <Champ
        nom="email"
        libelle={LIBELLE_EMAIL}
        type="email"
        autoComplete="email"
        valeurInitiale={compte.email ?? ""}
      />
      <Champ
        nom="nom"
        libelle={LIBELLE_NOM_AFFICHE}
        autoComplete="name"
        valeurInitiale={compte.nom ?? ""}
        facultatif
      />
      <Champ
        nom="motDePasseActuel"
        libelle={LIBELLE_MOT_DE_PASSE_ACTUEL}
        type="password"
        autoComplete="current-password"
      />
      <button type="submit" disabled={enCours} className={CLASSE_BOUTON}>
        {LIBELLE_ENREGISTRER}
      </button>
      <MessageFormulaire etat={etat} />
    </form>
  );
}
