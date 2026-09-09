import { chercherParIsbn } from "@/lib/bnf";
import { EAN_ESSAYES_POUR_ENRICHIR } from "@/lib/constants";
import type { TomeCandidat } from "@/lib/domain";

export type Enrichissement = {
  auteurs: string[];
  editeur: string | null;
  prixDefautCentimes: number | null;
  isbnInterroges: string[];
};

const VIDE: Enrichissement = {
  auteurs: [],
  editeur: null,
  prixDefautCentimes: null,
  isbnInterroges: [],
};

export async function enrichirDepuisTomes(tomes: TomeCandidat[]): Promise<Enrichissement> {
  const candidats = [...tomes]
    .reverse()
    .map((tome) => tome.ean)
    .filter((ean): ean is string => ean !== null)
    .slice(0, EAN_ESSAYES_POUR_ENRICHIR);

  if (candidats.length === 0) {
    return VIDE;
  }

  const resultat: Enrichissement = { ...VIDE, isbnInterroges: [] };

  for (const isbn of candidats) {
    resultat.isbnInterroges.push(isbn);
    const notice = await chercherParIsbn(isbn);
    if (!notice) continue;

    if (resultat.auteurs.length === 0 && notice.auteurs.length > 0) {
      resultat.auteurs = notice.auteurs;
    }
    if (resultat.editeur === null && notice.editeur !== null) {
      resultat.editeur = notice.editeur;
    }
    if (resultat.prixDefautCentimes === null && notice.prixCentimes !== null) {
      resultat.prixDefautCentimes = notice.prixCentimes;
    }

    if (
      resultat.auteurs.length > 0 &&
      resultat.editeur !== null &&
      resultat.prixDefautCentimes !== null
    ) {
      break;
    }
  }

  return resultat;
}
