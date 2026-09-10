"use client";

import { useMemo, useState } from "react";
import { CollectionPanel } from "@/components/collection-panel";
import { MissingPanel } from "@/components/missing-panel";
import { WishlistPanel } from "@/components/wishlist-panel";
import { Check, MagnifyingGlass, SortAscending } from "@/components/icons";
import {
  CLES_STOCKAGE_DEFILEMENT,
  CROISSANT_PAR_DEFAUT,
  LIBELLE_PANNEAUX,
  LIBELLE_SENS_CROISSANT,
  LIBELLE_SENS_DECROISSANT,
  PANNEAUX,
  PLACEHOLDER_RECHERCHE,
  TRIS,
  type CleTri,
  type ClePanneau,
} from "@/lib/constants";
import { correspondALaRecherche } from "@/lib/domain";
import { useMemoireDefilement } from "@/lib/use-scroll-memory";
import { usePreferenceTri } from "@/lib/use-sort-preference";
import type { EspaceCollection, LigneCollection } from "@/lib/domain";

function tauxCompletion(ligne: LigneCollection): number {
  return ligne.tomesParus === 0 ? 0 : ligne.possedes / ligne.tomesParus;
}

function comparer(a: LigneCollection, b: LigneCollection, tri: CleTri): number {
  switch (tri) {
    case "alphabetique":
      return a.titre.localeCompare(b.titre, "fr");
    case "tomesPossedes":
      return a.possedes - b.possedes;
    case "completion":
      return tauxCompletion(a) - tauxCompletion(b);
    case "ajoutRecent":
      return a.ajouteeLe - b.ajouteeLe;
  }
}

type CollectionSpaceProps = {
  espace: EspaceCollection;
  panneauInitial: ClePanneau;
};

export function CollectionSpace({ espace, panneauInitial }: CollectionSpaceProps) {
  const [panneau, setPanneau] = useState<ClePanneau>(panneauInitial);
  const [recherche, setRecherche] = useState("");
  const [preference, appliquerPreference] = usePreferenceTri();
  const [menuOuvert, setMenuOuvert] = useState(false);

  useMemoireDefilement(CLES_STOCKAGE_DEFILEMENT[panneau]);

  const lignes = useMemo(() => {
    const filtrees = espace.collection.lignes.filter((ligne) =>
      correspondALaRecherche(ligne, recherche),
    );
    const sens = preference.croissant ? 1 : -1;
    return filtrees.sort((a, b) => {
      const principal = comparer(a, b, preference.tri) * sens;
      return principal !== 0 ? principal : a.titre.localeCompare(b.titre, "fr");
    });
  }, [espace.collection.lignes, recherche, preference]);

  const vendues = useMemo(
    () => espace.collection.vendues.filter((ligne) => correspondALaRecherche(ligne, recherche)),
    [espace.collection.vendues, recherche],
  );

  const editionsManquantes = useMemo(
    () => espace.manquants.editions.filter((edition) => correspondALaRecherche(edition, recherche)),
    [espace.manquants.editions, recherche],
  );

  const souhaitees = useMemo(
    () => espace.wishList.lignes.filter((ligne) => correspondALaRecherche(ligne, recherche)),
    [espace.wishList.lignes, recherche],
  );

  const libelleActif = PANNEAUX.find((option) => option.cle === panneau)?.libelle ?? "";

  return (
    <>
      <nav
        aria-label={LIBELLE_PANNEAUX}
        className="bg-bg border-divider sticky top-0 z-30 flex gap-[6px] overflow-x-auto border-b px-[18px]"
      >
        {PANNEAUX.map(({ cle, libelle }) => {
          const actif = cle === panneau;
          return (
            <button
              key={cle}
              type="button"
              onClick={() => setPanneau(cle)}
              aria-current={actif ? "page" : undefined}
              className="flex min-h-11 flex-none items-center"
            >
              <span
                className={`rounded-full px-[12px] py-[6px] text-[13px] whitespace-nowrap transition-colors ${
                  actif ? "bg-accent text-bg font-medium" : "text-neutral-500"
                }`}
              >
                {libelle}
              </span>
            </button>
          );
        })}
      </nav>

      <h1 className="sr-only">{libelleActif}</h1>

      <div className="flex gap-[8px] px-[18px] pt-[12px] pb-[10px]">
        <label className="bg-surface flex h-[38px] flex-1 items-center gap-[8px] rounded-md px-[12px]">
          <MagnifyingGlass className="size-[15px] flex-none text-neutral-500" />
          <input
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            placeholder={PLACEHOLDER_RECHERCHE}
            className="text-text w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-500"
          />
        </label>

        {panneau === "collection" ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOuvert((ouvert) => !ouvert)}
              aria-label="Trier"
              aria-expanded={menuOuvert}
              className="text-accent flex size-[38px] items-center justify-center rounded-md border border-neutral-800"
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
                      className="hover:text-accent-200 flex min-h-11 items-center justify-between gap-[8px] px-[12px] text-left text-[13px] text-neutral-300"
                    >
                      {option.libelle}
                      {option.cle === preference.tri ? (
                        <Check className="text-accent size-[12px] flex-none" />
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
                      className="hover:text-accent-200 flex min-h-11 w-full items-center px-[12px] text-left text-[13px] text-neutral-300"
                    >
                      {preference.croissant ? LIBELLE_SENS_DECROISSANT : LIBELLE_SENS_CROISSANT}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
        {panneau === "collection" ? (
          <CollectionPanel
            collection={espace.collection}
            lignes={lignes}
            vendues={vendues}
          />
        ) : null}

        {panneau === "manquants" ? (
          <MissingPanel manquants={espace.manquants} editions={editionsManquantes} />
        ) : null}

        {panneau === "wishlist" ? (
          <WishlistPanel wishList={espace.wishList} lignes={souhaitees} />
        ) : null}
      </div>
    </>
  );
}
