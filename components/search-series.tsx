"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ajouterCandidatDirect, rechercherAuCatalogue } from "@/lib/actions";
import { CaretRight, MagnifyingGlass } from "@/components/icons";
import {
  DELAI_RECHERCHE_MS,
  LIBELLE_AJOUT_EN_COURS,
  LIBELLE_AU_CATALOGUE,
  LIBELLE_DEJA_EN_COLLECTION,
  LIBELLE_INVITE_RECHERCHE,
  LIBELLE_RECHERCHE_VIDE,
  LIBELLE_TOMES_DU_CATALOGUE,
  LIBELLE_TOME_DU_CATALOGUE,
  LONGUEUR_RECHERCHE_MIN,
  MENTION_AJOUT_DIRECT,
  PLACEHOLDER_RECHERCHE,
  TITRE_RECHERCHER,
  TITRE_SCANNER,
} from "@/lib/constants";
import type { CandidatEdition, ResultatRecherche } from "@/lib/domain";

const RECHERCHE_VIDE: ResultatRecherche = { locales: [], candidats: [] };

const SECTION = "text-[13px] font-medium tracking-[0.08em] text-neutral-500 uppercase";
const LIGNE =
  "border-row-divider flex min-h-11 items-center gap-[10px] border-b py-[10px] text-left";

export function SearchSeries() {
  const [terme, setTerme] = useState("");
  const [recherche, setRecherche] = useState<ResultatRecherche>(RECHERCHE_VIDE);
  const [chargement, demarrerRecherche] = useTransition();
  const [ajout, demarrerAjout] = useTransition();

  useEffect(() => {
    const requete = terme.trim();
    if (requete.length < LONGUEUR_RECHERCHE_MIN) {
      return;
    }
    let courante = true;
    const minuteur = setTimeout(() => {
      demarrerRecherche(async () => {
        const trouvees = await rechercherAuCatalogue(requete);
        if (courante) {
          setRecherche(trouvees);
        }
      });
    }, DELAI_RECHERCHE_MS);
    return () => {
      courante = false;
      clearTimeout(minuteur);
    };
  }, [terme]);

  function ouvrir(candidat: CandidatEdition) {
    demarrerAjout(async () => {
      await ajouterCandidatDirect(candidat.serieNormalise, candidat.marqueurNormalise, null);
    });
  }

  const requeteCourte = terme.trim().length < LONGUEUR_RECHERCHE_MIN;
  const resultats = requeteCourte ? RECHERCHE_VIDE : recherche;
  const aucunResultat =
    !requeteCourte &&
    !chargement &&
    resultats.locales.length === 0 &&
    resultats.candidats.length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-col gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <div className="flex items-center justify-between gap-[12px]">
          <h1 className="text-text text-[20px] font-medium">{TITRE_RECHERCHER}</h1>
          <Link
            href="/scanner"
            className="border-accent text-accent flex min-h-11 items-center rounded-md border px-[12px] text-[12.5px] font-medium transition-colors hover:bg-accent/12"
          >
            {TITRE_SCANNER}
          </Link>
        </div>
        <label className="bg-surface flex h-[38px] items-center gap-[8px] rounded-md px-[12px]">
          <MagnifyingGlass className="size-[15px] flex-none text-neutral-500" />
          <input
            type="search"
            autoFocus
            value={terme}
            onChange={(evenement) => setTerme(evenement.target.value)}
            placeholder={PLACEHOLDER_RECHERCHE}
            className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-neutral-500"
          />
        </label>
      </header>

      <div className="flex flex-1 flex-col gap-[18px] px-[18px] pb-[18px]">
        {requeteCourte ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_INVITE_RECHERCHE}</p>
        ) : null}

        {aucunResultat ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_RECHERCHE_VIDE}</p>
        ) : null}

        {resultats.locales.length > 0 ? (
          <section className="flex flex-col gap-[4px]">
            <h2 className={SECTION}>{LIBELLE_DEJA_EN_COLLECTION}</h2>
            {resultats.locales.map((locale) => (
              <Link key={locale.slug} href={`/edition/${locale.slug}`} className={LIGNE}>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="titre-serie truncate text-[14px] font-medium text-text">
                    {locale.titre}
                  </span>
                  <span className="truncate text-[11.5px] text-neutral-600">
                    {locale.nom} · {locale.possedes} / {locale.tomesParus}
                  </span>
                </span>
                <CaretRight className="size-[14px] flex-none text-neutral-600" />
              </Link>
            ))}
          </section>
        ) : null}

        {resultats.candidats.length > 0 ? (
          <section className="flex flex-col gap-[4px]">
            <h2 className={SECTION}>{LIBELLE_AU_CATALOGUE}</h2>
            {resultats.candidats.map((candidat) => (
              <button
                key={`${candidat.serieNormalise}-${candidat.marqueurNormalise ?? ""}`}
                type="button"
                disabled={ajout}
                onClick={() => ouvrir(candidat)}
                className={`${LIGNE} disabled:opacity-50`}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="titre-serie truncate text-[14px] font-medium text-text">
                    {candidat.titre}
                  </span>
                  <span className="truncate text-[11.5px] text-neutral-600">
                    {candidat.nom}
                    {candidat.editeur ? ` · ${candidat.editeur}` : ""}
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {candidat.tomesParus}{" "}
                    {candidat.tomesParus === 1
                      ? LIBELLE_TOME_DU_CATALOGUE
                      : LIBELLE_TOMES_DU_CATALOGUE}
                    {candidat.slugEnCollection ? ` · ${LIBELLE_DEJA_EN_COLLECTION}` : ""}
                  </span>
                </span>
                <CaretRight className="size-[14px] flex-none text-neutral-600" />
              </button>
            ))}
            <p className="mt-[6px] text-[11px]/[1.5] text-neutral-600">{MENTION_AJOUT_DIRECT}</p>
          </section>
        ) : null}

        {ajout ? (
          <p className="text-[11.5px] text-neutral-500">{LIBELLE_AJOUT_EN_COURS}</p>
        ) : null}
      </div>
    </main>
  );
}
