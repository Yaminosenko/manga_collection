"use client";

import { useActionState } from "react";
import { CLASSE_BOUTON, Champ, MessageFormulaire } from "@/components/champ";
import { changerMotDePasse } from "@/lib/auth-actions";
import {
  LIBELLE_ENREGISTRER,
  LIBELLE_MOT_DE_PASSE_ACTUEL,
  LIBELLE_MOT_DE_PASSE_CONFIRMATION,
  LIBELLE_MOT_DE_PASSE_NOUVEAU,
  MENTION_MOT_DE_PASSE_SESSIONS,
} from "@/lib/constants";
import type { EtatCompte } from "@/lib/domain";

const ETAT_INITIAL: EtatCompte = { erreur: null, message: null };

export function AccountPasswordForm() {
  const [etat, enregistrer, enCours] = useActionState<EtatCompte, FormData>(
    changerMotDePasse,
    ETAT_INITIAL,
  );

  return (
    <form action={enregistrer} className="flex flex-col gap-[12px] px-[18px] pb-[18px]">
      <Champ
        nom="motDePasseActuel"
        libelle={LIBELLE_MOT_DE_PASSE_ACTUEL}
        type="password"
        autoComplete="current-password"
      />
      <Champ
        nom="motDePasse"
        libelle={LIBELLE_MOT_DE_PASSE_NOUVEAU}
        type="password"
        autoComplete="new-password"
      />
      <Champ
        nom="confirmation"
        libelle={LIBELLE_MOT_DE_PASSE_CONFIRMATION}
        type="password"
        autoComplete="new-password"
        mention={MENTION_MOT_DE_PASSE_SESSIONS}
      />
      <button type="submit" disabled={enCours} className={CLASSE_BOUTON}>
        {LIBELLE_ENREGISTRER}
      </button>
      <MessageFormulaire etat={etat} />
    </form>
  );
}
