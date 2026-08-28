"use client";

import { useMemo, useState } from "react";
import { CollectionRow } from "@/components/collection-row";
import { CaretDown, CaretRight, Check, MagnifyingGlass, SortAscending } from "@/components/icons";
import {
  CROISSANT_PAR_DEFAUT,
  LIBELLE_AUCUN_RESULTAT,
  LIBELLE_COLLECTION_VIDE,
  LIBELLE_SENS_CROISSANT,
  LIBELLE_SENS_DECROISSANT,
  LIBELLE_VENDUES,
  PLACEHOLDER_RECHERCHE,
  TRIS,
  type CleTri,
} from "@/lib/constants";
import { formaterNombre } from "@/lib/format";
import { usePreferenceTri } from "@/lib/use-sort-preference";
import type { Collection, LigneCollection } from "@/lib/domain";

function normaliser(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function correspond(ligne: LigneCollection, recherche: string): boolean {
  if (recherche === "") {
    return true;
  }
  const cible = normaliser(`${ligne.titre} ${ligne.nom} ${ligne.editeur ?? ""}`);
  return normaliser(recherche)
    .split(/\s+/)
    .filter(Boolean)
    .every((mot) => cible.includes(mot));
}

function tauxCompletion(ligne: LigneCollection): number {
  return ligne.tomesParus === 0 ? 0 : ligne.possedes / ligne.tomesParus;
}

function comparer(a: LigneCollection, b: LigneCollection, tri: CleTri): number {
  switch (tri) {
    case "alphabetique":
      return 0;
    case "tomesPossedes":
      return a.possedes - b.possedes;
    case "completion":
      return tauxCompletion(a) - tauxCompletion(b);
    case "ajoutRecent":
      return a.ajouteeLe - b.ajouteeLe;
    case "aVerifier":
      return Number(a.aVerifier) - Number(b.aVerifier);
  }
}

export function CollectionList({ collection }: { collection: Collection }) {
  const [recherche, setRecherche] = useState("");
  const [preference, appliquerPreference] = usePreferenceTri();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [venduesOuvertes, setVenduesOuvertes] = useState(false);

  const lignes = useMemo(() => {
    const filtrees = collection.lignes.filter((ligne) => correspond(ligne, recherche));
    const sens = preference.croissant ? 1 : -1;
    return filtrees.sort((a, b) => {
      const principal = comparer(a, b, preference.tri) * sens;
      return principal !== 0 ? principal : a.titre.localeCompare(b.titre, "fr");
    });
  }, [collection.lignes, recherche, preference]);

  const vendues = useMemo(
    () => collection.vendues.filter((ligne) => correspond(ligne, recherche)),
    [collection.vendues, recherche],
  );

  const collectionVide = collection.lignes.length === 0 && collection.vendues.length === 0;
  const sansResultat = !collectionVide && lignes.length === 0 && vendues.length === 0;

  return (
    <>
      <header className="flex flex-col gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <div className="flex items-baseline justify-between gap-[12px]">
          <h1 className="text-[20px] font-medium text-text">Collection</h1>
          <span className="text-[11.5px] whitespace-nowrap text-neutral-500">
            {formaterNombre(collection.tomesPossedes)} tomes ·{" "}
            {formaterNombre(collection.nombreEditions)} éditions
          </span>
        </div>

        <div className="flex gap-[8px]">
          <label className="bg-surface flex h-[38px] flex-1 items-center gap-[8px] rounded-md px-[12px]">
            <MagnifyingGlass className="size-[15px] flex-none text-neutral-500" />
            <input
              type="search"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder={PLACEHOLDER_RECHERCHE}
              className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-neutral-500"
            />
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOuvert((ouvert) => !ouvert)}
              aria-label="Trier"
              aria-expanded={menuOuvert}
              className="flex size-[38px] items-center justify-center rounded-md border border-neutral-800 text-accent"
            >
              <SortAscending
                className={`size-[16px] ${preference.croissant ? "" : "rotate-180"}`}
              />
            </button>

            {menuOuvert ? (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOuvert(false)}
                  aria-hidden="true"
                />
                <div className="bg-surface absolute top-[42px] right-0 z-20 flex w-[220px] flex-col rounded-md border border-neutral-800 py-[4px]">
                  {TRIS.map((option) => (
                    <button
                      key={option.cle}
                      type="button"
                      onClick={() => {
                        appliquerPreference({
                          tri: option.cle,
                          croissant: CROISSANT_PAR_DEFAUT[option.cle],
                        });
                        setMenuOuvert(false);
                      }}
                      className="flex min-h-11 items-center justify-between gap-[8px] px-[12px] text-left text-[13px] text-neutral-300 hover:text-accent-200"
                    >
                      {option.libelle}
                      {option.cle === preference.tri ? (
                        <Check className="size-[12px] flex-none text-accent" />
                      ) : null}
                    </button>
                  ))}

                  <div className="border-divider mt-[4px] border-t pt-[4px]">
                    <button
                      type="button"
                      onClick={() =>
                        appliquerPreference({
                          tri: preference.tri,
                          croissant: !preference.croissant,
                        })
                      }
                      className="flex min-h-11 w-full items-center px-[12px] text-left text-[13px] text-neutral-300 hover:text-accent-200"
                    >
                      {preference.croissant ? LIBELLE_SENS_DECROISSANT : LIBELLE_SENS_CROISSANT}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
        {collectionVide ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_COLLECTION_VIDE}</p>
        ) : null}

        {sansResultat ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_AUCUN_RESULTAT}</p>
        ) : null}

        {lignes.map((ligne) => (
          <CollectionRow key={ligne.slug} ligne={ligne} />
        ))}

        {vendues.length > 0 ? (
          <section className="mt-[8px]">
            <button
              type="button"
              onClick={() => setVenduesOuvertes((ouvertes) => !ouvertes)}
              aria-expanded={venduesOuvertes}
              className="flex min-h-11 w-full items-center gap-[6px] text-[12px] text-neutral-600"
            >
              {venduesOuvertes ? (
                <CaretDown className="size-[12px]" />
              ) : (
                <CaretRight className="size-[12px]" />
              )}
              {LIBELLE_VENDUES}
              <span className="text-neutral-700">{vendues.length}</span>
            </button>

            {venduesOuvertes
              ? vendues.map((ligne) => <CollectionRow key={ligne.slug} ligne={ligne} />)
              : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
