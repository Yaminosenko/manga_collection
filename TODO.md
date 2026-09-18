# Zenkan — travail restant

Le backlog : ce qui reste à construire, à améliorer et à trancher. Sorti de `CLAUDE.md` le
18 septembre 2026, où il pesait 20 000 caractères sur un document relu en entier à chaque
session.

**`CLAUDE.md` fait foi sur la spécification, `JOURNAL.md` sur ce qui est fait, ce fichier sur
ce qui ne l'est pas.** Une entrée qui se termine quitte ce fichier et entre dans `JOURNAL.md` ;
elle n'y reste pas barrée.

L'ordre est celui de la valeur décroissante, pas celui de l'ancienneté. Les renvois en `§` —
`§5`, `§13.1` — désignent les sections de `CLAUDE.md`.

---

## Reste à faire

> **Relu et purgé le 9 septembre 2026**, après vingt-six commits dans la journée. Les entrées
> barrées ont été retirées — `JOURNAL.md` fait foi sur ce qui est fait — et deux entrées qui
> parlaient encore de `creerSerieAvecEdition`, fonction **supprimée depuis**, sont tombées avec
> elle. L'ordre est celui de la valeur décroissante, pas celui de l'ancienneté.

### Ce que le passage à MangaBaka laisse ouvert

Le chantier est **fait et vérifié sur la production le 10 septembre 2026** — voir `JOURNAL.md`.
Ce qui reste :

- **« aot » ne trouve pas L'Attaque des Titans, il trouve SAOTOME LOVE & BOXING.** Le `contains`
  sur le titre attrape `s-aot-ome`, donc la recherche croit avoir trouvé et **le rebond ne part
  jamais**. Le défaut est dans la règle de sous-chaîne, pas dans les alias : c'est elle qui fait
  marcher la frappe partielle (« bleac » → Bleach), donc la resserrer casserait autre chose.
  Deux issues, à trancher : ne considérer comme « trouvé » qu'une correspondance sur le terme
  **entier** — un alias exact ou un `serieNormalise` égal — et laisser le rebond compléter les
  simples sous-chaînes ; ou lancer le rebond en parallèle quand le terme est court. La première
  est plus juste, la seconde plus prévisible en nombre d'appels.
- **Rien n'expire dans `AliasRecherche`, et aucun écran ne la montre.** Une traduction fausse s'y
  installe à demeure ; seule une suppression en base la déloge.
- **`mushoku-tensei` reste sans correspondance** — MangaBaka ne connaît pas « Mushoku Tensei »
  nu, et le terme manuel `Mushoku Tensei : Nouvelle vie, nouvelle chance` le résout, mais les
  trois séries sans correspondance gardent leurs genres d'AniList : `les-legendaires-saga` et
  `my-hero-academia-ultra-archive` sont **absentes du catalogue MangaBaka**, et
  `pandora-heart-8-5` aussi — le guide 8.5 n'y existe pas, seul un artbook « Odds and Ends »
  s'en approche, et ce n'est pas le même objet. Elles sont dans `ABSENTES_DE_MANGABAKA`.
- **Les thèmes venus de MangaBaka sont en anglais**, et n'ont été écrits que sur les 11 séries qui
  n'en avaient aucun — pour ne pas mélanger deux langues dans les 99 valeurs françaises
  existantes. La table de correspondance d'affichage que §13.2 doit déjà aux genres leur est due
  aussi.

### Ce qui améliore le chemin automatique

- **Quand une règle d'acquisition change, les lignes déjà écrites sont *protégées* par
  l'idempotence, pas seulement incomplètes.** Le 11 septembre, 364 groupes — dont One Piece,
  Détective Conan, Bleach, Naruto — portaient un échec écrit **avant** l'ajout du repli sur
  quatre volumes, et le grand passage les a sautés. Il faut invalider explicitement, en
  distinguant ce qui est recalculable (un échec) de ce qui ne l'est pas (une image).
- **`AliasRecherche` n'expire jamais et aucun écran ne la montre.** Une traduction fausse s'y
  installe à demeure, et seule une suppression en base la déloge. C'est le résidu du rebond —
  voir §13.3 pour le mécanisme, `JOURNAL.md` pour ce qui a été fait.
- **Compléter la liste `MARQUEURS_EDITION` du script d'import, puis `--recalculer`** —
  **reporté par décision du 9 septembre 2026, à garder en mémoire.** Le problème n'est pas
  seulement la casse (`Edition Limitée` / `Edition limitée`, `Edition spéciale` /
  `Edition Speciale`) mais l'**absence de marqueurs** : « grimoire » n'y est pas, donc
  « L'Atelier des sorciers - Édition grimoire » sort comme une **série à part** au lieu d'une
  édition. Même racine que les deux écarts de `tomesParus` qui subsistent à l'audit — six
  « Pokémon - La Grande Aventure » distincts au catalogue, dont un « (Glénat) » à 6 tomes qui
  est exactement notre compte.

  `npm run catalogue:apply -- --recalculer` **réécrit les champs dérivés des 52 009 lignes**
  depuis `titreBrut`, sans retélécharger un CSV. Écriture large sur des données de production :
  à faire délibérément. Rien n'est cassé entre-temps, le regroupement en minuscules fait à la
  requête absorbe déjà la casse.
- **Une liste noire de magazines**, dans l'esprit de `RECHERCHES_MANUELLES` : Animeland (257
  « tomes »), Les Inrocks, Made in Japan, Dream Team. Aucune règle automatique ne les distingue
  — l'éditeur ne suffit pas, Glénat en publie, et le nombre de tomes non plus, Détective Conan
  en a 107.
- **`creerDepuisCandidat` reste non vérifiée sur un cas sans aucun EAN.** Tous les essais ont
  porté sur des groupes dont le catalogue connaît les ISBN. Un groupe à `tomesParus = 1` déduit
  d'une absence de numéro et sans EAN créerait un tome nu ; le code le prévoit, personne ne l'a
  vu tourner.
- **Une édition sans aucun ISBN se fait dupliquer par un tap au catalogue** — constaté sur le
  banc le 11 septembre 2026 en éprouvant §13.6. Taper « GANTZ · Édition simple » a créé
  `gantz-2` à 37 tomes **à côté** du `gantz` de l'import à 18 tomes. La cause n'est pas le
  multi-compte : `slugEnCollection` est bien calculé **globalement**, mais par la jointure
  `ParutionCatalogue.ean → Volume.isbn`, et les 18 tomes de `gantz` **n'ont aucun ISBN** — rien
  à joindre, donc le candidat sort comme inconnu. C'est le même angle mort que
  `editions:audit`, « aveugle sur les 23 éditions sans ISBN », et il devient plus probable à
  plusieurs comptes, chacun pouvant taper le même groupe. Le chemin rentable est le même que
  pour les couvertures : **trouver un ISBN à ces éditions dans `ParutionCatalogue`**.

### Ce qui manque à l'application

- **`nom` et `tomesParus` n'ont plus d'endroit où se corriger** depuis la suppression du
  formulaire de confirmation (9 septembre 2026). L'écran État ne propose que statut, parution et
  suivi. Le catalogue est juste dans 99 % des cas mesurés et `editions:audit` rattrape le reste,
  mais le jour où un compte est faux, il l'est pour de bon. **Ces deux champs iront à l'écran
  État** — pas à la création, ce serait revenir à la saisie manuelle écartée.
- **Trancher le vocabulaire de « Terminée par choix ».** L'écran État dit « Suivie / Non
  suivie », la Collection et la page Édition disent encore « Terminée par choix » pour le même
  drapeau. Le rendu n'a pas bougé volontairement, mais les deux mots désignent une seule chose.
- **L'espace collection a été jugé sur téléphone le 17 septembre 2026** et deux des quatre points
  en suspens sont tombés — voir `JOURNAL.md`, « Fait — l'espace collection à trois panneaux » :

  | En suspens | État |
  |---|---|
  | ~~le champ de recherche gagne 46 px là où le bouton de tri s'efface~~ | **réglé** : le bouton est sur les trois panneaux, le bandeau n'a plus qu'une géométrie |
  | la pastille du compte fait 38 px, sous les 44 px de cible tactile | mesuré, non corrigé, **à juger sur l'appareil** — l'alignement sur la ligne de recherche l'impose |
  | 105 px de bandeau ancré, plus la barre du bas | le prix d'avoir la recherche sous la main |
  | ~~le retour d'une page Édition ramène sur le panneau Collection~~ | **réglé de biais** : l'URL suivant le panneau, `<Link href="/">` depuis les Manquants renvoie sur `/manquants`. À confirmer à l'usage |

  **Le glissement horizontal est fait, jugé sur téléphone et fusionné** le 17 septembre 2026 —
  voir §4 et `JOURNAL.md`. Les deux réserves qui restaient après le poste — la concurrence avec
  le geste système « retour » au bord gauche, et un éventuel saut d'une frame à l'ouverture de
  `/manquants` et `/wishlist` — **ne se sont pas manifestées à l'usage**. Reste de cette liste la
  seule qui n'ait pas été levée : la pastille du compte à 38 px.
- **Les couvertures** : **1 966 / 1 979** et **15 sorties sur 19**. **Le remplissage n'est plus
  manuel depuis le 16 septembre 2026** — le cron quotidien acquiert ce qui manque, BnF par EAN
  puis MangaDex. Les 13 tomes qui restent sont exactement ceux que ses garde-fous refusent :

  | Ce qui manque | Cause |
  |---|---|
  | `ippo-s4` t.22–27 · `les-legendaires-saga` t.9 — **7 tomes** | **aucun ISBN en base**, donc rien à demander à la BnF |
  | `ippo-s4` t.3–7 · `grimoire` t.3 — **6 tomes** | ISBN connu mais **sans notice illustrée**, et **MangaDex leur est fermé par décision** : ce sont un découpage VF et une édition marquée, dont la numérotation n'est pas celle de la série de base |
  | `les-legendaires-saga` t.13 · `one-piece` t.114 · `radiant` t.20 · `tsugai` t.11 — **4 sorties** | **structurel** : pas de dépôt légal avant parution, et MangaDex s'arrête au dernier tome paru |

  Le chemin le plus rentable reste **de trouver un ISBN aux 7 premiers dans `ParutionCatalogue`**,
  pas de chercher une source de plus. Les 4 sorties se rempliront d'elles-mêmes à la parution,
  quand le cron les promeut en tome.

  `covers:fetch`, `covers:bnf` et `covers:upload` restent au dépôt et gardent leur usage : un lot
  massif, ou une reprise forcée que le cron ne sait pas demander. Mais **le cas nominal ne passe
  plus par le poste**. Leur sélecteur MangaDex n'a pas été réécrit en TypeScript : le cron
  n'apparie que sur `titre` et `titreVo`, refuse les éditions marquées et exige une numérotation
  comparable, ce qui écarte les fiches satellites par une autre voie que la pénalité de
  `fetch_covers.py`.
- **Une série ajoutée n'a toujours aucune couverture de tome à la création**, mais **elle les a le
  lendemain** : le cron sert en priorité les tomes jamais essayés. Entre-temps la recherche, le
  scanner et la wish list lui trouvent une vignette via `VignetteCatalogue` ; seule la **grille**
  reste en pastilles, et pour une nuit au plus.
- **`Edition.slugMangaNews` est nul sur les 122 éditions**, mais **le lien sortant s'affiche**
  quand même : la page Édition construit une **recherche** manga-news sur le titre, elle n'a
  jamais utilisé ce champ. Le remplir ne ferait que remplacer une recherche par un lien direct
  vers la fiche — un confort, pas un trou. Le planning ne porte pas les slugs ; il faudrait les
  déduire des titres ou les saisir.
- **PWA** : le manifeste et les icônes sont faits, **le service worker non**. Rien n'est mis en
  cache, donc §6 décrit une cible et pas l'état. L'installation, elle, n'attend que le HTTPS.

  **Les icônes sont celles de Zenkan depuis le 17 septembre 2026** — un Z au pinceau sur fond
  papier. Cinq PNG servis depuis `public/icons/` (3 `any`, 2 `maskable`), plus
  `app/apple-icon.png` et `app/favicon.ico` par les conventions de fichiers de Next. Les
  sources — SVG et générateur — vivent dans `design/zenkan/`, qui porte son propre README.

  **Le sceau 全巻 a été retiré le 18 septembre 2026**, et avec lui le seul violet de l'icône : le
  trait est agrandi de 12 % et recentré sur le vide que le sceau laissait. `--color-accent` reste
  `#9184d9` côté interface, mais l'icône ne le porte plus — l'égalité entre les deux, qui était
  la justification d'origine, n'existe plus.

  Deux choses tranchées avec elles : **`background_color` et `theme_color` restent `#161826`**
  et non le papier `#f4efe4` proposé par le jeu d'icônes, sinon le lancement ferait un flash
  clair avant une application qui est en mode sombre uniquement (§7) ; et **c'est la variante
  claire qui est servie**, une icône d'écran d'accueil se posant sur le fond d'écran de
  l'utilisateur et non sur celui de l'application. La variante sombre existe dans
  `design/zenkan/svg/` et n'est pas servie : un manifeste ne sait pas choisir son icône selon
  le thème.

  **Une PWA déjà installée ne se renomme pas toute seule** : il faut désinstaller et
  réinstaller depuis le navigateur.
- **APK autonome par Bubblewrap** : décidé possible, pas fait. `/.well-known/` est déjà ouvert
  côté garde ; restent le keystore et `assetlinks.json`.
- **Thèmes** : **143 valeurs**, dont les 99 françaises d'origine avec leurs coupures d'import
  (`Post` + `apo`, `Super` + `héros`, `Dieux` + `Déesses`, `Combats` / `Combat`) et les anglaises
  venues de MangaBaka sur les 11 séries qui n'en avaient aucune. **Deux langues coexistent donc**,
  et la table de correspondance d'affichage que §13.2 doit aux genres leur est due aussi. Aucun
  écran ne les affiche : sans écran, le nettoyage ne rapporte rien.

### Ce qui tourne en arrière-plan, ou pas

- **Compléter le rafraîchissement de fond de §5.** `app/api/cron/route.ts` en fait deux depuis le
  16 septembre : promouvoir les sorties dont le mois est clos, puis **acquérir les couvertures
  manquantes**. Restent les nouveaux tomes parus et la mise à jour d'`editionTerminee`.
- **Dériver les `Sortie` depuis `ParutionCatalogue`** plutôt que du manifeste de planning. C'est
  déjà le cas **à la création** d'une série depuis le 9 septembre ; il reste à le faire pour les
  éditions existantes, et à faire glisser la fenêtre M-1 → M+6 de §13.1.
- **Automatiser la sauvegarde.** `npm run db:backup` est prouvé mais se lance à la main. Un cron
  Vercel ne peut pas écrire dans le dépôt ; le plus simple reste de le lancer avant chaque
  manipulation de masse et de commiter le résultat.
- **`SuiviEdition.aDejaPossede` reste à trancher, et son backfill n'est exact qu'aujourd'hui.**
  « Une série reste en Collection tant qu'elle a des tomes possédés **ou en a eu** », et « en a
  eu » n'est enregistré nulle part. **Il y a maintenant 5 éditions à zéro tome possédé** : les 4
  `VENDUE` et une entrée de wish list, qui est un cas légitime. Le cas qui manque toujours est
  celui d'une édition qui **retombe** à zéro sans être vendue : rien ne la distinguerait d'une
  envie d'achat. Le backfill `possédés ≥ 1 OR statut = VENDUE` reste juste aujourd'hui et se
  dégradera.

### Échéances et environnement

- **Les cinq `R2_*` sont posées dans Vercel** (16 septembre 2026), **à ne pas re-poser.** Elles y
  sont devenues nécessaires le jour où le cron quotidien s'est mis à **déposer lui-même** les
  couvertures qu'il acquiert : sans elles il lève **dès la première image obtenue** et
  `/api/cron` répond 500, la promotion des sorties ayant déjà eu lieu. Les écrans, eux, n'en ont
  toujours pas besoin — ils lisent les URL absolues stockées en base. `R2_ENDPOINT` se **recopie
  tel qu'affiché**, jamais reconstruit depuis l'identifiant de compte.
- **Supprimer le store Vercel Blob**, décidé le 3 septembre, mûr depuis le **~10 septembre 2026**.
  `del()` est gratuit ; **ne pas ouvrir le navigateur de blobs**, qui consomme le quota
  d'opérations avancées.
- **Brancher un domaine personnalisé sur le bucket R2.** L'URL `r2.dev` est **limitée en débit et
  non mise en cache** par Cloudflare. **Ce n'est pas une latence au premier accès** : mesuré le
  11 septembre, 20 requêtes simultanées rendent 20 fois 200 en 501 ms. Ne pas mettre une case vide
  sur son compte sans avoir regardé le DOM. Le basculement est gratuit et sans réenvoi —
  `covers:migrate` ne réécrit que les URL. Le frein est §7 : un domaine est une dépense
  **certaine et récurrente** (~10 $/an), pas un palier hors d'atteinte, donc l'amendement du
  1er septembre ne le couvre pas.

  **L'achat d'un nom de domaine `zenkanapp.com` a été posé le 17 septembre 2026 et
  délibérément non tranché** — il vit dans `IDEES.md`, avec ce qu'il débloquerait et ce qu'il
  coûte à la contrainte de §7. Rien dans le code ne l'attend : la production reste sur
  `manga-collection-wcj8.vercel.app`.
- **`CRON_SECRET` est posé dans Vercel** (3 septembre, confirmé le 9), **à ne pas re-poser**.
  Deux pièges : `autorise()` rend `false` aussi bien quand le secret est absent que quand
  l'en-tête est faux, donc `/api/cron` répond `401` dans les deux cas et **le sonder ne prouve
  rien** ; et la valeur jumelle est dans le `.env` **de l'autre poste**, donc un appel local ne
  dit rien de la production.

---

## Décisions encore ouvertes

- **Clé d'API Google Books : devenue sans objet.** §5 la voulait pour l'ISBN et la date de
  parution par tome ; le planning manga-news donne les deux, en meilleure qualité et sans clé.
  À rouvrir seulement si une source de couvertures de tome manque un jour.
- **Contradiction dans le handoff** : l'option retenue y est nommée `2b` en tête et `1b` en pied.
  Cosmétique, la description est la même.
- **`Edition.slugMangaNews` est nul sur les 122 éditions.** Le Sheet ne le portait pas. Le lien
  sortant s'affiche néanmoins, sous forme de **recherche** par titre : ce champ ne servirait
  qu'à pointer la fiche directement. Le planning ne porte pas les slugs non plus — il faudrait
  les déduire des titres, ou les saisir.
- **Les 29 éditions dont la BnF n'a rendu aucun numéro** gardent le `tomesParus` du Sheet. Elles
  peuvent être périmées sans qu'on le sache ; le planning en couvre une partie, pas toutes.
- **Mise au point de la caméra du scanner — les trois pistes sont écrites et le scan a
  fonctionné sur téléphone le 9 septembre**, mais aucune des trois n'a été isolée : on ne sait
  pas laquelle a réglé le problème. Le symptôme d'origine : l'autofocus ne converge pas quand
  le tome est tenu trop près : l'appareil principal d'un téléphone ne fait pas le point sous une dizaine
  de centimètres, et l'ultra grand-angle n'a souvent pas de mise au point du tout. Contournement
  connu : éloigner à 20-25 cm, la détection travaillant sur les frames natives en 1920 × 1080.

  Ce qui a été implémenté, et qu'il faut juger **sur téléphone** :

  | Piste | Ce que fait le code |
  |---|---|
  | agrandir l'aperçu | il passe d'une hauteur fixe de 240 px à un `aspect-[4/3]` pleine largeur, soit ~322 px à 430 — assez pour juger la netteté à l'œil |
  | choisir la caméra | un sélecteur apparaît **dès qu'il y a plus d'une caméra**, le choix est mémorisé en `localStorage` et repris au prochain scan ; en cas d'échec du `deviceId` exact, retour à `facingMode: environment` |
  | contrainte de zoom | `ZOOM_RAPPROCHE` (2) est appliqué **si la piste déclare `zoom` avec un maximum > 1**, ce qui recadre au centre et grossit le code-barres |

  Deux ajouts venus avec : le tap sur l'aperçu demande `focusMode: "single-shot"` quand
  l'appareil le déclare — c'est ce qu'un tap-to-focus doit faire — au lieu de réappliquer
  `continuous` ; et le bouton surligné est **la caméra réellement active**, lue dans
  `getSettings().deviceId`, pas celle qui a été demandée.

  **Rien de tout cela n'est vérifiable depuis le poste** : `BarcodeDetector` n'existe pas sur
  Chrome de bureau, et il n'y a pas de caméra utile. Ce qui l'est, c'est la dégradation — sans
  caméra l'écran affiche sa mention, masque l'aperçu, ne montre aucun sélecteur et garde le
  champ ISBN. Si la netteté redevient un problème de près, la piste suivante n'est pas la mise
  au point mais **la lumière** : `torch` est largement supportée sur Android et n'est pas
  implémentée.

  **Une quatrième chose est à juger dans le même passage sur téléphone, ajoutée le 17 septembre
  2026 : l'enchaînement de deux tomes.** Le flux n'est plus coupé à la détection — il l'était, et
  rien ne le rouvrait, donc il fallait **recharger la page entre deux tomes**. L'aperçu reste
  désormais vivant, le résultat s'affiche dessous, et lever le tome suivant suffit. Un code resté
  dans le cadre n'est pas re-résolu : `dernierScan` retient le dernier ISBN soumis, et il est posé
  dans `resoudre`, donc la saisie manuelle et la détection partagent le même garde-fou.

---

