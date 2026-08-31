import {
  LIBELLES_STATUT,
  LIBELLE_A_JOUR,
  LIBELLE_COMPLETE,
  LIBELLE_EDITION_TERMINEE,
  LIBELLE_TERMINEE_FORCEE,
  LONGUEUR_ISBN,
  PREFIXES_ISBN,
} from "@/lib/constants";
import type { SerieDistante } from "@/lib/anilist";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

export type ResultatScan =
  | {
      type: "tome";
      isbn: string;
      slug: string;
      titre: string;
      nom: string;
      numero: number;
      possede: boolean;
    }
  | { type: "annonce"; isbn: string; slug: string; titre: string; numero: number; date: string }
  | {
      type: "notice";
      isbn: string;
      titreNotice: string;
      editeur: string | null;
      annee: string | null;
      slugProbable: string | null;
      titreProbable: string | null;
    }
  | { type: "inconnu"; isbn: string };

export type SortiePlanning = {
  slug: string;
  titre: string;
  nom: string;
  editeur: string | null;
  numero: number;
  date: string;
  couvertureUrl: string | null;
  editionsDeLaSerie: number;
};

export type SortieAnnoncee = {
  numero: number;
  date: string;
  couvertureUrl: string | null;
};

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
  couvertureUrl: string | null;
  dernierNumeroPossede: number | null;
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
  sorties: SortieAnnoncee[];
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
  valeurCentimes: number;
  tomesSansPrix: number;
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
    return edition.editionTerminee === true ? LIBELLE_COMPLETE : LIBELLE_A_JOUR;
  }
  return aDesTomesAParaitre(edition.editionTerminee)
    ? LIBELLES_STATUT.EN_COURS
    : LIBELLE_EDITION_TERMINEE;
}

export function sousTitreLigne(ligne: LigneCollection): string {
  return ligne.editeur ? `${ligne.nom} · ${ligne.editeur}` : ligne.nom;
}

export function etiquetteStatutLigne(ligne: LigneCollection): string | null {
  return ligne.statut === "EN_COURS" || ligne.statut === "VENDUE"
    ? null
    : LIBELLES_STATUT[ligne.statut];
}

export function estComplete(ligne: LigneCollection): boolean {
  return (
    ligne.statut === "EN_COURS" &&
    !ligne.termineeForcee &&
    ligne.tomesParus > 0 &&
    ligne.possedes === ligne.tomesParus &&
    ligne.editionTerminee === true
  );
}

export function nombreCasesAParaitre(
  tomesParus: number,
  sortiesAnnoncees: number,
  colonnes: number,
): number {
  const posees = tomesParus + sortiesAnnoncees;
  const pourRemplirLaRangee = (colonnes - (posees % colonnes)) % colonnes;
  if (pourRemplirLaRangee > 0) {
    return pourRemplirLaRangee;
  }
  return sortiesAnnoncees > 0 ? 0 : colonnes;
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

export function isbnValide(brut: string): boolean {
  const chiffres = brut.replace(/[^0-9]/g, "");
  if (chiffres.length !== LONGUEUR_ISBN) return false;
  if (!PREFIXES_ISBN.some((prefixe) => chiffres.startsWith(prefixe))) return false;
  const somme = [...chiffres.slice(0, 12)].reduce(
    (total, chiffre, rang) => total + Number(chiffre) * (rang % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (somme % 10)) % 10 === Number(chiffres[12]);
}
