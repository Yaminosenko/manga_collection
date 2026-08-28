import { prisma } from "@/lib/prisma";
import {
  LIBELLES_STATUT,
  LIBELLE_COMPLETE,
  LIBELLE_EDITION_TERMINEE,
  LIBELLE_TERMINEE_FORCEE,
} from "@/lib/constants";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

export type Tome = {
  numero: number;
  possede: boolean;
  couvertureUrl: string | null;
  prixCentimes: number | null;
};

export type AutreEdition = {
  slug: string;
  nom: string;
  editeur: string | null;
  tomesParus: number;
  possedes: number;
  editionTerminee: boolean | null;
  statut: StatutEdition;
};

export type Edition = {
  slug: string;
  nom: string;
  editeur: string | null;
  titre: string;
  auteur: string;
  genres: string[];
  cible: string | null;
  tomesParus: number;
  editionTerminee: boolean | null;
  statut: StatutEdition;
  termineeForcee: boolean;
  aVerifier: boolean;
  slugMangaNews: string | null;
  couvertureUrl: string | null;
  prixDefautCentimes: number | null;
  tomes: Tome[];
  autresEditions: AutreEdition[];
};

function compterPossedes(volumes: { possession: { possede: boolean } | null }[]): number {
  return volumes.filter((volume) => volume.possession?.possede).length;
}

export async function chargerEdition(slug: string): Promise<Edition | null> {
  const edition = await prisma.edition.findUnique({
    where: { slug },
    include: {
      volumes: {
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          couvertureUrl: true,
          prixCentimes: true,
          possession: { select: { possede: true } },
        },
      },
      serie: {
        include: {
          editions: {
            orderBy: { nom: "asc" },
            select: {
              slug: true,
              nom: true,
              editeur: true,
              tomesParus: true,
              editionTerminee: true,
              statut: true,
              volumes: { select: { possession: { select: { possede: true } } } },
            },
          },
        },
      },
    },
  });

  if (!edition) {
    return null;
  }

  return {
    slug: edition.slug,
    nom: edition.nom,
    editeur: edition.editeur,
    titre: edition.serie.titre,
    auteur: edition.serie.auteur,
    genres: edition.serie.genres,
    cible: edition.serie.cible,
    tomesParus: edition.tomesParus,
    editionTerminee: edition.editionTerminee,
    statut: edition.statut,
    termineeForcee: edition.termineeForcee,
    aVerifier: edition.aVerifier,
    slugMangaNews: edition.slugMangaNews,
    couvertureUrl: edition.couvertureUrl,
    prixDefautCentimes: edition.prixDefautCentimes,
    tomes: edition.volumes.map((volume) => ({
      numero: volume.numero,
      possede: volume.possession?.possede ?? false,
      couvertureUrl: volume.couvertureUrl,
      prixCentimes: volume.prixCentimes,
    })),
    autresEditions: edition.serie.editions
      .filter((autre) => autre.slug !== edition.slug)
      .map((autre) => ({
        slug: autre.slug,
        nom: autre.nom,
        editeur: autre.editeur,
        tomesParus: autre.tomesParus,
        possedes: compterPossedes(autre.volumes),
        editionTerminee: autre.editionTerminee,
        statut: autre.statut,
      })),
  };
}

export function numerosPossedes(tomes: Tome[]): number[] {
  return tomes.filter((tome) => tome.possede).map((tome) => tome.numero);
}

export function dernierTomePossede(tomes: Tome[]): Tome | null {
  for (let index = tomes.length - 1; index >= 0; index -= 1) {
    const tome = tomes[index];
    if (tome && tome.possede) {
      return tome;
    }
  }
  return null;
}


export function aDesTomesAParaitre(editionTerminee: boolean | null): boolean {
  return editionTerminee !== true;
}

export function libelleStatut(
  edition: Pick<Edition, "statut" | "tomesParus" | "termineeForcee" | "editionTerminee">,
  possedes: number,
): string {
  if (edition.statut !== "EN_COURS") {
    return LIBELLES_STATUT[edition.statut];
  }
  if (edition.termineeForcee) {
    return LIBELLE_TERMINEE_FORCEE;
  }
  if (possedes === edition.tomesParus) {
    return LIBELLE_COMPLETE;
  }
  return aDesTomesAParaitre(edition.editionTerminee)
    ? LIBELLES_STATUT.EN_COURS
    : LIBELLE_EDITION_TERMINEE;
}

export function valeurCentimes(edition: Pick<Edition, "prixDefautCentimes" | "tomes">): number | null {
  const possedes = edition.tomes.filter((tome) => tome.possede);
  if (possedes.length === 0) {
    return 0;
  }
  let total = 0;
  for (const tome of possedes) {
    const prix = tome.prixCentimes ?? edition.prixDefautCentimes;
    if (prix === null) {
      return null;
    }
    total += prix;
  }
  return total;
}
