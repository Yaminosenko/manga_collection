"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { rechercherDesComptes } from "@/lib/actions";
import { CaretRight, MagnifyingGlass } from "@/components/icons";
import {
  CHEMIN_COMMUNAUTE,
  DELAI_RECHERCHE_MS,
  LIBELLE_COMMUNAUTE_AUCUN_COMPTE,
  LIBELLE_COMMUNAUTE_VIDE,
  LIBELLE_COMPTEUR_EDITIONS,
  LIBELLE_COMPTEUR_TOMES,
  LONGUEUR_RECHERCHE_MIN,
  PLACEHOLDER_RECHERCHE_COMPTE,
  TITRE_COMMUNAUTE,
} from "@/lib/constants";
import { formaterNombre } from "@/lib/format";
import type { LigneCommunaute } from "@/lib/communaute";

const LIGNE =
  "border-row-divider flex min-h-11 items-center gap-[12px] border-b py-[12px] text-left";

function sousTitreCompte(ligne: LigneCommunaute): string {
  return `${formaterNombre(ligne.tomesPossedes)} ${LIBELLE_COMPTEUR_TOMES} · ${formaterNombre(
    ligne.nombreEditions,
  )} ${LIBELLE_COMPTEUR_EDITIONS}`;
}

export function Community({ classementInitial }: { classementInitial: LigneCommunaute[] }) {
  const [terme, setTerme] = useState("");
  const [trouves, setTrouves] = useState<LigneCommunaute[]>(classementInitial);
  const [chargement, demarrerRecherche] = useTransition();

  useEffect(() => {
    const requete = terme.trim();
    if (requete.length < LONGUEUR_RECHERCHE_MIN) {
      return;
    }
    let courante = true;
    const minuteur = setTimeout(() => {
      demarrerRecherche(async () => {
        const comptes = await rechercherDesComptes(requete);
        if (courante) {
          setTrouves(comptes);
        }
      });
    }, DELAI_RECHERCHE_MS);
    return () => {
      courante = false;
      clearTimeout(minuteur);
    };
  }, [terme]);

  const requeteCourte = terme.trim().length < LONGUEUR_RECHERCHE_MIN;
  const comptes = requeteCourte ? classementInitial : trouves;
  const aucunResultat = !chargement && comptes.length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <h1 className="text-text text-[20px] font-medium">{TITRE_COMMUNAUTE}</h1>
        <label className="bg-surface flex h-[38px] items-center gap-[8px] rounded-md px-[12px]">
          <MagnifyingGlass className="size-[15px] flex-none text-neutral-500" />
          <input
            type="search"
            value={terme}
            onChange={(evenement) => setTerme(evenement.target.value)}
            placeholder={PLACEHOLDER_RECHERCHE_COMPTE}
            className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-neutral-500"
          />
        </label>
      </header>

      <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
        {aucunResultat ? (
          <p className="py-[24px] text-[13px] text-neutral-600">
            {requeteCourte ? LIBELLE_COMMUNAUTE_AUCUN_COMPTE : LIBELLE_COMMUNAUTE_VIDE}
          </p>
        ) : null}

        {comptes.map((ligne) => (
          <Link
            key={ligne.identifiant}
            href={`${CHEMIN_COMMUNAUTE}/${ligne.identifiant}`}
            className={`${LIGNE} transition-colors hover:bg-text/2`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="truncate text-[14px] font-medium text-text">{ligne.nomVisible}</span>
              <span className="truncate text-[11.5px] text-neutral-600">
                {sousTitreCompte(ligne)}
              </span>
            </div>
            <CaretRight className="size-[14px] flex-none text-neutral-600" />
          </Link>
        ))}
      </div>
    </main>
  );
}
