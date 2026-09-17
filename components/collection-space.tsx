"use client";

import { useCallback, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { CollectionPanel } from "@/components/collection-panel";
import { MissingPanel } from "@/components/missing-panel";
import { PanelStats } from "@/components/panel-stats";
import { WishlistPanel } from "@/components/wishlist-panel";
import { Check, MagnifyingGlass, SortAscending, User } from "@/components/icons";
import {
  CHEMIN_COMPTE,
  CLES_STOCKAGE_DEFILEMENT,
  CROISSANT_PAR_DEFAUT,
  LIBELLE_COMPTEUR_EDITIONS,
  LIBELLE_COMPTEUR_TOMES,
  LIBELLE_ONGLET_COMPTE,
  LIBELLE_PANNEAUX,
  LIBELLE_SENS_CROISSANT,
  LIBELLE_SENS_DECROISSANT,
  LIBELLE_WISHLIST_COMPTEUR_PLURIEL,
  LIBELLE_WISHLIST_COMPTEUR_SINGULIER,
  PANNEAUX,
  PLACEHOLDER_RECHERCHE,
  PREFIXE_VALEUR_PARTIELLE,
  TRIS,
  type CleTri,
  type ClePanneau,
} from "@/lib/constants";
import { correspondALaRecherche } from "@/lib/domain";
import { formaterNombre, formaterPrix } from "@/lib/format";
import { useHauteurBandeau } from "@/lib/use-header-height";
import { useEnTeteEscamotable } from "@/lib/use-header-visibility";
import { useMemoireDefilement } from "@/lib/use-scroll-memory";
import { usePreferenceTri } from "@/lib/use-sort-preference";
import {
  comportementDefilement,
  indexDuPanneau,
  usePanneauVisible,
} from "@/lib/use-visible-panel";
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

function statsDuPanneau(espace: EspaceCollection, panneau: ClePanneau) {
  if (panneau === "collection") {
    const { collection } = espace;
    if (collection.lignes.length === 0 && collection.vendues.length === 0) {
      return { stats: [], prix: null };
    }
    const valeur = formaterPrix(collection.valeurCentimes);
    return {
      stats: [
        { valeur: formaterNombre(collection.tomesPossedes), libelle: LIBELLE_COMPTEUR_TOMES },
        { valeur: formaterNombre(collection.nombreEditions), libelle: LIBELLE_COMPTEUR_EDITIONS },
      ],
      prix:
        valeur === null
          ? null
          : `${collection.tomesSansPrix > 0 ? PREFIXE_VALEUR_PARTIELLE : ""}${valeur}`,
    };
  }

  if (panneau === "manquants") {
    const { manquants } = espace;
    if (manquants.editions.length === 0) {
      return { stats: [], prix: null };
    }
    return {
      stats: [
        { valeur: formaterNombre(manquants.tomesManquants), libelle: LIBELLE_COMPTEUR_TOMES },
        { valeur: formaterNombre(manquants.editions.length), libelle: LIBELLE_COMPTEUR_EDITIONS },
      ],
      prix: null,
    };
  }

  const total = espace.wishList.lignes.length;
  if (total === 0) {
    return { stats: [], prix: null };
  }
  return {
    stats: [
      {
        valeur: formaterNombre(total),
        libelle:
          total === 1 ? LIBELLE_WISHLIST_COMPTEUR_SINGULIER : LIBELLE_WISHLIST_COMPTEUR_PLURIEL,
      },
    ],
    prix: null,
  };
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
  const bandeau = useRef<HTMLDivElement>(null);
  const piste = useRef<HTMLDivElement>(null);
  const panneauCollection = useRef<HTMLDivElement>(null);
  const panneauManquants = useRef<HTMLDivElement>(null);
  const panneauWishlist = useRef<HTMLDivElement>(null);
  const scrollers: Record<ClePanneau, RefObject<HTMLDivElement | null>> = {
    collection: panneauCollection,
    manquants: panneauManquants,
    wishlist: panneauWishlist,
  };
  const enTeteVisible =
    useEnTeteEscamotable(bandeau, scrollers[panneau], CLES_STOCKAGE_DEFILEMENT[panneau]) ||
    menuOuvert;

  useHauteurBandeau(bandeau);
  useMemoireDefilement(panneauCollection, CLES_STOCKAGE_DEFILEMENT.collection);
  useMemoireDefilement(panneauManquants, CLES_STOCKAGE_DEFILEMENT.manquants);
  useMemoireDefilement(panneauWishlist, CLES_STOCKAGE_DEFILEMENT.wishlist);
  usePanneauVisible(piste, panneauInitial, setPanneau);

  const allerAuPanneau = useCallback((cle: ClePanneau) => {
    const rail = piste.current;
    if (rail === null) {
      return;
    }
    rail.scrollTo({ left: indexDuPanneau(cle) * rail.clientWidth, behavior: comportementDefilement() });
  }, []);

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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">{libelleActif}</h1>

      <div
        ref={bandeau}
        className={`bg-header border-divider absolute inset-x-0 top-0 z-30 border-b transition-[translate,opacity] duration-200 ${
          enTeteVisible ? "" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="flex gap-[8px] px-[18px] pt-[12px] pb-[10px]">
          <Link
            href={CHEMIN_COMPTE}
            aria-label={LIBELLE_ONGLET_COMPTE}
            className="text-accent flex size-[38px] flex-none items-center justify-center rounded-full border border-neutral-800"
          >
            <User className="size-[16px]" />
          </Link>

          <label className="bg-bg flex h-[38px] flex-1 items-center gap-[8px] rounded-md px-[12px]">
            <MagnifyingGlass className="size-[15px] flex-none text-neutral-500" />
            <input
              type="search"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder={PLACEHOLDER_RECHERCHE}
              className="text-text w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-500"
            />
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOuvert((ouvert) => !ouvert)}
              aria-label="Trier"
              aria-expanded={menuOuvert}
              className="text-accent flex size-[38px] items-center justify-center rounded-md border border-neutral-800"
            >
              <SortAscending className={`size-[16px] ${preference.croissant ? "" : "rotate-180"}`} />
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
        </div>

        <nav
          aria-label={LIBELLE_PANNEAUX}
          className="flex gap-[6px] overflow-x-auto px-[18px]"
        >
          {PANNEAUX.map(({ cle, libelle }) => {
            const actif = cle === panneau;
            return (
              <button
                key={cle}
                type="button"
                onClick={() => allerAuPanneau(cle)}
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
      </div>

      <div
        ref={piste}
        className="piste-panneaux flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {PANNEAUX.map(({ cle, libelle }) => {
          const { stats, prix } = statsDuPanneau(espace, cle);
          return (
            <section
              key={cle}
              ref={scrollers[cle]}
              aria-label={libelle}
              className="panneau-defilant flex w-full flex-none snap-start flex-col overflow-y-auto overscroll-y-contain px-[18px] pt-[calc(var(--hauteur-bandeau)+12px)] pb-[18px]"
            >
              <PanelStats stats={stats} prix={prix} />

              {cle === "collection" ? (
                <CollectionPanel
                  collection={espace.collection}
                  lignes={lignes}
                  vendues={vendues}
                />
              ) : null}

              {cle === "manquants" ? (
                <MissingPanel manquants={espace.manquants} editions={editionsManquantes} />
              ) : null}

              {cle === "wishlist" ? (
                <WishlistPanel wishList={espace.wishList} lignes={souhaitees} />
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
