"use client";

import { useOptimistic, useTransition } from "react";
import { definirParution, definirStatut, definirTermineeForcee } from "@/lib/actions";
import {
  LIBELLES_STATUT,
  LIBELLE_COLLECTION_FORCEE,
  LIBELLE_PARUTION,
  LIBELLE_PARUTION_EN_COURS,
  LIBELLE_PARUTION_INCONNUE,
  LIBELLE_PARUTION_TERMINEE,
  LIBELLE_STATUT_PERSONNEL,
  MENTION_COLLECTION_FORCEE,
  MENTION_PARUTION,
  STATUTS_EDITION,
} from "@/lib/constants";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

type Etat = {
  statut: StatutEdition;
  editionTerminee: boolean | null;
  termineeForcee: boolean;
};

type EditionStateProps = Etat & { slug: string };

const STATUTS: readonly StatutEdition[] = STATUTS_EDITION;

const PARUTIONS: { valeur: boolean | null; libelle: string }[] = [
  { valeur: true, libelle: LIBELLE_PARUTION_TERMINEE },
  { valeur: false, libelle: LIBELLE_PARUTION_EN_COURS },
  { valeur: null, libelle: LIBELLE_PARUTION_INCONNUE },
];

const CHOIX =
  "min-h-11 flex-1 rounded-md border px-[10px] text-[12.5px] font-medium transition-colors";
const CHOIX_ACTIF = "border-accent bg-accent/12 text-accent";
const CHOIX_INACTIF = "border-neutral-800 text-neutral-400 hover:border-neutral-700";

export function EditionState({ slug, statut, editionTerminee, termineeForcee }: EditionStateProps) {
  const [enCours, demarrer] = useTransition();
  const [etat, appliquer] = useOptimistic<Etat, Partial<Etat>>(
    { statut, editionTerminee, termineeForcee },
    (precedent, modification) => ({ ...precedent, ...modification }),
  );

  function choisirStatut(valeur: StatutEdition) {
    if (valeur === etat.statut) return;
    demarrer(async () => {
      appliquer({ statut: valeur });
      await definirStatut(slug, valeur);
    });
  }

  function choisirParution(valeur: boolean | null) {
    if (valeur === etat.editionTerminee) return;
    demarrer(async () => {
      appliquer({ editionTerminee: valeur });
      await definirParution(slug, valeur);
    });
  }

  function basculerForcee() {
    const valeur = !etat.termineeForcee;
    demarrer(async () => {
      appliquer({ termineeForcee: valeur });
      await definirTermineeForcee(slug, valeur);
    });
  }

  return (
    <div
      className={`flex flex-col gap-[26px] px-[18px] pb-[18px] ${enCours ? "opacity-80" : ""}`}
    >
      <section className="flex flex-col gap-[9px]">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
          {LIBELLE_STATUT_PERSONNEL}
        </h2>
        <div className="grid grid-cols-2 gap-[7px]">
          {STATUTS.map((valeur) => (
            <button
              key={valeur}
              type="button"
              aria-pressed={etat.statut === valeur}
              onClick={() => choisirStatut(valeur)}
              className={`${CHOIX} ${etat.statut === valeur ? CHOIX_ACTIF : CHOIX_INACTIF}`}
            >
              {LIBELLES_STATUT[valeur]}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-[9px]">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
          {LIBELLE_PARUTION}
        </h2>
        <div className="flex gap-[7px]">
          {PARUTIONS.map(({ valeur, libelle }) => (
            <button
              key={libelle}
              type="button"
              aria-pressed={etat.editionTerminee === valeur}
              onClick={() => choisirParution(valeur)}
              className={`${CHOIX} ${
                etat.editionTerminee === valeur ? CHOIX_ACTIF : CHOIX_INACTIF
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
        <p className="text-[11px]/[1.5] text-neutral-600">{MENTION_PARUTION}</p>
      </section>

      <section className="flex flex-col gap-[9px]">
        <h2 className="text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
          {LIBELLE_COLLECTION_FORCEE}
        </h2>
        <button
          type="button"
          aria-pressed={etat.termineeForcee}
          onClick={basculerForcee}
          className={`${CHOIX} ${etat.termineeForcee ? CHOIX_ACTIF : CHOIX_INACTIF}`}
        >
          {etat.termineeForcee ? "Activée" : "Désactivée"}
        </button>
        <p className="text-[11px]/[1.5] text-neutral-600">{MENTION_COLLECTION_FORCEE}</p>
      </section>
    </div>
  );
}
