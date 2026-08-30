import {
  LIBELLES_STATUT,
  LIBELLE_A_VERIFIER,
  LIBELLE_COMPLETE,
  LIBELLE_EDITION_TERMINEE,
  LIBELLE_TERMINEE_FORCEE,
} from "@/lib/constants";
import type { SerieDistante } from "@/lib/anilist";
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

export type LigneCollection = {
  slug: string;
  titre: string;
  nom: string;
  editeur: string | null;
  tomesParus: number;
  possedes: number;
  editionTerminee: boolean | null;
  statut: StatutEdition;
  termineeForcee: boolean;
  aVerifier: boolean;
  ajouteeLe: number;
  editionsDeLaSerie: number;
  dernierNumeroPossede: number | null;
  couvertureUrl: string | null;
};

export type Collection = {
  lignes: LigneCollection[];
  vendues: LigneCollection[];
  tomesPossedes: number;
  nombreEditions: number;
};

export type EditionManquante = {
  slug: string;
  titre: string;
  nom: string;
  editeur: string | null;
  statut: StatutEdition;
  aVerifier: boolean;
  tomesParus: number;
  possedes: number;
  manquants: number[];
  dernierNumeroPossede: number | null;
  couvertureUrl: string | null;
};

export type Manquants = {
  editions: EditionManquante[];
  arretees: EditionManquante[];
  tomesManquants: number;
};

export type ResultatLocal = {
  slug: string;
  titre: string;
  nom: string;
  editeur: string | null;
  tomesParus: number;
  possedes: number;
};

export type ResultatDistant = SerieDistante & { dejaEnCollection: boolean };

export type ResultatRecherche = {
  locales: ResultatLocal[];
  distantes: ResultatDistant[];
  indisponible: boolean;
};

export type EtatCreation = { erreur: string | null };

export type EtatAcces = { erreur: string | null };

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

function etatLigne(ligne: LigneCollection): string | null {
  if (ligne.statut !== "EN_COURS") {
    return LIBELLES_STATUT[ligne.statut];
  }
  if (ligne.termineeForcee) {
    return LIBELLE_TERMINEE_FORCEE;
  }
  if (ligne.aVerifier) {
    return LIBELLE_A_VERIFIER;
  }
  if (ligne.possedes === ligne.tomesParus) {
    return LIBELLE_COMPLETE;
  }
  return null;
}

export function sousTitreLigne(ligne: LigneCollection): string {
  const etat = etatLigne(ligne);
  const edition = ligne.editeur ? `${ligne.nom} · ${ligne.editeur}` : ligne.nom;

  if (ligne.editionsDeLaSerie > 1) {
    return etat === null ? edition : `${ligne.nom} · ${etat}`;
  }
  return etat ?? edition;
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
