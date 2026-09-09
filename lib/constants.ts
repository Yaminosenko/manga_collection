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

export const URL_RECHERCHE_MANGA_NEWS = "https://www.manga-news.com/index.php/recherche/?q=";
export const LIBELLE_FICHE_MANGA_NEWS = "Fiche manga-news";

export const TRIS = [
  { cle: "alphabetique", libelle: "Alphabétique" },
  { cle: "tomesPossedes", libelle: "Tomes possédés" },
  { cle: "completion", libelle: "% de complétion" },
  { cle: "ajoutRecent", libelle: "Ajout récent" },
] as const;

export type CleTri = (typeof TRIS)[number]["cle"];

export const TRI_PAR_DEFAUT: CleTri = "alphabetique";
export const CLE_STOCKAGE_TRI = "collection.tri";
export const CLE_STOCKAGE_DEFILEMENT = "collection.defilement";

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
};

export const TITRE_MANQUANTS = "Manquants";
export const LIBELLE_AUCUN_MANQUANT = "Aucun tome manquant.";
export const LIBELLE_MANQUANTS_ERREUR = "Les tomes manquants n’ont pas pu être chargés.";
export const LIBELLE_COLLECTION_ERREUR = "La collection n’a pas pu être chargée.";


export const DELAI_APPEL_EXTERNE_MS = 8_000;

export const URL_ANILIST = "https://graphql.anilist.co";
export const RESULTATS_RECHERCHE_MAX = 10;
export const DELAI_RECHERCHE_MS = 350;
export const LONGUEUR_RECHERCHE_MIN = 2;

export const TITRE_RECHERCHER = "Rechercher";
export const LIBELLE_AU_CATALOGUE = "Au catalogue";
export const LIBELLE_AJOUT_EN_COURS = "Ajout de la série…";
export const LIBELLE_AUTEUR_INCONNU = "Auteur inconnu";
export const LIBELLE_CANDIDAT_INTROUVABLE =
  "Cette édition n’est plus au catalogue. Relancez la recherche.";
export const STATUT_A_LA_CREATION = "EN_COURS" as const;
export const MENTION_AJOUT_DIRECT =
  "Un tap ajoute la série et ouvre sa page : les tomes s’y cochent, et le suivi se règle depuis « Modifier l’état ».";
export const LIBELLE_TOMES_DU_CATALOGUE = "tomes parus selon le catalogue";
export const LIBELLE_TOME_DU_CATALOGUE = "tome paru selon le catalogue";


export const TITRE_WISHLIST = "Wish list";
export const LIBELLE_WISHLIST_VIDE =
  "Aucune série en attente. Une série ajoutée sans cocher de tome atterrit ici, et rejoint la collection au premier tome coché.";
export const LIBELLE_WISHLIST_ERREUR = "La wish list n’a pas pu être chargée.";
export const LIBELLE_WISHLIST_COMPTEUR_SINGULIER = "série";
export const LIBELLE_WISHLIST_COMPTEUR_PLURIEL = "séries";
export const NOM_EDITION_PAR_DEFAUT = "Édition simple";

export const CANDIDATS_RECHERCHE_MAX = 25;
export const SIMILARITE_CATALOGUE_MIN = 0.35;
export const MOIS_SANS_SORTIE_POUR_TERMINEE = 24;
export const MOIS_FENETRE_SORTIE = 6;
export const EAN_ESSAYES_POUR_ENRICHIR = 2;
export const TOMES_PARUS_MAX = 500;
export const STATUTS_EDITION = ["EN_COURS", "ABANDONNEE", "EN_PAUSE", "VENDUE"] as const;
export const LIBELLE_STATUT_INVALIDE = "Le statut choisi n’existe pas.";
export const LIBELLE_TOMES_PARUS_INVALIDE = `Le nombre de tomes parus doit être un entier entre 1 et ${TOMES_PARUS_MAX}.`;
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
export const LIBELLE_PROPRIETAIRE_ABSENT =
  "Aucun utilisateur propriétaire en base : la migration des comptes n’a pas été appliquée.";
export const LIBELLE_ACCES_NON_CONFIGURE =
  "Aucun mot de passe n’est configuré : renseignez ACCESS_PASSWORD dans l’environnement.";

export const LIBELLE_TOMES_POSSEDES = "Tomes possédés";
export const LIBELLE_AUTRES_EDITIONS = "Autres éditions";
export const LIBELLE_SERIES_LIEES = "Séries liées";

export const LIBELLES_LIEN_SERIE = {
  PREQUELLE: "Préquelle",
  SERIE_MERE: "Série principale",
  SUITE: "Suite",
  SPIN_OFF: "Spin-off",
  HORS_SERIE: "Hors-série",
  GUIDE: "Guide",
  AUTRE: "Même univers",
} as const;

export const ORDRE_LIENS_SERIE = [
  "SERIE_MERE",
  "PREQUELLE",
  "SUITE",
  "SPIN_OFF",
  "HORS_SERIE",
  "GUIDE",
  "AUTRE",
] as const;
export const LIBELLE_PROCHAINE_SORTIE = "Prochaine sortie";
export const LIBELLE_PRIX_TOME = "Prix du tome";
export const LIBELLE_MODIFIER_ETAT = "Modifier l’état";

export const TITRE_ETAT = "État";
export const LIBELLE_STATUT_PERSONNEL = "Où j’en suis";
export const LIBELLE_PARUTION = "Parution en France";
export const LIBELLE_SUIVI = "Suivi";
export const LIBELLE_SUIVIE = "Suivie";
export const LIBELLE_NON_SUIVIE = "Non suivie";
export const LIBELLE_PARUTION_TERMINEE = "Terminée";
export const LIBELLE_PARUTION_EN_COURS = "En cours";
export const LIBELLE_PARUTION_INCONNUE = "Inconnue";
export const MENTION_PARUTION =
  "Une édition terminée n’affiche plus de tomes à paraître, et « À jour » y devient « Complète ».";
export const MENTION_SUIVI =
  "Une édition suivie rappelle ses tomes manquants dans Manquants et ses sorties dans Planning. Non suivie, elle reste dans la collection sans rien réclamer ; la barre garde son compte réel.";

export const LIBELLE_ENTRER_INVITE = "Entrer en invité";
export const LIBELLE_MODE_INVITE = "Mode invité · consultation seule";
export const LIBELLE_QUITTER_INVITE = "Quitter";
export const MENTION_INVITE_LECTURE =
  "En invité, la collection se consulte mais ne se modifie pas.";

export const TITRE_PLANNING = "Planning";
export const LIBELLE_PLANNING_VIDE =
  "Aucune sortie annoncée pour vos éditions. Importez les planning des mois à venir.";
export const LIBELLE_PLANNING_ERREUR = "Le planning n’a pas pu être chargé.";

export const PREFIXE_VALEUR_PARTIELLE = "≥ ";

export const URL_SRU_BNF = "https://catalogue.bnf.fr/api/SRU";
export const LIBELLE_PRIX_SUGGERE = "Prix relevé à la BnF, à corriger si besoin.";
export const LIBELLE_PRIX_RECHERCHE = "Recherche du prix…";

export const TITRE_SCANNER = "Scanner";
export const LIBELLE_SCAN_ISBN_INVALIDE = "Ce code-barres n’est pas un ISBN de livre.";
export const LIBELLE_SCAN_INCONNU = "Aucune notice ne correspond à cet ISBN.";
export const LIBELLE_SCAN_HORS_COLLECTION =
  "Cette édition n’est pas dans votre collection. Cherchez-la pour l’ajouter ou la suivre.";
export const LIBELLE_SCAN_OUVRIR_EDITION = "Ouvrir l’édition";
export const MENTION_NOTICE_SANS_CATALOGUE =
  "Cet ISBN n’est pas au catalogue : cherchez la série par son titre pour l’ajouter.";
export const LIBELLE_SCAN_CANDIDATS_TITRE = "Séries du catalogue au titre proche :";
export const CANDIDATS_SCAN_MAX = 3;
export const CHEMIN_RECHERCHE = "/ajouter";

export const LIBELLE_SCAN_AJOUTER_ET_COCHER = "Ajouter et cocher ce tome";

export const LIBELLE_SCAN_INDISPONIBLE =
  "Le scan par la caméra n’est disponible que sur Android. Saisissez l’ISBN à la main.";
export const LIBELLE_SCAN_INVITE = "Placez le code-barres du dos du tome dans le cadre.";
export const LIBELLE_ISBN = "ISBN";
export const LONGUEUR_ISBN = 13;
export const PREFIXES_ISBN = ["978", "979"];

export const LIBELLE_REFAIRE_MISE_AU_POINT = "Touchez l’image pour refaire la mise au point.";
export const LIBELLE_CAMERA = "Caméra";
export const MENTION_CHOIX_CAMERA =
  "Si l’image reste floue de près, essayez une autre caméra : l’ultra grand-angle ne fait pas le point à courte distance.";
export const CLE_STOCKAGE_CAMERA = "scanner.camera";
export const ZOOM_RAPPROCHE = 2;

export const LIBELLE_SORTIE_OBTENUE = "Je l’ai";
export const LIBELLE_SORTIE_EN_COURS = "…";
