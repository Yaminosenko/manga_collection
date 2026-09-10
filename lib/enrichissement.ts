import { chercherParIsbn } from "@/lib/bnf";
import { EAN_ESSAYES_POUR_ENRICHIR } from "@/lib/constants";
import { convertir, rechercherSurMangaBaka, serieCompleteParId } from "@/lib/mangabaka";
import type { SerieMangaBaka } from "@/lib/mangabaka";
import { normaliserAlias } from "@/lib/normalisation";
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

function eansAInterroger(tomes: TomeCandidat[]): string[] {
  const avecEan = tomes
    .map((tome) => tome.ean)
    .filter((ean): ean is string => ean !== null);

  const recents = [...avecEan].reverse().slice(0, EAN_ESSAYES_POUR_ENRICHIR);
  const anciens = avecEan.slice(0, EAN_ESSAYES_POUR_ENRICHIR);

  return [...new Set([...recents, ...anciens])];
}

export async function enrichirDepuisTomes(tomes: TomeCandidat[]): Promise<Enrichissement> {
  const candidats = eansAInterroger(tomes);

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

export type EnrichissementSerie = {
  idMangaBaka: number | null;
  titreVo: string | null;
  genres: string[];
  themes: string[];
  cible: string | null;
  alias: string[];
  auteur: string;
};

const SERIE_VIDE: EnrichissementSerie = {
  idMangaBaka: null,
  titreVo: null,
  genres: [],
  themes: [],
  cible: null,
  alias: [],
  auteur: "",
};

function porteLeMemeTitre(candidat: SerieMangaBaka, cible: string): boolean {
  return candidat.titres.some((titre) => normaliserAlias(titre.titre) === cible);
}

export async function enrichirSerieParTitre(titre: string): Promise<EnrichissementSerie> {
  const cible = normaliserAlias(titre);
  if (cible === "") {
    return SERIE_VIDE;
  }

  const trouvees = await rechercherSurMangaBaka(titre);
  const retenu = trouvees.valeur.find((candidat) => porteLeMemeTitre(candidat, cible));
  if (!retenu) {
    return SERIE_VIDE;
  }

  const complete = await serieCompleteParId(retenu.id);
  const serie = complete.valeur ? convertir(complete.valeur) : retenu;

  return {
    idMangaBaka: serie.id,
    titreVo: serie.titreVo,
    genres: serie.genres,
    themes: serie.themes,
    cible: serie.cible,
    alias: serie.alias,
    auteur: serie.auteur,
  };
}
