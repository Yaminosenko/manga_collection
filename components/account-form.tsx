"use client";

import { useActionState } from "react";
import { CLASSE_BOUTON, CLASSE_BOUTON_DISCRET, Champ } from "@/components/champ";
import { changerIdentite, seDeconnecter } from "@/lib/auth-actions";
import {
  LIBELLE_DECONNEXION,
  LIBELLE_EMAIL,
  LIBELLE_ENREGISTRER,
  LIBELLE_IDENTIFIANT,
  LIBELLE_NOM_AFFICHE,
  MENTION_EMAIL_INSCRIPTION,
  TITRE_SECTION_IDENTITE,
} from "@/lib/constants";
import type { CompteAffiche, EtatCompte } from "@/lib/domain";

const ETAT_INITIAL: EtatCompte = { erreur: null, message: null };

const TITRE_SECTION = "text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase";

export function AccountForm({ compte }: { compte: CompteAffiche }) {
  const [etatIdentite, enregistrerIdentite, identiteEnCours] = useActionState<
    EtatCompte,
    FormData
  >(changerIdentite, ETAT_INITIAL);

  return (
    <div className="flex flex-col gap-[26px] px-[18px] pb-[18px]">
      <form action={enregistrerIdentite} className="flex flex-col gap-[12px]">
        <h2 className={TITRE_SECTION}>{TITRE_SECTION_IDENTITE}</h2>
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
          mention={MENTION_EMAIL_INSCRIPTION}
        />
        <Champ
          nom="nom"
          libelle={LIBELLE_NOM_AFFICHE}
          autoComplete="name"
          valeurInitiale={compte.nom ?? ""}
          facultatif
        />
        <button type="submit" disabled={identiteEnCours} className={CLASSE_BOUTON}>
          {LIBELLE_ENREGISTRER}
        </button>
        <Message etat={etatIdentite} />
      </form>

      <form action={seDeconnecter}>
        <button type="submit" className={CLASSE_BOUTON_DISCRET}>
          {LIBELLE_DECONNEXION}
        </button>
      </form>
    </div>
  );
}

function Message({ etat }: { etat: EtatCompte }) {
  if (!etat.erreur && !etat.message) {
    return null;
  }
  return (
    <p
      role="status"
      className={`text-[12.5px] ${etat.erreur ? "text-neutral-400" : "text-accent"}`}
    >
      {etat.erreur ?? etat.message}
    </p>
  );
}
