export const CASES_A_PARAITRE = 3;
export const LIBELLE_A_PARAITRE = "À paraître";

export const COLONNES_GRILLE = 2;

export const LARGEUR_MAX_APPLICATION = "430px";

export const LIBELLES_STATUT = {
  EN_COURS: "Édition en cours",
  ABANDONNEE: "Abandonné",
  EN_PAUSE: "En pause",
  VENDUE: "Vendu",
} as const;

export const LIBELLE_EDITION_TERMINEE = "Édition terminée";
export const LIBELLE_COMPLETE = "Complète";
export const LIBELLE_A_JOUR = "À jour";
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

export const TITRE_MANQUANTS = "Manquants";
export const LIBELLE_AUCUN_MANQUANT = "Aucun tome manquant.";
export const LIBELLE_MANQUANTS_ERREUR = "Les tomes manquants n’ont pas pu être chargés.";
export const LIBELLE_COLLECTION_ERREUR = "La collection n’a pas pu être chargée.";

export const LIBELLE_ARRETEES = "Abandonnées et en pause";

export const URL_ANILIST = "https://graphql.anilist.co";
export const RESULTATS_RECHERCHE_MAX = 10;
export const DELAI_RECHERCHE_MS = 350;
export const LONGUEUR_RECHERCHE_MIN = 2;

export const TITRE_AJOUTER = "Ajouter";
export const NOM_EDITION_PAR_DEFAUT = "Édition simple";
export const LIBELLE_DEJA_EN_COLLECTION = "Déjà dans la collection";
export const LIBELLE_ANILIST_INDISPONIBLE =
  "La recherche externe est indisponible. La collection locale reste consultable.";
export const LIBELLE_RECHERCHE_VIDE = "Aucun résultat.";
export const LIBELLE_INVITE_RECHERCHE = "Cherchez une série par son titre.";
export const LIBELLE_TOMES_JAPONAIS =
  "Compte japonais indicatif : corrigez-le avec le nombre de tomes parus en France.";

export const NOM_APPLICATION = "Collection de mangas";
export const NOM_APPLICATION_COURT = "Collection";
export const COULEUR_FOND_APPLICATION = "#161826";

export const CHEMIN_ACCES = "/acces";
export const COOKIE_ACCES = "collection.acces";
export const MESSAGE_JETON = "acces";
export const MESSAGE_JETON_INVITE = "invite";
export const DUREE_ACCES_SECONDES = 31_536_000;

export const TITRE_ACCES = "Collection privée";
export const LIBELLE_MOT_DE_PASSE = "Mot de passe";
export const LIBELLE_DEVERROUILLER = "Entrer";
export const LIBELLE_ACCES_REFUSE = "Mot de passe incorrect.";
export const LIBELLE_ACCES_NON_CONFIGURE =
  "Aucun mot de passe n’est configuré : renseignez ACCESS_PASSWORD dans l’environnement.";

export const TITRE_ETAT = "État";
export const LIBELLE_STATUT_PERSONNEL = "Où j’en suis";
export const LIBELLE_PARUTION = "Parution en France";
export const LIBELLE_COLLECTION_FORCEE = "Collection terminée par choix";
export const LIBELLE_PARUTION_TERMINEE = "Terminée";
export const LIBELLE_PARUTION_EN_COURS = "En cours";
export const LIBELLE_PARUTION_INCONNUE = "Inconnue";
export const MENTION_PARUTION =
  "Une édition terminée n’affiche plus de tomes à paraître, et « À jour » y devient « Complète ».";
export const MENTION_COLLECTION_FORCEE =
  "Déclare la collection finie malgré des tomes manquants. Ils cessent de remonter dans Manquants ; la barre garde son compte réel.";

export const LIBELLE_ENTRER_INVITE = "Entrer en invité";
export const LIBELLE_MODE_INVITE = "Mode invité · consultation seule";
export const LIBELLE_QUITTER_INVITE = "Quitter";
export const MENTION_INVITE_LECTURE =
  "En invité, la collection se consulte mais ne se modifie pas.";
