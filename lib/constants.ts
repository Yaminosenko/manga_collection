export const CASES_A_PARAITRE = 3;

export const COLONNES_GRILLE = 4;

export const LIBELLES_STATUT = {
  EN_COURS: "Édition en cours",
  ABANDONNEE: "Abandonné",
  EN_PAUSE: "En pause",
  VENDUE: "Vendu",
} as const;

export const LIBELLE_EDITION_TERMINEE = "Édition terminée";
export const LIBELLE_COMPLETE = "Complète";
export const LIBELLE_TERMINEE_FORCEE = "Terminée par choix";
export const LIBELLE_A_VERIFIER = "À vérifier";

export const URL_FICHE_MANGA_NEWS = "https://www.manga-news.com/index.php/serie/";

export const TRIS = [
  { cle: "alphabetique", libelle: "Alphabétique" },
  { cle: "tomesPossedes", libelle: "Tomes possédés" },
  { cle: "completion", libelle: "% de complétion" },
  { cle: "ajoutRecent", libelle: "Ajout récent" },
  { cle: "aVerifier", libelle: "À vérifier en premier" },
] as const;

export type CleTri = (typeof TRIS)[number]["cle"];

export const TRI_PAR_DEFAUT: CleTri = "alphabetique";
export const CLE_STOCKAGE_TRI = "collection.tri";

export const PLACEHOLDER_RECHERCHE = "Rechercher";
export const LIBELLE_VENDUES = "Vendues";
export const LIBELLE_SENS_CROISSANT = "Ordre croissant";
export const LIBELLE_SENS_DECROISSANT = "Ordre décroissant";
export const LIBELLE_AUCUN_RESULTAT = "Aucune édition ne correspond.";
export const LIBELLE_COLLECTION_VIDE = "La collection est vide.";

export const CROISSANT_PAR_DEFAUT: Record<CleTri, boolean> = {
  alphabetique: true,
  tomesPossedes: false,
  completion: false,
  ajoutRecent: false,
  aVerifier: false,
};
