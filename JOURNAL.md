# Manga Collection — journal

Le détail de ce qui a été construit, mesuré et vérifié, entrée par entrée, de l'import du
Google Sheet au déploiement. Sorti de `CLAUDE.md` le 7 septembre 2026, où il pesait les deux
tiers du document.

**`CLAUDE.md` fait foi sur la spécification et sur les décisions ; ce fichier fait foi sur ce
qui est déjà fait.** Avant de conclure qu'une fonctionnalité n'existe pas, la chercher ici :
l'omission d'une seule ligne a déjà fait croire à une session que l'application n'était pas
déployée.

**Les entrées sont datées et l'ordre compte.** Aucune n'est réécrite après coup — une décision
plus tardive la révise sans la corriger. En cas de contradiction, **la date la plus récente
gagne** : la grille est passée de 4 à 2 colonnes, les couvertures de Vercel Blob à Cloudflare
R2, et les deux états sont décrits ici, chacun à sa date.

Le préfixe dit la nature de l'entrée — **Fait** pour une construction, **Corrigé** pour un
défaut trouvé et sa cause, **Tranché** pour un arbitrage, **Établi** pour une mesure ou une
sonde.

Les renvois en `§` — `§5`, `§13.1` — désignent les sections de `CLAUDE.md`.

---

### Fait — étape 1

Schéma et seed. Les sept compteurs de §8 tombent juste en base :
108 séries, 112 éditions, 1640 tomes, 1148 possédés, 37 à vérifier, 3 forcées, 4 multi-éditions.

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | les 4 tables, l'énumération de statut, les contraintes d'unicité |
| `prisma/migrations/` | la migration initiale, déjà appliquée à Neon |
| `prisma/seed.ts` | `npm run db:seed` — refuse d'écraser sans `--reset` |
| `scripts/apply-migrations.ts` | `npm run db:migrate` — applique les migrations sur le 443 |
| `lib/prisma.ts` | le client partagé, adaptateur Neon |
| `app/globals.css` | les tokens Nocturne, aucune couleur ailleurs |
| `app/page.tsx` | page provisoire : trois compteurs lus en base, à remplacer |

Next 16.3, React 19.2, Tailwind 4, Prisma 7.10. `npm run build` et `npm run lint` passent.

### Fait — étape 2

Page Édition et sous-page « Mes tomes » (§4). Vérifié sur les 112 éditions réelles :
routes servies, écriture de `Possession` confirmée contre Neon, `npm run build` et
`npm run lint` passent.

| Fichier | Rôle |
|---|---|
| `app/edition/[slug]/page.tsx` | la page Édition : en-tête, bouton d'accès, carrousel, autres éditions, pied |
| `app/edition/[slug]/tomes/page.tsx` | la sous-page de sélection |
| `app/edition/[slug]/{loading,error,not-found}.tsx` | les états de la route |
| `components/volume-grid.tsx` | la grille de couvertures, client, `useOptimistic` |
| `components/progress-bar.tsx` | la barre à trois zones, `flex-grow` + zone fixe |
| `components/cover.tsx` | couverture ou placeholder numéroté |
| `components/icons.tsx` | les glyphes Phosphor inlinés, sans dépendance runtime |
| `components/offline-banner.tsx` | le bandeau « Hors ligne · consultation seule » |
| `lib/editions.ts` | `chargerEdition` et les règles dérivées |
| `lib/actions.ts` | `basculerTome`, `definirTousLesTomes` |
| `lib/constants.ts`, `lib/format.ts` | seuils, libellés, prix en centimes |
| `lib/use-online.ts` | `useEnLigne`, via `useSyncExternalStore` |

Décisions prises en chemin :

- **Icônes inlinées, pas de paquet.** `@phosphor-icons/react` consomme un contexte React et
  forcerait une frontière client sur chaque icône. Les tracés sont copiés depuis
  `@phosphor-icons/core`, récupéré hors du dépôt.
- **`no-img-element` désactivé dans `eslint.config.mjs`.** La règle pousse vers `next/image`,
  que §5 interdit. La décision a sa place dans la configuration, pas dans un composant.
- **`aVerifier` passe à `false` dès le premier tap** dans la grille, conformément au handoff.
  Un seul tap ne prouve pourtant pas que les 42 tomes ont été revus.
- **404 mou sur un slug inconnu.** `loading.tsx` ouvre une frontière Suspense : la coquille
  part en 200 avant que `notFound()` ne soit atteint. L'écran « introuvable » s'affiche
  correctement, seul le statut HTTP est faux. L'état de chargement l'emporte — §7 l'impose,
  Neon dort après 5 minutes.
- **Le bouton `dots-three-outline` de la barre de nav n'est pas rendu** : il n'ouvre rien en
  V1, et un contrôle inerte se lit comme un bug.
- **`app/page.tsx` liste les éditions en liens bruts**, juste de quoi atteindre les nouveaux
  écrans. C'est le point de départ de l'étape 3, pas la Collection.

### Fait — étape 3

Collection (§4). Vérifié sur les données réelles : en-tête « 1 148 tomes · 108 éditions »,
108 lignes rendues, section « Vendues » repliée avec son compteur 4, `npm run build` et
`npm run lint` passent.

| Fichier | Rôle |
|---|---|
| `app/page.tsx` | la Collection, remplace la page provisoire |
| `app/{loading,error}.tsx` | les états de la route |
| `components/collection-list.tsx` | recherche, menu de tri, section « Vendues » |
| `components/collection-row.tsx` | l'anatomie d'une ligne |
| `lib/domain.ts` | les types et les règles pures, sans Prisma |
| `lib/use-sort-preference.ts` | la préférence de tri mémorisée |

Décisions prises en chemin :

- **`lib/domain.ts` séparé de `lib/editions.ts`.** Turbopack refuse de construire dès qu'un
  composant client importe une valeur d'un module qui tire Prisma : le bundle navigateur
  réclame alors `node:module`. Les types et les règles pures vivent donc dans un module sans
  accès aux données, `lib/editions.ts` ne garde que les requêtes.
- **La préférence de tri passe par `useSyncExternalStore`**, comme l'état réseau.
  `localStorage` est un store externe ; le lire dans un `useEffect` déclenche un rendu en
  cascade, que la règle `react-hooks/set-state-in-effect` refuse à raison.
- **Sous-titre et icône portent deux signaux différents.** 19 des 37 éditions « à vérifier »
  sont aussi abandonnées ou en pause : avec une seule précédence, leur drapeau disparaissait
  de l'écran alors que §4 en fait un critère de tri. Le sous-titre suit le statut personnel
  (§3), l'icône suit `aVerifier` en premier. Chaque combinaison montre donc ses deux états.
- **Sens de tri par défaut selon le critère** : alphabétique croissant, les quatre autres
  décroissants — le plus de tomes, le plus complet, le plus récent, à vérifier en premier.
  Le sens reste inversable et le choix mémorisé.
- **Recherche et filtrage côté client.** Les 112 éditions sont déjà chargées ; filtrer en
  local évite un aller-retour serveur et fonctionne en consultation hors ligne.
- **La barre d'onglets n'est pas rendue.** Manquants et Ajouter n'existent pas encore ;
  deux onglets morts se lisent comme un bug. Elle arrive avec l'étape 4.
- **Pas de badge de complétion sur la ligne.** §4 en mentionne un, le handoff n'en décrit
  aucun et fait foi sur le rendu. La complétion se lit au sous-titre « Complète » et à
  l'absence de zone hachurée. À trancher si le signal manque à l'usage.

### Fait — étape 4

Manquants (§4) et la barre d'onglets. Vérifié sur les données réelles : **442 tomes sur
34 éditions**, soit les 492 manquants de la base moins les 42 tomes des 4 vendues et les
8 des 3 complétions forcées. `npm run build` et `npm run lint` passent.

| Fichier | Rôle |
|---|---|
| `app/(tabs)/layout.tsx` | le groupe de routes qui porte la barre d'onglets |
| `app/(tabs)/manquants/page.tsx` | l'écran Manquants |
| `components/missing-group.tsx` | un groupe : édition, puis les numéros manquants en pastilles |
| `components/tab-bar.tsx` | la barre d'onglets |

Décisions prises en chemin :

- **Groupe de routes `app/(tabs)/`.** La barre d'onglets appartient à la Collection et aux
  Manquants, pas à la page Édition ni à « Mes tomes » — le handoff les montre en écran plein
  avec leur propre retour. Le groupe de routes porte donc la barre sans polluer l'URL.
  Vérifié : présente sur les deux premiers écrans, absente des deux autres.
- **Deux onglets, pas trois.** Ajouter n'existe pas encore ; le troisième onglet arrive avec
  l'étape 5.
- **Les pastilles ne sont pas cliquables** et le groupe pointe vers la page Édition, jamais
  vers « Mes tomes » : §4 fait du bouton `X / Y TOMES` le seul accès à la sous-page.
- **Purger `.next` après un déplacement de route.** Le validateur de types généré garde une
  référence à l'ancien chemin et fait échouer la vérification TypeScript.

### Tranché — le périmètre des Manquants

§4 n'excluait que les vendues et les complétions forcées, et 19 des 34 éditions affichées,
320 des 442 tomes — 72 % de l'écran — étaient des séries abandonnées ou en pause. Lu comme
une liste de courses, l'écran était dominé par ce qu'on a arrêté d'acheter.

**Décision : section repliée**, comme les vendues sur la Collection. Rien n'est perdu, la
liste principale redevient une liste d'achat. L'écran affiche **122 tomes sur 15 éditions**,
et « Abandonnées et en pause » en compte 19. Les compteurs d'en-tête portent sur la seule
liste principale, comme §3 le fait déjà pour les vendues.

Le motif est extrait dans `components/collapsible-section.tsx`, partagé avec les vendues.

### Fait — étape 5

Ajout de série via API (§4), et le troisième onglet. **La clé Google Books n'a pas été
nécessaire** : AniList suffit au niveau série, qui est tout ce que l'ajout demande.

| Fichier | Rôle |
|---|---|
| `app/(tabs)/ajouter/page.tsx` | l'écran d'ajout |
| `components/add-series.tsx` | recherche puis confirmation d'édition, deux phases |
| `lib/anilist.ts` | le client GraphQL et la conversion vers le modèle métier |
| `lib/creation.ts` | `creerSerieAvecEdition` — slugs uniques, tomes, possessions |
| `lib/slug.ts` | `slugifier`, transposition de celui de `scripts/import_sheet.py` |

Décisions prises en chemin :

- **Deux phases dans une seule route.** Passer par `/ajouter/[id]` aurait imposé un second
  appel AniList à l'ouverture de l'écran de confirmation. La série choisie reste en état
  client ; aucun appel externe n'a lieu à l'ouverture de `/ajouter`, seulement à la frappe.
- **Lecture de §5.** « Jamais à l'ouverture d'un écran » vise le chargement des écrans, pas
  une recherche que l'utilisateur déclenche — §4 la prescrit explicitement. Recherche
  temporisée à 350 ms, deux caractères minimum, dix résultats.
- **La couverture AniList n'est jamais enregistrée.** Elle sert d'aperçu dans les résultats,
  le temps du choix. §5 interdit de stocker une URL d'API externe : les éditions créées
  arrivent donc avec `couvertureUrl` nul, comme tout le reste aujourd'hui.
- **L'auteur se déduit des rôles sans langue entre parenthèses.** AniList mêle créateurs et
  traducteurs dans `staff` ; « Story & Art » n'a pas de parenthèse, « Translator (French) »
  en a une. Discriminant vérifié sur des cas réels.
- **`tomesParus` est pré-rempli avec le compte japonais** et signalé comme indicatif —
  §5 rappelle qu'il ne vaut pas pour la France. `editionTerminee` n'est jamais déduit du
  `status` AniList : c'est une case à cocher.
- **`aVerifier` est faux à la création** : la répartition n'est pas devinée, elle est saisie.
- **Slug d'édition selon la convention d'import** : égal au slug de série pour
  « Édition simple », suffixé du nom sinon. Collision résolue par un suffixe numérique.
- **La création est sortie de `lib/actions.ts`** vers `lib/creation.ts` : un module « use
  server » ne peut exporter que des fonctions asynchrones, et la logique y devient testable
  hors contexte de requête.

Vérifié sur la vraie base, avec nettoyage : série créée avec 5 tomes numérotés, 5 possessions
à `false`, prix en centimes, doublon de titre résolu en `-2`, puis suppression — les
compteurs reviennent à 108 / 112 / 1640 / 1148. Recherche « berserk » : 2 éditions locales,
et le « Berserk » d'AniList marqué déjà en collection quand « Berserk of Gluttony » ne l'est
pas. Une requête d'un caractère ne déclenche aucun appel externe.

### Tests navigateur — 28 août 2026

Première campagne de tests à la souris, sur les données réelles. Tout ce qui suit a été
exercé et vérifié dans Chrome : recherche, menu de tri et sa mémorisation après rechargement,
page Édition, cochage et décochage d'un tome avec persistance en base, écran Manquants,
recherche AniList, formulaire de confirmation et création complète d'une édition.

**Corrigé — les éditions multiples étaient indistinguables.** Sur la Collection, les deux
éditions de BERSERK affichaient toutes deux « À vérifier » : le sous-titre remplaçait le nom
d'édition par l'état, et rien ne les séparait. L'écran Manquants, lui, affichait bien
« Édition Prestige » et « Édition simple ». Le sous-titre de la Collection montre désormais
`Nom · état` quand la série compte plusieurs éditions, et l'état seul sinon — le nom
d'édition n'apporte rien sur les 104 séries à édition unique.

**Tranché — l'effacement de `aVerifier` reste tel quel.** Le journal du serveur montre le cas
en clair : `basculerTome("air-gear", 1, true)` puis `basculerTome("air-gear", 1, false)`. La
possession revient à son état de départ, le drapeau non : cocher puis décocher un tome, geste
rigoureusement neutre, détruit définitivement l'information. **Comportement conservé
(29 août 2026)** — le drapeau signale une répartition devinée, et toucher la grille suffit à
prouver qu'on l'a regardée. À rouvrir si la perte se fait sentir à l'usage.

**Reporté — pas de largeur maximale.** Sur un écran large, la grille de « Mes tomes » étale
quatre cases de près de 400 px. Le design est coté pour 390 px. **Se tranchera au test sur
téléphone (29 août 2026)**, en même temps que le reste du rendu tactile.

**Tranché — les genres passent à l'anglais.** Une série ajoutée affiche « Action · Adventure ·
Drama » quand la collection importée porte « Aventure · Fantastique · Horreur ». **Décision
(29 août 2026) : aligner les 108 séries importées sur la liste fermée d'AniList**, vérifiée
contre l'API — 19 valeurs : Action, Adventure, Comedy, Drama, Ecchi, Fantasy, Hentai, Horror,
Mahou Shoujo, Mecha, Music, Mystery, Psychological, Romance, Sci-Fi, Slice of Life, Sports,
Supernatural, Thriller.

Quatre valeurs de la collection n'y ont pas d'équivalent — `School Life` (5), `Mature` (4),
`Guide` (4), `Nekketsu` (2) : ce sont des *tags* AniList, pas des genres. **Elles basculent
dans `themes`**, rien n'est perdu.

L'alignement absorbe au passage le bruit d'import : `Science` et `fiction` sont les deux
moitiés de « Science-fiction », découpée par le tiret de `SEPARATEURS_GENRES`
(`import_sheet.py:28`, `[,\-–/]`) — même cause pour `Post` + `apocalyptique` et `Super` +
`héros` dans les thèmes. S'y ajoutent les doublons de casse et d'accent : `Slice of Life` /
`Slice of life`, `Mystère` / `Mystere`, `Drame` / `Drama`, `Psychologie` / `Psychologique`.

**`themes` reste en français pour l'instant** : `lib/anilist.ts` ne récupère que `genres`,
jamais les tags, donc les 96 thèmes n'ont aucun vis-à-vis. À reprendre le jour où on ira
chercher les tags AniList. **Pas encore fait.**

**Non testé** : le rendu sur un vrai téléphone. `resize_window` n'a pas eu d'effet sur ce
poste, tous les tests se sont faits à 1920 px. La vérification tactile passe par l'URL réseau
qu'affiche `npm run dev`, ouverte depuis le mobile sur le même Wi-Fi.

### Fait — éditeurs depuis la BnF (29 août 2026)

`Edition.editeur` était nul sur les 112 éditions ; il l'est encore sur 12.

| Fichier | Rôle |
|---|---|
| `scripts/fetch_publishers.py` | interroge le catalogue SRU de la BnF et déduit l'éditeur |
| `data/publishers.json` | le résultat, versionné — 100 éditions, 18 éditeurs |

Décisions prises en chemin :

- **Le garde-fou est l'auteur, pas le titre.** Une recherche sur un titre court remonte
  n'importe quoi ; on ne retient que les notices dont `dc:creator` ou le titre contient un
  jeton du champ `auteur`. `ONE PUCH MAN` remonte 46 notices retenues mais son éditeur
  dominant ne pèse que 6 % : le seuil de 50 % le refuse, ce qui est le bon comportement.
- **La BnF flanche par intermittence.** `black-clover` est ressorti bredouille au premier
  passage et donne `Kazé` au simple réessai. Tout échec mérite une seconde tentative.
- **Repli sur le titre AniList** quand le titre VF ne donne rien : `ITCHI THE WITCH` →
  *Ichi the Witch* → Ki-oon.
- **Noms canonisés** via `EDITEURS_CANONIQUES` : `Éd. Ki-oon` → `Ki-oon`,
  `Dargaud Bénélux-Kana` → `Kana`, `Pika` et `Pika édition` → `Pika Édition`.
- **Aucun changement de composant n'a été nécessaire** : `app/edition/[slug]/page.tsx` et
  `components/missing-group.tsx` composaient déjà `Nom · Éditeur`, le champ était simplement
  vide. La Collection, elle, garde le sous-titre d'état décidé à l'étape 3.

**Les 12 restants sont bloqués par les fautes de frappe du Sheet**, pas par la BnF : `ONE PUCH
MAN` (PUNCH), `SAGA OF TANY` (TANYA), `MARIMASHITA` (MAIRIMASHITA), `ORIANT` (ORIENT). AniList
bute sur les mêmes. À corriger dans les titres, ou à saisir à la main.

### Fait — PWA installable (29 août 2026)

`app/manifest.ts`, icônes et métadonnées mobiles. `npm run build` sort
`/manifest.webmanifest` et `/apple-icon.png` en routes statiques.

| Fichier | Rôle |
|---|---|
| `app/manifest.ts` | le manifeste, via `MetadataRoute.Manifest` |
| `scripts/generate_icons.py` | dessine les icônes en lisant les tokens de `globals.css` |
| `public/icon-192.png`, `public/icon-512.png` | les icônes du manifeste, dont une `maskable` |
| `app/apple-icon.png` | l'icône iOS, liée automatiquement par la convention Next |

Décisions prises en chemin :

- **Les icônes sont générées, pas dessinées à la main.** `generate_icons.py` lit
  `--color-bg`, `--color-accent`, `--color-accent-400` et `--color-accent-700` dans
  `app/globals.css` : trois tranches de livres sur le fond Nocturne. Changer la palette et
  relancer le script suffit à refaire le jeu complet.
- **`COULEUR_FOND_APPLICATION` dans `lib/constants.ts` duplique `--color-bg`.** Un manifeste
  est du JSON, il ne peut pas lire une variable CSS. C'est la seule couleur en dur du code,
  isolée dans une constante nommée. **Elle doit suivre `--color-bg` à la main.**
- **`viewport-fit=cover` avec `statusBarStyle: black-translucent`**, donc les encoches sont
  gérées explicitement : `pt-[env(safe-area-inset-top)]` sur le `body` et
  `pb-[calc(18px+env(safe-area-inset-bottom))]` sur la barre d'onglets. Hors mode plein
  écran ces valeurs valent zéro, rien ne bouge dans un navigateur.
- **Next émet `mobile-web-app-capable`**, pas la variante préfixée Apple, qui est dépréciée.

**L'installation exige HTTPS.** Chrome ne propose « Installer » que dans un contexte sécurisé ;
`localhost` y échappe, une adresse IP de réseau local en HTTP non. **Le test sur téléphone via
`http://192.168.1.13:3000` valide donc la mise en page, jamais l'installation.** Celle-ci
attendait le déploiement Vercel : **c'est fait, la PWA est installée depuis la production** —
voir « Fait — le déploiement ».

**Pas de service worker.** §6 (données texte en cache, images volontairement hors cache) reste
entier : aujourd'hui le hors-ligne se limite au bandeau et à l'inertie des pastilles. À noter :
cette version de Next documente `experimental.useOffline`
(`node_modules/next/dist/docs/01-app/02-guides/offline-support.md`), qui met les navigations et
Server Actions en attente au lieu de les faire échouer — à évaluer avant d'écrire un service
worker à la main.

### Tranché — 2 colonnes et largeur maximale (29 août 2026)

Premier test sur un vrai téléphone, via l'URL réseau du serveur de développement.

**La grille passe de 4 à 2 colonnes.** Le handoff prescrit 4 et fait foi sur le rendu ; il est
écarté ici sur constat d'usage. Sur un écran de ~360 px CSS la case passe d'environ 74 px à
157 px de large. Le coût est le défilement : Berserk passe de 11 à 21 rangées, Bleach de 19 à
37. **3 colonnes reste le compromis** si le défilement devient pénible — une seule constante à
changer. La décision est prise avec les couvertures à l'écran, pas sur des cases vides.

**`COLONNES_GRILLE` est enfin la source de vérité.** Elle existait dans `lib/constants.ts`,
valait 4, et **n'était importée nulle part** : `components/volume-grid.tsx` codait `grid-cols-4`
juste à côté. Changer la constante n'avait aucun effet. La grille passe par
`gridTemplateColumns` en style en ligne, Tailwind ne sachant pas interpoler `grid-cols-${n}`.

**Conteneur centré à `LARGEUR_MAX_APPLICATION` = 430 px**, posé dans `app/layout.tsx` autour du
bandeau hors-ligne et des écrans. À 2 colonnes, un écran large donnait des couvertures de
~700 px : la largeur maximale n'était plus un confort mais une nécessité. La barre d'onglets
est dans le conteneur, l'application se lit comme une colonne d'app sur bureau.

**Détail non traité** : les trois cases fantômes « à paraître » forment désormais une rangée
pleine plus une orpheline. `CASES_A_PARAITRE` reste à 3, conformément au handoff.

### Fait — les couvertures (29 août 2026)

Autorisation obtenue de MangaDex. **1 426 couvertures sur 1 640, soit 87 % de la collection**
et 89 % des éditions visées. 38 Mo sur disque, 23,4 Ko de moyenne — l'estimation de ~18 Ko de
§5 était basse, l'ordre de grandeur tient.

| Fichier | Rôle |
|---|---|
| `scripts/fetch_covers.py` | `npm run covers:fetch` — résout, télécharge, redimensionne |
| `scripts/upload-covers.ts` | `npm run covers:upload` — dépose dans Blob et écrit `couvertureUrl` |
| `data/covers.json` | le manifeste, versionné |
| `data/mangadex_ids.json` | le cache des identifiants MangaDex, versionné |

Décisions et pièges :

- **Le premier passage n'a donné que 66 %, à cause d'un bug d'appariement, pas d'un manque de
  données.** Le sélecteur prenait la première fiche dont le titre correspondait, et MangaDex
  héberge des fiches satellites au titre identique : `Bleach (Pre-Serialization)` avec une
  seule couverture, `Watashi no Hero Academia` qui est une parodie,
  `En'en no Shouboutai (Fan Colored)`. Bleach repartait avec 1 tome sur 74.
- **Le correctif rassemble tous les candidats, pénalise les marqueurs de fiche satellite, puis
  départage les quatre premiers en comptant leurs couvertures réelles.** La fiche canonique
  gagne toujours : c'est elle qui en a le plus. Deuxième passage : 66 % → 89 %.
- **La similarité remplace l'égalité stricte des titres** (`SEUIL_SIMILARITE = 0.86`), ce qui
  absorbe les fautes de frappe du Sheet : `ONE PUCH MAN` trouve *One Punch-Man*,
  `MARIMASHITA ! IRUMA-KUN !` trouve *Mairimashita! Iruma-kun*.
- **Le script est repris sur incident** : un fichier déjà présent n'est pas retéléchargé et les
  identifiants sont mis en cache. Relancer coûte quelques appels, pas 1 400 images.
- **Débit à 3 req/s**, sous les 5 documentées, User-Agent honnête, images recopiées et jamais
  liées à chaud, comme leur documentation l'exige.
- **Piège rencontré : supprimer des fichiers ne nettoie pas la base.** 8 volumes de
  `soul-eater-edition-double` pointaient encore vers des fichiers effacés. Toute suppression de
  couverture doit remettre `couvertureUrl` à null dans le même geste.

**Ce qui reste sans couverture, et pourquoi :**

| Cause | Tomes |
|---|---|
| 5 éditions non simples, exclues volontairement — un tome double ne correspond à aucun tome japonais | 36 |
| 15 éditions sans correspondance MangaDex : hors-séries et databooks (`bleach-13-blades`, `pandora-heart-8-5`, `my-hero-academia-ultra-archive`), et titres trop éloignés (`UQHOLDER` pour *UQ Holder!*) | 177 |
| `remember` : fiche trouvée, aucune couverture déposée | — |
| `solo-leveling` : 18 sur 19 | 1 |

**Les couvertures ne sont pas dans git** (`public/covers/` est ignoré). Le poste local ne sert
plus qu'à les acquérir : depuis leur dépôt dans Blob, l'application lit les mêmes URL en
production et en développement.

### Fait — les couvertures dans Vercel Blob (30 août 2026)

Les 1 426 couvertures sont déposées dans le store Blob et `couvertureUrl` porte désormais leur
URL absolue. Vérifié : **1 426 URL absolues, aucun chemin local restant**, sept compteurs
intacts.

| Fichier | Rôle |
|---|---|
| `scripts/upload-covers.ts` | `npm run covers:upload` — liste, envoie, écrit `couvertureUrl` |
| `data/blob.json` | l'origine du store, versionnée |

- **Le store doit être créé en accès *public*.** Le premier, créé en privé, a refusé les 1 426
  envois d'un bloc : `Cannot use public access on a private store`. Un blob privé se lit par
  `get()` côté serveur — chaque couverture passerait par une fonction serverless, ce qui casse
  « servies telles quelles » et le cache immuable de §5, et brûlerait les invocations du plan
  Hobby. Les jaquettes ne sont pas des données personnelles : la confidentialité vient de
  Vercel Authentication sur l'application, pas du store.
- **`couvertureUrl` est l'URL absolue Blob**, pas un chemin relatif. Le poste local lit donc les
  mêmes images que la production, et `npm run covers:fetch` n'est plus nécessaire pour afficher
  l'application — seulement pour acquérir de nouvelles couvertures.
- **`scripts/apply-covers.ts` est supprimé.** Il écrivait `/covers/<slug>/<n>.webp` ; le lancer
  après la bascule aurait écrasé les 1 426 URL par des chemins morts en production. Un seul
  auteur de `couvertureUrl` désormais : `covers:upload`.
- **Reprise sur incident** : le script liste le store avant d'envoyer, donc un relancement
  n'expédie que ce qui manque. Vérifié — le second passage a vu la couverture de l'essai déjà
  en place et n'a envoyé que les 1 425 autres.
- **Cache confirmé sur l'URL publique** : `Cache-Control: public, max-age=31536000`, soit
  l'année immuable que §5 demande.

### Corrigé — l'interactivité était morte depuis le téléphone (29 août 2026)

Sur mobile, l'affichage était parfait mais **aucun tap ne faisait rien** : ni cochage, ni
recherche, ni navigation.

**Cause : Next bloque par défaut l'accès aux ressources de développement depuis une autre
origine.** Le journal le dit en clair —
`Blocked cross-origin request to Next.js dev resource /_next/static/chunks/... from "192.168.1.13"`.
Le HTML rendu côté serveur arrivait intact, donc l'écran semblait normal ; **les chunks
JavaScript, eux, n'étaient jamais servis**, React n'hydratait pas, et aucun gestionnaire
d'événement n'existait. Tout ce qui est visuel marchait, tout ce qui est interactif était mort.

**Correctif** : `allowedDevOrigins` dans `next.config.ts`, couvrant les sous-réseaux privés
courants pour survivre à un changement de bail DHCP. C'est une option de développement, sans
effet en production.

Vérifié de bout en bout depuis `192.168.1.13` : `POST /edition/chainsaw-man/tomes 200`,
`possede` bascule en base, les compteurs reviennent à 1 148 après annulation.

**Piège de diagnostic à retenir** : chercher la présence des clés `__reactFiber$*` sur un
élément du DOM n'est **pas** un test fiable d'hydratation, et un événement `input` fabriqué à
la main ne déclenche pas toujours un `onChange` React. Les deux m'ont fait croire que
l'application entière était cassée sur bureau, ce qui était faux. **Le seul test valable est
fonctionnel** : cliquer pour de vrai, puis regarder l'écran et la base.

### Fait — la garde d'accès (30 août 2026)

§7 promettait Vercel Authentication en portée `All Deployments`, « inclus sur Hobby ». C'est
faux : cette portée est réservée aux plans Pro. Le domaine de production d'un projet Hobby est
publiquement accessible, avec les prix payés et la valeur de la collection derrière. La garde
passe donc dans l'application.

| Fichier | Rôle |
|---|---|
| `proxy.ts` | intercepte toute requête et redirige vers `/acces` sans cookie valide |
| `lib/auth.ts` | le jeton : HMAC-SHA256 du mot de passe, comparaison à temps constant |
| `lib/guard.ts` | `exigerAcces`, la seconde couche, appelée dans chaque Server Action |
| `lib/auth-actions.ts` | `deverrouiller` — pose le cookie, un an, `httpOnly` |
| `app/acces/page.tsx`, `components/access-form.tsx` | l'écran de mot de passe |

- **`proxy.ts`, pas `middleware.ts`.** Next 16 a renommé le fichier ; `middleware.ts` est
  déprécié. Le proxy tourne en runtime **Node.js** par défaut, donc `node:crypto` est
  disponible et il n'y a pas à passer par la Web Crypto.
- **Deux couches, parce que la documentation l'exige.** Elle est explicite : *« Always verify
  authentication inside each Server Function rather than relying on Proxy alone »* — un
  changement de `matcher` peut silencieusement découvrir une Server Action. Les quatre actions
  de `lib/actions.ts` appellent donc `exigerAcces` en première ligne.
- **Le manifeste et les icônes restent hors garde**, sinon l'installation de la PWA se
  comporte mal avant la connexion. Ils ne révèlent rien.
- **L'erreur passe par `useActionState`, pas par une query string.** Première version :
  `redirect("/acces?refuse=1")`. Le serveur répondait bien `303 → /acces?refuse=1` — vérifié
  au curl — mais la navigation client perdait le paramètre et le message ne s'affichait
  jamais. `useActionState` est de toute façon le motif déjà en place pour `creerEdition`.
- **Sans `ACCESS_PASSWORD`, tout est refusé** et l'écran le dit. Échec fermé, volontairement.

**Piège de test rencontré, à nouveau.** L'action `type` du pilote de navigateur ne déposait pas
le texte dans le champ mot de passe ; cliquer sur « Entrer » ne déclenchait alors que la
validation native du champ `required`, sans aucune requête — ce qui ressemblait trait pour
trait à une hydratation morte. `form_input` sur la référence de l'élément fonctionne. C'est la
troisième fois que la sonde ment : **seul un test fonctionnel abouti prouve quelque chose.**

Vérifié de bout en bout en `npm run start` : `/`, `/manquants` et `/edition/<slug>/tomes` en
307 vers `/acces` sans cookie ; manifeste et icônes en 200 ; mauvais mot de passe refusé avec
le message ; bon mot de passe menant à la Collection ; les couvertures servies depuis Blob en
200 ; un tome décoché puis recoché sur `burn-the-witch`, base à 1 147 puis 1 148.

### Fait — l'enrichissement AniList (30 août 2026)

Les genres passent à la liste fermée d'AniList, décidée le 29 août. Au passage `titreVo`, qui
était **nul sur les 108 séries**, est rempli sur 101.

| Fichier | Rôle |
|---|---|
| `scripts/fetch-anilist.ts` | `npm run anilist:fetch` — résout, n'écrit que le manifeste |
| `scripts/apply-anilist.ts` | `npm run anilist:apply` — écrit en base, `--revert` pour annuler |
| `data/anilist.json` | le manifeste, versionné, relu à la main entre les deux |
| `data/series-avant-anilist.json` | l'état des 108 séries avant écriture, versionné |

Résultat : **104 correspondances sur 108**, 17 genres distincts contre 27 avant, tous dans la
liste fermée. `titreVo` à 104/108. Les sept compteurs sont intacts.

- **Le seuil de similarité ne marche pas ici, et c'est le point central.** `fetch_covers.py`
  départage ses candidats MangaDex à 0,86 de similarité ; transposer cette approche à AniList
  aurait tout cassé. `BLUE EYES SWORD` → *Hinowa ga Yuku!* marque **0,000** et c'est la bonne
  réponse ; `L'ATTAQUE DES TITANS` → *Shingeki no Kyojin* marque 0,529. **AniList indexe les
  synonymes, y compris les titres français : c'est sa pertinence de recherche qui fait le pont,
  pas la ressemblance des chaînes.** Le score est conservé comme *indicateur* de relecture,
  jamais comme filtre.
- **La troncature automatique du titre est dangereuse.** Couper avant le tiret récupère bien
  `MIRAI NIKKI - LE JOURNAL DU FUTUR` → *Mirai Nikki*, mais `POKEMON - LA GRANDE AVENTURE`
  tronqué en `POKEMON` rend *Kabigon no Yume Gourmet*, et `YURAGI` rend *Natsu no Su*. Faux
  appariements confiants, qu'aucun score ne rattrape puisque le score ne vaut rien ici.
  **D'où `RECHERCHES_MANUELLES`**, une table écrite à la main — même forme que
  `EDITEURS_CANONIQUES` — qui a fait passer la résolution de 79 à 101, puis à 104 avec trois
  titres japonais fournis à la main : *Saint Seiya: The Lost Canvas - Meiou Shinwa Gaiden*,
  *YoRHa: Shinjuwan Kouka Sakusen Kiroku*, *Yasei no Last Boss ga Arawareta!*.
- **AniList limite à 30 requêtes par minute, pas 90.** À 1 req/s le script s'est fait couper
  par une rafale de 429 après 34 séries. Réglé à 28/min, avec respect de l'en-tête
  `Retry-After`. Le cache par slug rend la reprise gratuite ; les échecs, eux, sont
  réinterrogés à chaque passage pour qu'un ajout dans la table prenne effet sans purge.
- **Deux temps, avec relecture humaine au milieu.** Aucune validation automatique n'étant
  possible, `anilist:fetch` n'écrit que le manifeste et `anilist:apply` seul touche la base,
  après avoir sauvegardé l'état des 108 séries.
- **Les 4 valeurs orphelines basculent en thèmes** — `School Life`, `Mature`, `Guide`,
  `Nekketsu` — comme le 29 août l'avait prévu. Vérifié en base : les quatre y sont.
- **Les 4 séries sans correspondance gardent leurs genres, traduits** par une table de trois
  entrées (`Aventure`, `Comédie`, `Fantastique`). Deux databooks se retrouvent sans genre du
  tout, ce qui est exact : leur seul genre était `Guide`. `ABSENTES_D_ANILIST` les liste pour
  qu'elles cessent d'être réinterrogées à chaque passage.
- **Trois hors-séries héritent de leur série mère, et c'est assumé** (30 août) :
  `PANDORA HEART – 8,5` et `THE ANCIENT MAGUS BRIDE – Supplément 2` n'avaient que `Guide`,
  `MUSHOKU TENSEI – L'épée d'Iris` rien du tout. Les genres de l'œuvre principale valent mieux
  que le vide sur un hors-série.
- **La relecture du manifeste a été sautée la première fois.** Le dispositif en deux temps
  existe pour qu'un humain regarde `data/anilist.json` avant l'écriture ; le premier passage
  est allé droit à `anilist:apply`. C'est cette relecture, faite après coup, qui a fait
  remonter les trois héritages et les trois titres manquants. **Ne pas enchaîner les deux
  commandes.**

**Ce que ça débloque, sans que ce fût le but** : `titreVo` sert à l'anti-doublon de l'écran
Ajouter (`lib/actions.ts:107-125`). À 0/108 ce garde-fou ne fonctionnait que sur le titre
français — chercher « Shingeki no Kyojin » ne reconnaissait pas « L'ATTAQUE DES TITANS » déjà
en collection. Il fonctionne maintenant sur 101 séries.

**Les 4 non résolues, confirmées absentes d'AniList** : `bleach-13-blades` et
`my-hero-academia-ultra-archive` (databooks), `les-legendaires-saga` (BD française, pas un
manga), `tsugumi-project`. Elles sont dans `ABSENTES_D_ANILIST` et ne coûtent plus d'appel.

**`themes` reste en français et garde ses coupures d'import** — `Post` + `apo`, `Super` +
`héros`, `Dieux` + `Déesses`, `Combats` / `Combat`. 99 valeurs. Aucun écran ne les affiche
aujourd'hui, et `creerSerieAvecEdition` les laisse vides : le nettoyage ne rapporterait rien
tant qu'il n'y a pas d'écran pour les montrer.

### Tranché — l'installation sur Android (30 août 2026)

La volonté de départ était une application installable, pas un site. Elle est atteignable, et
le manifeste décrit plus haut remplit déjà tous les critères.

**Chrome n'exige plus de service worker pour l'installation.** Les critères actuels sont :
HTTPS, un manifeste avec `name` ou `short_name`, des icônes 192 et 512, un `start_url`, un
`display` parmi `standalone` / `fullscreen` / `minimal-ui`, et `prefer_related_applications`
absent ou faux. `app/manifest.ts` coche tout. La note « l'installation attend le service
worker » était fausse : elle n'attend que le HTTPS.

**Sur Android, « Installer » produit déjà un vrai APK.** Chrome demande à Google de générer un
**WebAPK** : l'application entre dans le tiroir d'applications, figure dans *Paramètres →
Applications*, a sa propre fenêtre dans les récents, sans barre de navigateur. Ce n'est pas un
raccourci. Aucun travail supplémentaire.

**Pour un fichier `.apk` autonome, le chemin est Bubblewrap** — l'outil officiel de Google. Il
enveloppe le site dans une *Trusted Web Activity* et sort un APK signé, à installer en
sideload. Il réclame un JDK, le SDK Android, un keystore, et surtout
**`/.well-known/assetlinks.json` servi publiquement**, portant l'empreinte SHA-256 de la clé de
signature. Sans lui, Android ne peut pas vérifier le domaine et le TWA affiche une barre d'URL.
Le Play Store coûterait 25 $ une fois ; le sideload est gratuit et tient la contrainte de §7.

**Conséquence déjà appliquée** : la garde d'accès interceptait `/.well-known/`. La vérification
Digital Asset Links interroge cette URL **sans cookie** et aurait pris un 307 vers `/acces`. Le
chemin est exclu du `matcher` de `proxy.ts`, avec le point échappé — vérifié que
`/xwell-known/secret` reste refusé, ce qu'un point non échappé aurait laissé passer. C'est de
toute façon la bonne hygiène : `/.well-known/` est réservé aux métadonnées machines et ne doit
jamais être derrière une authentification.

**Capacitor et les coquilles natives n'apportent rien ici** : l'application est rendue côté
serveur et écrit par Server Actions contre Neon. Une coquille afficherait le même site distant,
en plus lourd. Et quel que soit le chemin, **il faut le réseau** : §6 reste consultation seule.

### Fait — la sauvegarde de la base (30 août 2026)

§7 réclamait « un export JSON régulier de la base, versionné dans le dépôt » comme seul filet
du plan gratuit. Il n'existait pas. Les possessions — la seule donnée qui vienne du geste de
l'utilisateur et que rien ne puisse reconstituer — n'étaient couvertes par rien.

| Fichier | Rôle |
|---|---|
| `scripts/backup-db.ts` | `npm run db:backup` — exporte ; `-- --restore` restaure |
| `data/backup.json` | le vidage complet, versionné, 1,1 Mo |

- **Le seed ne pouvait pas servir de restauration.** `prisma/seed.ts` lit `data/collection.json`,
  qui est le point zéro de l'import : ni `titreVo`, ni `couvertureUrl`, ni les dates, ni les
  identifiants. Restaurer par le seed aurait perdu les 1 426 couvertures et les 104 titres VO.
  La sauvegarde est donc un vidage fidèle des quatre tables, identifiants compris.
  **Elle a cessé d'être un vidage total le 2 septembre** : `ParutionCatalogue` en est exclu
  volontairement — voir « Tranché — le catalogue est hors sauvegarde ».
- **Le tour complet est prouvé, pas supposé.** Restauration dans un Postgres local, réexport,
  comparaison au fichier d'origine : **identique au caractère près**, hors horodatage. Les sept
  compteurs concordent. Une sauvegarde jamais restaurée n'est pas une sauvegarde.
- **`LOCAL_DATABASE_URL` donne enfin un environnement d'essai.** Renseignée, elle fait passer le
  script par `@prisma/adapter-pg` sur un Postgres local au lieu de Neon. C'est ce qui a permis
  d'exercer une restauration destructive sans toucher à la vraie collection — jusqu'ici toute
  manipulation s'exerçait sur elle. Le Postgres local se lève par `npx prisma dev`, puis
  `npx prisma migrate deploy --config prisma7.local.config.ts`.
- **Garde-fou à la restauration** : elle refuse d'écrire sur une base non vide sans `--reset`,
  et vérifie les sept compteurs à l'arrivée, en échouant s'ils divergent.
- **Ce que le fichier expose** : `prixDefautCentimes` sur les 112 éditions, c'est-à-dire le prix
  de couverture, information publique. `prixPayeCentimes`, `dateAchat` et `note` sont nuls
  partout — la V1 ne les écrit pas. Strictement moins que `data/export.csv`, que §7 assume déjà.

**À lancer avant toute manipulation de masse**, et régulièrement. C'est le seul filet : le plan
gratuit de Neon n'a aucune sauvegarde longue durée.

### Établi — l'ISBN est la clé des éditions françaises (30 août 2026)

Sonde menée en partant d'une remarque juste : **AniList et MangaDex modélisent l'œuvre, pas
l'édition française.** L'Édition Prestige de Berserk est un objet Glénat ; aucune base
internationale ne la connaît, et les autres pays découpent autrement. §4 le disait à demi-mot
en imposant une étape de confirmation manuelle ; la conséquence n'avait pas été tirée :
**aucune source du projet ne peut alimenter la création d'une seconde édition.**

**L'ISBN-13 est l'EAN-13 imprimé au dos du tome**, et il identifie un livre physique précis —
éditeur, édition, tome. Deux éditions de Berserk ont des ISBN différents. C'est la seule clé
qui distingue ce qu'aucune API de série ne distingue.

**La BnF répond par ISBN, sans clé.** `bib.isbn all "9782344074886"` rend **exactement une
notice**, portant `dc:title` (numéro de tome et marqueur d'édition), `dc:publisher`, `dc:date`
et l'ISBN dans `dc:identifier`. Vérifié le 30 août 2026. La réponse SRU est de l'UTF-8 correct.

**Et elle connaît les éditions françaises.** Sur les 93 notices « Berserk » :

```
2025  9782344067802  Berserk. 1 (éd. prestige)
2025  9782344067819  Berserk. 2 (éd. prestige)
2025  9782344067826  Berserk. 3 (Édition Prestige)
2026  9782344073957  Berserk : 5 (éd. prestige)
2024  9782344063651  Berserk. 42 (éd. collector)
2026  9782344074886  Berserk. 43 (collector)
```

**Mais le marqueur d'édition est aussi instable que la numérotation.** Quatre graphies pour deux
éditions — `(Édition Prestige)`, `(éd. prestige)`, `(collector)`, `(éd. collector)` — et les
séparateurs varient (`Berserk. 3` contre `Berserk : 5`). C'est le même désordre que §5 avait
constaté sur les numéros de tome. **Conclusion : la résolution d'un ISBN est exacte,
l'énumération des tomes d'une édition ne l'est pas.**

**Ce qui tombe juste, c'est qu'on n'a pas besoin d'énumérer.** On scanne le tome qu'on tient.
Chaque scan dit exactement quelle édition et quel tome. On n'énumère pas, on accumule — ce qui
rend le scan EAN-13 de §9 non plus un confort différé mais **le chemin d'entrée des secondes
éditions**.

**Trouvaille au passage** : `berserk-prestige-edition` porte `tomesParus = 3` alors que la BnF
affiche un tome 5 paru en 2026. Le dénominateur est périmé.

**Vérifié sur un exemplaire physique le 30 août.** Photo du dos de *Berserk — Édition Prestige*
tome 1 : les chiffres imprimés donnent `9782344067802`, clé de contrôle EAN-13 valide, et la BnF
rend **une seule notice** —

```
title       Berserk. 1 (Éd. prestige) Kentaro Miura
publisher   Glénat (Grenoble)
date        2025
format      1 vol. (451 p.) : ill. ; 27 cm
```

La chaîne code-barres → ISBN → édition française est donc complète, de bout en bout.

- **`dc:format` est un discriminant inattendu et plus solide que le marqueur.** 451 pages en
  27 cm ; l'édition simple fait ~230 pages en 18 cm. Le format physique sépare les éditions là
  où `(Éd. prestige)` / `(éd. prestige)` / `(collector)` varient.
- **Un seul code-barres, pas d'additif prix à 5 chiffres.** Le prix est imprimé en texte à côté
  (`Prix TTC France 24,90 €`), donc hors de portée d'un lecteur de code-barres.
- **Le bloc est sur fond blanc mais la couverture est sombre et pelliculée brillante.** C'est la
  condition de scan réelle, pas la plus facile.

**`BarcodeDetector` n'existe pas dans Chrome sous Windows** — vérifié, l'API répond `false`.
C'est une API Android / macOS / ChromeOS. Le scan marchera donc sur le téléphone, qui est la
cible de §7, mais **restera intestable depuis le poste de développement**, et l'écran devra se
dégrader proprement sur bureau plutôt que d'offrir un bouton mort — même règle que le
`dots-three-outline` non rendu à l'étape 2. L'alternative serait un décodeur JavaScript, qui
marche partout mais pèse ~200 Ko.

**Écarts relevés en confrontant l'exemplaire à la base :**

| | Base | Réel |
|---|---|---|
| `prixDefautCentimes` de la Prestige | 2500 | 24,90 € imprimé |
| `tomesParus` de la Prestige | 3 | au moins 5, la BnF en date un de 2026 |
| `isbn` | **nul sur les 1 653 volumes** | le champ existe depuis l'étape 1, jamais écrit |

### Corrigé — les séries ajoutées étaient invisibles des couvertures (30 août 2026)

`Goodnight Punpun`, ajoutée depuis l'application, est restée sans couverture. La cause n'est pas
que le processus soit manuel : **`fetch_covers.py` lisait `data/collection.json`**, figé aux
108 séries de l'import. Toute série créée par l'écran Ajouter y était absente. **Il n'existait
donc aucun chemin, ni manuel ni automatique, pour lui donner des couvertures.**

**Correctif** : le script lit désormais `data/backup.json`, le vidage complet écrit par
`npm run db:backup`. Même structure — `series[].editions[]` avec `titre`, `slug`, `nom`,
`tomesParus` — donc une seule ligne à changer, et la sauvegarde sert deux fois.

**Conséquence sur l'ordre des commandes** : `npm run db:backup` doit précéder
`npm run covers:fetch`, sinon le script travaille sur une photographie périmée de la base.
Contrainte utile : elle force la sauvegarde à rester fraîche.

Résultat : 13 couvertures pour Punpun, **1 439 sur 1 653**. Elles pèsent 2,8 Ko de moyenne
contre 23,4 Ko ailleurs — ce ne sont pas des images vides mais les couvertures d'Inio Asano,
des aplats monochromes avec un dessin gaufré, que WebP réduit à presque rien. Vérifié à l'œil
avant de conclure.

### Corrigé — une série mère battait toujours son propre spin-off (30 août 2026)

Signalé à l'usage : `RED EYES SWORD Akame Ga Kill – ZERO` portait les couvertures des tomes 1
à 10 de la série de base. Les deux slugs pointaient vers le **même identifiant MangaDex**.

**La cause est le départage introduit le 29 août contre les fiches satellites** :

```python
return max(tetes, key=compter_couvertures)
```

Il jetait le score de similarité et ne gardait que le candidat ayant le plus de couvertures.
C'était juste contre `Bleach (Pre-Serialization)`, qui n'en a qu'une — mais **une série mère a
toujours plus de tomes que son préquel**, donc elle gagnait systématiquement. Ici les deux
fiches passaient le seuil de 0,86, mais *Akame ga Kill! Zero* marquait ~0,96 contre ~0,87 pour
la série de base, et ce meilleur score était jeté.

**Correctif** : `ECART_SCORE_NEGLIGEABLE = 0.02`. Le nombre de couvertures ne départage plus
qu'entre candidats **à score équivalent**. L'intention d'origine tient : une fiche satellite
porte le *même* titre, donc le même score, donc elle reste battue au compte ; un spin-off score
franchement mieux et gagne d'emblée. Vérifié : Zero → `334fcfdf`, série de base inchangée.

**Une seule collision dans toute la collection**, cherchée systématiquement en comptant les
identifiants MangaDex partagés — 92 identifiants distincts pour 93 slugs résolus.

**`covers:upload` gagne `--force <slug>`.** Sa reprise sur incident, qui saute ce qui est déjà
dans Blob, empêchait précisément les corrections. `npm run covers:upload -- --force <slug>`
renvoie l'édition quoi qu'il arrive.

**Conséquence du cache immuable** : les URL Blob ne changent pas, et l'en-tête est
`max-age=31536000`. Le CDN sert bien les nouvelles images — vérifié octet pour octet — mais
**un appareil qui avait déjà affiché les mauvaises couvertures les gardera un an**. Il faut y
forcer un rechargement dur une fois.

### Corrigé — les rééditions ont leur propre numérotation (30 août 2026)

Signalé à l'usage sur *Neon Genesis Evangelion* : l'édition possédée est la **Perfect Edition
en 7 tomes**, mais la page affichait les tomes 1 à 7 de l'édition d'origine en 14 volumes.

**Deux fautes superposées.** D'abord le script jetait silencieusement toute couverture dont le
volume n'était pas un entier :

```python
numero = int(str(brut).strip())   # "1.1" leve ValueError, couverture ignoree
```

Or MangaDex numérote les rééditions avec un suffixe décimal : Evangelion a `1 … 14` pour
l'origine et `1.1 … 7.1` pour la Perfect Edition. Le bon jeu n'était jamais candidat. Ensuite,
même en le lisant, **la couverture du domaine ne discrimine rien** : le jeu de 14 couvre aussi
parfaitement les tomes 1 à 7.

**Le signal est la taille du jeu comparée à `tomesParus`.** Les couvertures sont désormais
groupées par *famille de numérotation* — le suffixe décimal — et `famille_retenue` choisit
celle dont la taille égale `tomesParus`, à défaut celle qui couvre le mieux 1..N, les entiers
l'emportant à égalité.

**Survol systématique des 93 éditions résolues : 20 ont plusieurs familles, la règle ne change
le choix que pour trois** — Evangelion (`1.1…7.1`, Perfect Edition Glénat), Blame! (`1.1…6.1`,
le 新装版 en 6 volumes) et Gantz (`x.18`, le bunko Shueisha en 18 volumes). Les trois ont été
confirmées par l'utilisateur avant réécriture, et vérifiées à l'œil après.

**La règle ne s'applique qu'aux éditions purgées explicitement**, le script sautant celles déjà
complètes sur disque. Aucune des 17 autres n'a bougé.

### Fait — `RECHERCHES_MANUELLES` dans le script de couvertures (30 août 2026)

`UQHOLDER` figurait parmi les 15 sans correspondance MangaDex. **La cause n'était pas le
score** : `normaliser("UQHOLDER")` et `normaliser("UQ HOLDER!")` donnent tous deux `uqholder`,
soit une similarité de 1,0. C'est la *recherche* qui ne remontait rien, ni chez MangaDex ni
chez AniList — le titre collé du Sheet n'est indexé nulle part.

Même remède qu'à l'étape AniList : une table `RECHERCHES_MANUELLES` clé par slug, et
`trouver_manga(titre, slug)` cherche avec le terme corrigé tout en gardant le titre local
parmi les cibles de score.

**Deuxième blocage, plus sournois** : `data/mangadex_ids.json` mémorisait `uqholder: null`, et
la boucle ne résolvait que si le slug était **absent** du fichier. Un ajout dans la table
restait donc sans effet. Les échecs sont désormais réinterrogés à chaque passage, comme dans
`fetch-anilist.ts`.

UQ HOLDER! rend 28 tomes, dont **27 couvertures françaises de Pika Édition** et la 28ᵉ en
japonais, le français s'arrêtant à 27 — la politique « `fr` d'abord, `ja` en repli » de §5 à
l'œuvre.

**Huit autres titres fournis à la main** ont ensuite débloqué 93 couvertures : *Assassin de Aru
Ore no Sutetasu…*, *Kaijin Reijou*, *Mirai Nikki*, *NieR: Automata: YoRHa Shinjuwan Kouka
Sakusen Kiroku*, *Youjo Senki*, *Saint Seiya: The Lost Canvas Gaiden*, *Naze Boku no Sekai o
Daremo Oboeteinai no ka?*, *Yasei no Last Boss ga Arawareta!*. Contrôle de collision refait
après coup : **102 slugs résolus, 102 identifiants distincts**, les trois Mirai Nikki et les
deux Saint Seiya pointant chacun ailleurs.

**`VOLUMES_MANUELS` pour les hors-séries numérotés dans la série mère.** `pandora-heart-8-5`
n'est pas une fiche MangaDex distincte : c'est le volume `8.5` de *Pandora Hearts*. Ce n'est pas
un choix de famille mais une correspondance tome à tome, d'où une seconde table qui court-circuite
`famille_retenue`. Vérifié : la couverture obtenue est bien *Pandora Hearts Official Guide 8.5
~mine of mine~*.

**`remember` est en réalité *Karada Sagashi* (カラダ探し).** Il avait résolu vers une fiche
réelle mais dépourvue de couvertures — d'où un piège de cache différent des autres : son
identifiant n'étant pas nul, la reprise ne le réinterrogeait pas. Il a fallu le purger en même
temps qu'ajouter le nom. 17 tomes récupérés, et **plus une seule édition entièrement vide**.

**Total : 1 579 sur 1 653.** Restent 5 éditions sans correspondance MangaDex —
`bleach-13-blades` et `my-hero-academia-ultra-archive` (databooks), `les-legendaires-saga`
(BD française), `ippo-s4-la-loi-du-ring` et `pokemon-zoroark-le-maitre-des-illusion` — plus
le tome 8 de `yusei-no-last-boss` et un tome de `solo-leveling`.

**Ne pas généraliser ces tables sans vérification.** `data/anilist.json` porte le romaji correct
pour la plupart, et il serait tentant de l'injecter en masse — mais `pandora-heart-8-5` aurait
alors hérité des couvertures de la série mère, exactement la faute corrigée le même jour sur
Akame ga Kill Zero. Chaque entrée se confirme à l'exemplaire.

### Fait — l'état de parution (30 août 2026)

Signalé à l'usage : « Complète » était trompeur. Il ne regardait que `possédés == tomesParus`,
alors qu'une édition dont on possède tous les tomes parus d'une série **encore en cours** n'est
pas complète — elle est à jour. Deux axes étaient fondus en un mot.

**Le constat était pire que le libellé** : `editionTerminee` était **nul sur 112 éditions sur
113**, l'import ne l'ayant jamais rempli. Comme `aDesTomesAParaitre` renvoie
`editionTerminee !== true`, les 70 éditions dites « Complète » affichaient **en même temps**
trois cases fantômes « à paraître ». AJIN annonçait 17/17 complet et des tomes à venir.

| Fichier | Rôle |
|---|---|
| `scripts/fetch_publication.py` | `npm run publication:fetch` — BnF + AniList, n'écrit qu'un manifeste |
| `scripts/apply-publication.ts` | `npm run publication:apply` — écrit, `--revert` pour annuler |
| `data/publication.json` | le manifeste, versionné, relu avant écriture |
| `data/editions-avant-publication.json` | l'état des 108 éditions avant écriture |

**Ce que la BnF sait faire, et ce qu'elle ne sait pas.** Elle donne le nombre de tomes parus en
France, mesuré sur les 108 éditions : 54 concordent avec la base, 17 la dépassent, 29 n'ont
aucun numéro exploitable. Elle ne dit **jamais** qu'une série est terminée — c'est un catalogue
de dépôt légal, l'absence d'un tome 33 est indiscernable de « pas encore déposé ».

**Règle d'asymétrie, essentielle** : la BnF ne peut que révéler des tomes **en plus**, jamais en
moins. Les 8 cas où elle annonçait moins que la base étaient tous des échecs de lecture — Bleach
n'a rendu que 3 numéros sur 90 notices, My Hero Academia 6 sur 83, ce sont les notices à
sous-titre au lieu du numéro déjà repérées en §5. **`tomesParus` n'est jamais abaissé.**

**Trois garde-fous** ont écarté de mauvaises écritures :
- **Le taux de trous.** `fullmetal-alchemist` remontait 200 avec 172 trous, `kagurabachi` 9 avec
  5. Une lecture dont plus de 15 % des numéros manquent est rejetée.
- **Le garde-fou par auteur**, repris de `fetch_publishers.py` : sans lui, « Kaiju » attrapait
  des œuvres sans rapport et culminait à 75.
- **`REEDITIONS`.** La BnF décrit l'édition d'origine ; `gantz` (37 volumes) et `blame` (10) sont
  possédés en réédition de 18 et 6, identifiées le matin même en corrigeant les couvertures. Les
  élargir aurait été une régression.

**`editionTerminee` se déduit d'AniList, pas de la BnF.** §5 avertissait que son `status` décrit
la publication japonaise — vrai, mais combiné au compte l'inférence tient : terminé au Japon
**et** `tomesParus` ≥ volumes japonais ⇒ édition française terminée ; français < japonais ⇒
certainement pas ; en cours au Japon ⇒ pas terminée. Résultat : **55 terminées, 45 en cours,
13 indécidables** qui restent nulles.

**Écrit en base** : 13 éditions élargies, **33 tomes créés** avec leur possession à `false` — les
1 150 possédés ne bougent pas, seuls les dénominateurs. Berserk passe à 43, Blue Exorcist de 27
à 32, Call of the Night de 14 à 17. Les couvertures des nouveaux tomes ont suivi : **1 607**.

**Effet à l'écran, vérifié** : AJIN 17/17 dit « Complète » et n'affiche **plus aucune case
fantôme** ; BLACK LAGOON 13/13 dit « À jour ». Sur les 69 éditions autrefois toutes dites
« Complète », 32 le sont vraiment, 28 sont à jour, 9 restent indécidables.

### Fait — le planning manga-news (30 août 2026)

manga-news propose à ses visiteurs le **téléchargement des sorties mensuelles**, passées comme à
venir. 25 fichiers fournis couvrent **août 2024 → août 2026 sans trou ni doublon**, 7 283 lignes.

| Fichier | Rôle |
|---|---|
| `scripts/import_planning.py` | `npm run planning:import <dossier>` — n'écrit qu'un manifeste |
| `scripts/apply-planning.ts` | `npm run planning:apply` — écrit, `--revert` pour annuler |
| `data/planning.json` | le manifeste, limité aux séries de la collection |

**Cette source bat la BnF sur tous les points qui bloquaient** : numérotation `Vol.N` uniforme
là où la BnF a cinq formats, **date de parution exacte** et non l'année seule, éditeur, et
surtout **l'EAN**, c'est-à-dire l'ISBN-13 établi le matin même comme la clé des éditions
françaises. Elle est aussi plus fraîche : `call-of-the-night` était à 17 selon la BnF, le
planning donne 18 paru le 20 août 2026 — le dépôt légal enregistre après coup.

**Elle tranche deux cas que la BnF laissait en suspens** : `kagurabachi` à 9, que j'avais rejeté
pour ses 5 trous, et `terraformars` à 23 là où la BnF lisait 2.

- **Les fichiers ne sont pas versionnés.** Ce sont des données manga-news ; seul le manifeste
  dérivé, limité aux 35 séries de la collection, entre dans le dépôt. §5 note que l'usage
  *programmatique* de manga-news attend une autorisation — **ce cas est différent** : l'export
  est offert par le site, obtenu par l'utilisateur, pour sa propre collection.
- **Seules les lignes déjà parues comptent.** Une annonce à plus de deux mois bouge, de l'aveu
  même de la source ; les lignes futures vont dans `aParaitre` et n'écrivent pas `tomesParus`.
- **Même filtre d'édition que pour la BnF** : 543 lignes écartées portant `Coffret`,
  `Collector`, `Édition spéciale`, `Roman`, `Perfect`… L'égalité de titre est stricte, ce qui
  protège au passage des séries voisines : `Kaiju N°8 - Side B` ne matche pas `Kaiju N°8`.
- **35 éditions sur 108 s'apparient, et c'est le bon chiffre** — pas un défaut de rapprochement.
  Vérifié sur dix séries actives : neuf s'apparient exactement, et la dixième, `mashle`, n'a
  effectivement rien publié dans la fenêtre. Les 73 autres n'ont pas paru en deux ans, ce qui
  est cohérent avec 55 éditions terminées.

**Écrit en base : 4 éditions élargies** — `call-of-the-night` 18, `demon-slave` 20,
`kagurabachi` 9, `terraformars` 23 — et surtout **127 ISBN et 127 dates de sortie**, sur deux
champs restés vides depuis l'étape 1. `demon-slave` passe de « À jour » à 19/20 : le tome paru
le 20 août remonte désormais dans Manquants.

**Les fichiers sont rangés sous `planning_AAAA-MM.csv`**, le mois étant déduit de leur contenu
et non de leur nom — manga-news les nomme tous à la date de téléchargement. 27 fichiers,
**août 2024 → octobre 2026**, 7 880 lignes.

**Ce que ça ouvre** : `Volume.isbn` alimente directement le scan de code-barres, et les deux mois
futurs donnent **11 sorties à venir** sur la collection, avec date, ISBN et éditeur — la matière
de l'écran « Sorties à venir » de §9.

**Les sorties futures ne doivent pas être des `Volume`.** Un tome non paru gonflerait le
dénominateur et remonterait dans Manquants, où il n'a rien à faire puisqu'on ne peut pas
l'acheter. D'où une **table `Sortie` isolée** — `(editionId, numero, date, isbn)` — plutôt que
des lignes dans `Volume` : aucun compteur existant ne peut bouger, et il n'y a aucune requête
à garder. Migration `20260830180000_sorties_annoncees`.

**Les tomes annoncés ont leur couverture.** MangaDex publie souvent la jaquette avant la
parution française : **9 des 11** en ont une. Elles suivent le même circuit que les autres —
`fetch_covers.py` les récupère depuis `data/covers-annonces.json`, `upload-covers.ts` les
dépose dans Blob et renseigne `Sortie.couvertureUrl` (migration
`20260830183000_couverture_sortie`). La case reprend le traitement « manquant » : couverture à
34 %, pastille du numéro, plus une pastille de mois, le tout sous contour pointillé. Les deux
sans couverture — `radiant` et `the-ancient-magus-bride` — restent des cases vides datées.

**La grille nomme les tomes annoncés.** §4 disait des trois cases fantômes qu'elles sont « un
signal, pas une donnée : l'application ne sait pas combien de tomes restent ». Elle le sait
maintenant pour 11 d'entre eux : la case porte son numéro et son mois, et les génériques ne
comblent que le reste des trois. Vérifié en HTTP avec un cookie valide — `chainsaw-man` rend
« Tome 23 · oct 26 » plus deux génériques, `blue-exorcist` « Tome 33 · oct 26 », et `ajin`,
terminée, n'affiche aucune case.

**La sauvegarde couvre la nouvelle table.** `backup-db.ts` vidait quatre tables ; il en vide
cinq, sans quoi une restauration aurait silencieusement perdu les annonces.

**Piège de circuit rencontré** : `prisma migrate dev` échoue ici sur sa base fantôme
(`type "StatutEdition" already exists`), et `migrate diff` réclame un `shadowDatabaseUrl`
absent de la configuration. La migration a été **écrite à la main** en calquant les conventions
de l'initiale, **essayée sur le Postgres local** — 5 colonnes, 3 index — puis appliquée à Neon
par `npm run db:migrate`.

### Fait — les couvertures fournies à la main (30 août 2026)

§5 prévoyait « la possibilité d'uploader une photo manuellement » ; elle n'existait pas.
`npm run covers:manuelles <dossier>` la fournit, pour les 81 images qu'aucune source ne donne.

**Convention** : un sous-dossier par slug d'édition, un fichier par tome dont le nom contient
son numéro. `ippo-s4-la-loi-du-ring/1.jpg`, `berserk-prestige-edition/tome 2.png`. Les formats
courants sont acceptés ; le script recadre et convertit en **256×360 WebP** avec le même code
que `fetch_covers.py`, donc le poids et le rendu sont identiques.

**Trois garde-fous**, éprouvés à blanc : un dossier sans édition correspondante est signalé et
ignoré, un numéro absent de la base est refusé — `tome 99` sur une série qui en compte 19 —, et
un tome *annoncé* va dans `covers-annonces.json` plutôt que dans `covers.json`, donc vers
`Sortie.couvertureUrl`. Le script n'écrit jamais en base : il alimente les manifestes, et
`npm run covers:upload` fait le reste.

**Premier lot fourni le 30 août : 60 couvertures**, dont les 36 tomes des cinq éditions non
simples que MangaDex ne pouvait pas donner par nature. Total : **1 653 sur 1 690**.

**Dragon Ball : les couvertures étaient sur la mauvaise édition.** `dragon-ball` porte
l'édition double en 21 volumes, mais ses jaquettes venaient de la famille MangaDex des tomes
simples — celles-là appartiennent à `dragon-ball-tome-units`. Elles y ont été déplacées avant
l'écrasement, et l'édition double a reçu ses vraies couvertures françaises. Même classe de faute
que Blame!, Gantz et Evangelion, mais invisible aux règles automatiques : les deux éditions
sont deux `Edition` distinctes, pas deux familles d'une même fiche.

**Piège de nommage** : le lecteur de numéro prend la première suite de chiffres, donc
`Bleach_13th_blades.jpg` serait lu comme le tome 13. Les fichiers sont recopiés sous un nom
neutre avant import ; mieux vaut nommer `1.jpg` que se fier au titre.

**Berserk Édition Prestige portée de 3 à 6 tomes.** Six couvertures fournies contre trois tomes
en base : le garde-fou de l'importateur a refusé les trois derniers, ce qui a révélé la
péremption plutôt que de la masquer. La BnF datait déjà un tome 5 de 2026. `tomesParus` passe à
6, trois volumes non possédés sont créés, et l'édition affiche 1/6.

**Reste 37 tomes** : `ippo-s4-la-loi-du-ring` 3 à 27 (une seule couverture fournie, posée sur
les tomes 1 et 2), `les-legendaires-saga` 2 à 12, `solo-leveling` 19, et les deux annoncés
`radiant` 20 et `the-ancient-magus-bride` 24. Total : **1 656 sur 1 693**.

### Fait — modifier l'état d'une édition (30 août 2026)

Les trois champs d'état venaient tous d'ailleurs : `statut` du Sheet, `editionTerminee` déduit
d'AniList, `termineeForcee` de l'import. Aucun n'était corrigeable depuis l'application.

| Fichier | Rôle |
|---|---|
| `app/edition/[slug]/etat/page.tsx` | la sous-page d'état |
| `components/edition-state.tsx` | les trois groupes de choix, `useOptimistic` |
| `lib/actions.ts` | `definirStatut`, `definirParution`, `definirTermineeForcee` |

- **Une sous-page, pas un contrôle de plus sur la page Édition.** §4 réserve le bouton
  `X / Y TOMES` comme seul contrôle de cette page. La ligne « Statut » du pied, déjà présente,
  devient l'entrée — même motif que « Mes tomes ».
- **Les deux axes sont séparés à l'écran** comme ils le sont dans le modèle : « Où j'en suis »
  pour le rapport personnel, « Parution en France » pour l'état de publication, avec un
  troisième groupe pour la complétion forcée. Chacun porte sa conséquence en clair.
- **Enregistrement au fil de l'eau**, comme la grille : un tap écrit, pas de bouton valider.

**Vérifié de bout en bout** en appelant la Server Action par HTTP avec un cookie valide :
`editionTerminee` de `black-lagoon` passe de faux à vrai puis revient. **Sans cookie, 307 et
aucune écriture** — la garde d'accès tient sur ce chemin aussi.

**Piège de test à retenir** : les échecs de connexion au navigateur de cette session venaient de
moi, pas de l'application. `ACCESS_PASSWORD` avait changé dans `.env` et je réessayais l'ancien.
Les tests en curl passaient parce qu'ils **calculent** le jeton depuis la variable
d'environnement au lieu de deviner le mot de passe — c'est la bonne méthode, et elle évite au
passage d'avoir à manipuler le mot de passe réel.

### Fait — le mode invité (30 août 2026)

Un bouton « Entrer en invité » sous le champ de mot de passe donne un accès **en consultation
seule**, sans rien saisir.

| Fichier | Rôle |
|---|---|
| `lib/auth.ts` | deux jetons dérivés du même secret, `roleDuJeton` les départage |
| `lib/guard.ts` | `exigerAcces` pour lire, **`exigerProprietaire` pour écrire** |
| `lib/auth-actions.ts` | `entrerEnInvite`, `quitterInvite` |
| `components/guest-banner.tsx` | le bandeau « Mode invité · consultation seule » |

- **Les deux jetons sont des HMAC du même mot de passe**, sur des messages différents
  (`acces` et `invite`). L'invité ne peut donc pas être forgé sans connaître le secret ; il est
  simplement délivré sans le demander. Les cookies propriétaires existants restent valides.
- **La frontière est dans les Server Actions, pas dans l'interface.** Les sept actions d'écriture
  appellent `exigerProprietaire`. Vérifié en appelant `definirParution` par HTTP avec le cookie
  invité : **500 et aucune écriture** ; le même appel en propriétaire écrit. L'interface qui
  masque les contrôles est un confort, pas la protection.
- **Ce que l'invité voit** : la Collection, les Manquants, les pages Édition et la grille des
  tomes — **inerte, aucune case n'est un bouton**. L'onglet Ajouter disparaît, la ligne
  « Statut » cesse d'être un lien, et `/ajouter` comme `/etat` rendent l'écran introuvable.
- **Un bandeau permanent** le dit, avec un bouton « Quitter » qui efface le cookie.

**Conséquence de confidentialité, assumée (30 août 2026)** : le bouton ne demande rien, donc
**quiconque connaît l'URL peut consulter la collection**, prix et valeur totale compris. Le
dépôt étant public, l'URL est trouvable. Deux variantes ont été écartées au profit de la
commodité : masquer les prix à l'invité, ou un second mot de passe `GUEST_PASSWORD`. L'une ou
l'autre reste facile à ajouter — le rôle est déjà porté par le jeton.

### Tranché — la vignette de la Collection (30 août 2026)

Sur constat d'usage : la liste tenait 5,3 séries par écran, l'application de référence en tient
4 avec des couvertures nettement plus grandes. Mesuré sur deux captures du même téléphone,
1080 × 2400 à densité 3 :

| | avant | référence, et désormais |
|---|---|---|
| Couverture | 52 × 74 CSS | **84 × 120 CSS** |
| Pas de ligne | 101 CSS | **138 CSS** |
| Lignes par écran | 5,3 | **4,0** |

**La résolution stockée suffisait déjà.** 84 CSS à densité 3 font 252 px physiques, et §5 stocke
en 256 × 360 — une taille cotée pour « grille 252×354 ». La vignette agrandie tombe pile dessus,
**sans agrandissement ni retraitement des 1 657 images**.

Le reste suit à proportion : titre 15,5 px, sous-titre et compteur 12,5 px, marge verticale
réduite de 13 à 9 px pour que la ligne ne gagne que ce que la couverture exige.

**Astuce de vérification à retenir** : le cookie d'accès est `httpOnly`, donc JavaScript ne peut
ni le lire ni l'écraser. Passer par `127.0.0.1` au lieu de `localhost` donne une **origine
distincte, sans cookie existant**, où l'on peut poser un jeton depuis la console — et le jeton
*invité* suffit pour un contrôle visuel, ce qui évite d'avoir à manipuler le mot de passe.

### Fait — l'écran Planning (30 août 2026)

L'écran « Sorties à venir » de §9, quatrième onglet. Il lit la table `Sortie` : les sorties
**groupées par mois**, avec la couverture, le numéro de tome, l'éditeur et le jour.

**La couverture y est pleine et à la taille de la Collection** — 84 × 120, ni obscurcie ni
sous contour pointillé, contrairement à la grille « Mes tomes ». Le traitement « à paraître »
n'a de sens que mêlé aux tomes possédés, pour les distinguer ; sur un écran qui ne montre que
des sorties futures, il n'oppose plus rien et ne fait qu'abîmer l'image.

| Fichier | Rôle |
|---|---|
| `app/(tabs)/planning/page.tsx` | l'écran, groupement par mois |
| `components/planning-month.tsx` | un mois et ses sorties |
| `lib/editions.ts` | `chargerPlanning` |

**Périmètre : les séries de la collection seulement**, tranché le 30 août. Les CSV contiennent
**598 sorties à venir toutes séries confondues** ; `import_planning.py` n'en retient que celles
qui s'apparient à une édition possédée. Montrer les 598 aurait demandé une seconde table sans
lien avec `Edition` et un rafraîchissement mensuel — l'application suit une collection, pas un
catalogue.

> **Révisé le 4 septembre 2026.** Cette « seconde table sans lien avec `Edition` » existe
> désormais : c'est `ParutionCatalogue`, créée le 2 septembre. L'import garde toute l'archive et
> c'est l'écran qui filtre sur la collection de celui qui regarde — sans quoi, à plusieurs
> comptes, un ajout de série donnerait un planning vide jusqu'au prochain import manuel.
> Voir §13.1 « Le Planning et les sorties ».

**Corrigé — les fautes de frappe du Sheet faisaient rater 9 éditions (30 août).** Signalé sur
`ITCHI THE WITCH`, dont le tome 5 manquait : l'appariement se faisait par **égalité stricte**
des titres normalisés, et `itchithewitch` ne vaut pas `ichithewitch`. Une table
`TITRES_MANUELS` dans `import_planning.py` corrige neuf cas — `One-Punch Man`,
`Orient - Samurai Quest`, `The Unwanted Undead Adventurer`, `Why Nobody Remembers My World ?`,
`Yasei no Last Boss`, `Nier: Automata - Opération Pearl Harbor`, `Légendaires (les) - Saga`,
`Smoking behind the Supermarket with You`, `Ichi the Witch`.

**Cherchés par similarité, mais retenus à la main.** Le balayage a rendu 14 candidats à plus de
0,80 ; **cinq étaient faux** — `DRAGON BALL` → *Dragon Ball SD*, `GANTZ` → *Gantz E*,
`MY HERO ACADEMIA - Smash` → *My Hero Academia*, `ALMA` → *Almark*, et un Pokémon d'une autre
édition. Automatiser le seuil aurait injecté les tomes d'autres séries : même leçon qu'AniList.

Gain : **44 éditions appariées au lieu de 35**, 156 tomes datés avec ISBN au lieu de 127,
**16 sorties à venir au lieu de 11**, et cinq `tomesParus` périmés relevés — `one-puch-man`
24 → 34, que ni la BnF ni AniList n'avaient pu corriger puisqu'ils butaient sur la même faute.

**Le planning est une photographie, pas un flux.** Ajouter une série ne fait pas apparaître ses
sorties : il faut relancer `npm run db:backup`, `planning:import` puis `planning:apply`, et
l'appariement ne joue que si le titre correspond. À retenir avant de s'étonner d'un écran vide.
**Défaut levé par le chantier multi-compte (4 septembre)** : l'archive complète entre dans
`ParutionCatalogue` et les `Sortie` s'en dérivent à l'ajout d'une série. Le périmètre « séries
possédées seulement », tranché ici le 30 août, est révisé — voir §13.1 « Le Planning et les
sorties » et §13.2.

**Visible en mode invité** : l'écran ne porte aucune écriture. La barre passe à quatre onglets
pour le propriétaire, trois pour l'invité.

### Fait — la valeur en en-tête de la Collection (30 août 2026)

§3 définissait « valeur totale de la collection = somme sur toutes les éditions non vendues »
sans qu'aucun écran ne l'affiche. Elle est désormais sous les compteurs : **≥ 8 772,91 €**.

`chargerCollection` somme `Volume.prixCentimes ?? Edition.prixDefautCentimes` sur les tomes
possédés des éditions non vendues, et compte à part ceux dont le prix est indéterminable.
**Le préfixe `≥` apparaît dès qu'il en reste un** — aujourd'hui un seul, `goodnight-punpun`,
créée depuis l'application sans prix saisi. Afficher un montant rond quand une part manque
serait faux ; le signe le dit sans encombrer.

### Fait — le prix suggéré à l'ajout (30 août 2026)

À l'ajout d'une série, le champ « Prix par défaut » se pré-remplit depuis la BnF.

**Découverte : la BnF porte le prix**, dans le sous-champ UNIMARC `010$d`. Le Dublin Core ne
l'expose pas — il faut `recordSchema=unimarcxchange`. Vérifié contre l'exemplaire physique :
`010$d = 24,90 EUR` pour Berserk Édition Prestige tome 1, exactement le prix imprimé au dos.
§5 listait la BnF pour « éditeur, ISBN, date » ; le prix s'y ajoute.

| Fichier | Rôle |
|---|---|
| `lib/bnf.ts` | `chercherPrixDefautCentimes`, garde-fou par auteur et filtre d'édition |
| `lib/actions.ts` | `chercherPrix`, réservée au propriétaire |

- **La règle est le prix le plus fréquent, pas le plus récent.** La récence semblait meilleure
  et s'est révélée pire : elle attrape les rééditions collector publiées plus tard — Bleach à
  9,60 € au lieu de 6,90 €, Berserk à 19,90 € au lieu de 6,90 €. Le mode résiste.
- **Fiable sur une série récente, approximatif sur une ancienne.** Mesuré : Kagurabachi 7,30 €,
  Ruridragon 7,20 €, Ragna Crimson 7,95 €, Demon Slave 6,90 € — exacts. Sur les séries longues
  la BnF mêle les éditions et les prix montent avec le temps ; plusieurs « écarts » sont
  d'ailleurs le Sheet qui arrondit — 7,30 contre 7,29, 7,90 contre 7,95, où la BnF a raison.
  **C'est une suggestion relue par l'utilisateur, pas une écriture autoritaire** — le champ
  reste modifiable et le libellé le dit.
- **Un titre fautif ne rend rien**, comme partout ailleurs : `ITCHI THE WITCH` n'a pas de
  réponse BnF. Le champ reste vide, l'utilisateur saisit.

Vérifié en appelant l'action par HTTP : 730 et 720 centimes sur deux séries, `null` sur une
série inventée, **500 en invité**.

### Fait — le scan de code-barres (30 août 2026)

Le scan EAN-13 de §9, reporté « après les quatre écrans de base ». Écran `/scanner`, atteint
depuis l'onglet Ajouter, réservé au propriétaire.

| Fichier | Rôle |
|---|---|
| `components/scanner.tsx` | caméra, détection, résultat |
| `lib/bnf.ts` | `chercherParIsbn`, notice UNIMARC complète |
| `lib/actions.ts` | `resoudreIsbn`, la résolution en cascade |
| `lib/domain.ts` | `isbnValide`, clé de contrôle EAN-13 |

**La résolution est une cascade, et l'ordre compte** :

1. `Volume.isbn` → le tome est connu : on l'affiche avec un bouton « Marquer possédé »
2. `Sortie.isbn` → c'est une annonce : on donne sa date
3. **BnF par ISBN** → titre, éditeur, année, et le rapprochement avec une édition de la collection
4. rien → « Aucune notice ne correspond »

**La BnF est le résolveur principal, pas la base.** Seuls **156 tomes sur 1 710** portent un
ISBN, et 106 des 1 153 possédés : un scan a environ **9 chances sur 100** de tomber sur un tome
déjà identifié. Cela s'améliorera à chaque import de planning.

**La clé de contrôle est vérifiée avant tout appel réseau.** Un code-barres qui n'est pas un
ISBN — un produit quelconque, un additif prix — est rejeté sans interroger personne.

**`BarcodeDetector` n'existe que sur Android**, ce qui était su. L'écran se dégrade : sans lui,
pas de caméra, un message qui le dit, et **une saisie manuelle de l'ISBN** qui marche partout.
C'est aussi ce qui rend la fonction testable depuis le poste — la caméra elle-même reste à
exercer sur le téléphone.

Vérifié de bout en bout : un tome connu rend « CHAINSAW MAN · tome 17 · Possédé », une annonce
rend sa date, `9782344067802` rend « Berserk 1 · Glénat · 2025 » avec un lien vers l'édition,
un ISBN sans notice rend « inconnu », un code à clé fausse est refusé, et **l'invité reçoit
500**.

**Corrigé — l'aperçu caméra était noir** (signalé le 30 août). Permission accordée, pastille
verte allumée, et pourtant rien à l'écran. Cause : l'élément `<video>` n'était rendu que si
`camera === "active"`, mais le flux lui était attaché **avant** ce changement d'état. Au moment
de l'affectation, `video.current` valait `null` : le flux tournait, branché sur rien.

**Le remède supprime la question d'ordre plutôt que de la contourner.** Le flux passe par un
état React, et un second effet l'attache — donc forcément après le rendu, quand l'élément
existe. L'élément est monté en permanence ; seul son cadre est masqué.

**Vérifié sans toucher à la caméra** : `canvas.captureStream()` fournit un `MediaStream` réel
sans aucune permission. Substitué à `getUserMedia`, il a montré `srcObject` attaché, lecture en
cours et **640 × 360 de frames décodées** — trois indicateurs qui étaient tous faux avant. À
retenir pour tout futur travail sur la caméra depuis le poste.

**Corrigé — la caméra ne faisait pas la mise au point** (signalé le 30 août, une fois l'aperçu
réparé). Sans contrainte explicite, Android ouvre souvent la caméra en mise au point fixe.
Trois remèdes cumulés, aucun ne pouvant être essayé depuis le poste :

- **Résolution demandée** : `1920 × 1080` en `ideal`. Une image basse définition suffit rarement
  à décoder un EAN-13, et beaucoup d'appareils choisissent un meilleur mode caméra à cette
  demande.
- **`focusMode: "continuous"` appliqué deux fois** — avant l'attachement puis après le démarrage
  de la lecture. Certains appareils ignorent la contrainte tant que la piste ne tourne pas. Les
  capacités sont interrogées d'abord : si l'appareil n'annonce pas ce mode, on ne force rien.
- **Appui sur l'aperçu pour refaire la mise au point**, avec la mention à l'écran. C'est le
  rattrapage manuel quand l'autofocus continu décroche.

Vérifié au canvas de test : `1920 × 1080` bien demandés, la contrainte appliquée **deux fois**,
et l'appui la relance.

**Ce que ça n'adresse pas encore** : créer une seconde édition depuis un scan. La notice donne
pourtant tout — éditeur, année, marqueur d'édition dans le titre, prix. C'est la suite naturelle.

### Fait — le garde-fou du quota Blob (31 août 2026)

Le plan Hobby plafonne les **opérations avancées de Vercel Blob à 2 000 par mois**, et le
remplissage initial en avait déjà consommé ~1 800. En sont : `put()`, `copy()`, `list()`, **et
toute consultation du store depuis le tableau de bord Vercel**. `del()` est gratuit ; servir une
image est une opération *simple* (10 000/mois) et seulement en cache MISS. En cas de
dépassement, Hobby ne facture rien mais **rend le store inaccessible pendant 30 jours** — les
1 674 couvertures cesseraient de s'afficher.

`covers:upload` envoyait d'un bloc tout ce qui manquait, sans plafond ni annonce : un manifeste
de 500 couvertures aurait brûlé un quart du quota mensuel sans prévenir.

| Fichier | Rôle |
|---|---|
| `scripts/upload-covers.ts` | plafond `--max`, coût annoncé avant envoi, `--force <slug>:<numero>` |
| `components/cover.tsx` | repli sur le placeholder numéroté quand l'image ne charge pas |

- **`--max <n>`, 150 par défaut.** Le surplus est reporté et annoncé ; la reprise sur incident le
  rend gratuit. Rien ne part en masse sans que le plafond ait été relevé à la main.
- **Le coût est annoncé avant le premier envoi** —
  `cout de ce passage : 7 operations avancees (2 liste + 5 envois) sur 2000 par mois`. Le `list()`
  compte ses pages : 2 pour 1 688 blobs.
- **`--force <slug>:<numero>`** en plus de `--force <slug>` : corriger une seule couverture de
  Chainsaw Man coûtait 23 opérations, elle en coûte 1.
- **`Cover` passe client** pour porter `onError`. Le repli mémorise **l'URL en échec**, pas un
  booléen : une ligne qui reçoit ensuite une autre couverture la réaffiche, là où un booléen
  l'aurait condamnée.
- **Le `ref` rattrape l'échec survenu avant l'hydratation** (`complete && naturalWidth === 0`),
  qu'`onError` manquerait — sans effet, donc sans heurter `react-hooks/set-state-in-effect`.

**Vérifié fonctionnellement, pour 4 opérations avancées et aucun `put()`.** Le poste n'ayant pas
`public/covers/`, tout envoi échoue en ENOENT : `--force chainsaw-man:1` n'a produit qu'un
candidat au lieu de 23, et `--force chainsaw-man --max 5` a annoncé « 18 reportees par le plafond
de 5 ». Aucune couverture n'a été perdue en base — les tomes sautés ne sont pas remis à null,
`1674 / 1710` avant comme après. Pour le repli, cinq `src` cassées dans le navigateur sur la
Collection : 109 images → 104, cinq placeholders numérotés apparus, **aucun `<img>` cassé dans le
DOM**.

**Trois pièges de reprise sur ce poste, rencontrés le même jour :**

- **Le client Prisma généré était périmé.** `lib/generated/` ne connaissait pas `Sortie`, ajouté
  par la migration du 30 août : tout accès à la table plantait. Le dossier est gitignoré, donc
  `npx prisma generate` après tout `git pull` qui touche au schéma.
- **`@vercel/blob` et `@prisma/adapter-pg` n'étaient pas installés** alors qu'ils figurent dans
  `package.json`. `npm install` avant de lancer un script.
- **Purger `.next` pendant qu'un serveur de développement tourne le casse** : il sert ensuite un
  404 nu, et un `next build` par-dessus ne le répare pas. Le redémarrer.

### Fait — la position dans la Collection est conservée (31 août 2026)

Signalé à l'usage : revenir d'une page Édition ramenait en haut de la liste. La cause n'est pas
un défaut de Next mais la nature du geste — la flèche « Retour » est un `<Link href="/">`, donc
une navigation **avant**, et Next remonte alors en haut par construction. L'onglet Collection
fait de même. Le retour système aurait pu restaurer nativement, mais `/` est en `force-dynamic`
derrière un `loading.tsx` : le contenu arrive après l'écran de chargement, la restauration
native n'a rien de stable à quoi s'accrocher.

| Fichier | Rôle |
|---|---|
| `lib/use-scroll-memory.ts` | `useMemoireDefilement` — écrit la position au défilement, la restaure au montage |
| `components/collection-list.tsx` | l'appelle avec `CLE_STOCKAGE_DEFILEMENT` |

- **`sessionStorage` plutôt que l'historique du routeur.** La position revient quel que soit le
  chemin — flèche, retour système, onglet — là où s'appuyer sur l'historique n'aurait couvert que
  le geste système.
- **L'écouteur est retiré au démontage avant que Next ne remonte en haut**, sinon le zéro de la
  page suivante écrasait la position mémorisée. C'était le risque principal de l'approche :
  vérifié, la valeur reste à 1 000 pendant toute la visite de la page Édition.
- **L'onglet Collection restaure lui aussi la position** au lieu de remonter en haut. Cohérent
  avec une application à onglets ; à distinguer si l'usage le demande.
- **La restauration a lieu après le premier rendu** : l'écran se peint en haut puis saute. Non
  perçu sur le poste, **pas mesuré sur téléphone**.

Vérifié à 1 000 px sur les trois chemins de retour, capture identique avant et après le clic.

### Fait — les titres alignés sur leur nom français (31 août 2026)

Demandé à l'usage : rendre les titres conformes au vrai nom de l'édition française, pour en
finir avec les fautes de frappe du Sheet, et les afficher en capitales.

| Fichier | Rôle |
|---|---|
| `scripts/fetch_titles.py` | `npm run titles:fetch` — interroge la BnF, n'écrit qu'un manifeste |
| `scripts/apply-titles.ts` | `npm run titles:apply` — écrit, `--revert` pour annuler |
| `data/titles.json` | le manifeste, relu et corrigé à la main |
| `data/series-avant-titres.json` | l'état des 109 titres avant écriture |
| `app/globals.css` | `.titre-serie`, l'affichage en capitales |

**Résultat : 13 titres corrigés, 96 intacts, aucun doublon.**

**La donnée et l'affichage sont séparés, et c'est tout le sujet.** La base porte le vrai nom —
« One-Punch Man », « Iruma à l'école des démons » — et les écrans le rendent en capitales par
`text-transform`. Mettre les capitales *en base* aurait détruit l'information et cassé les
recherches sur les API externes, où le titre sert de clé.

**Les slugs ne changent jamais.** Ils joignent tous les manifestes — couvertures, planning,
AniList — et les chemins dans Blob. Vérifié après écriture : `one-puch-man` garde son slug et
ses 34 couvertures, `uqholder` ses 28, le total reste à 1 674, les sept compteurs sont intacts.

- **La BnF corrige l'orthographe, elle ne retitre pas.** Première version : sa tête de notice
  était prise telle quelle. Elle proposait alors « Neon Genesis Evangelion : Perfect Edition »
  — un nom d'édition entrant dans le titre d'une série —, « Terra Formars **Asimov** » pour
  `TERRAFORMARS`, qui est un spin-off, et « Pokémon » tout court pour
  `POKEMON - LA GRANDE AVENTURE`, alors que la collection compte un second Pokémon. Un seuil de
  similarité de 0,85 entre le titre BnF et le nôtre ramène la source à ce qu'on lui demande.
- **Ce seuil n'est pas celui que ce journal déconseille.** L'avertissement du 30 août vise la
  similarité employée pour *trouver* la bonne fiche, là où le titre VF s'éloigne légitimement du
  romaji. Ici la notice est déjà tenue par le garde-fou de l'auteur ; la similarité ne fait
  qu'écarter un titre qui désigne autre chose.
- **Les hors-séries héritaient du titre de leur mère.** `MIRAI NIKKI – MOSAIC` et `– PARADOX`
  devenaient tous deux « Mirai Nikki », `PANDORA HEART – 8,5` prenait « Pandora Hearts ». Pire,
  dans une version intermédiaire c'est le hors-série qui gagnait et la mère qui était écartée.
  Le seuil de similarité fait disparaître le cas ; un garde-fou de collision reste en filet.
- **La recasse automatique est retirée.** Elle transformait `BLAME!` en « Blame » — la BnF ne
  porte pas le point d'exclamation stylisé — et `MUSHOKU TENSEI – Les aventures de Roxy` en
  « MUSHOKU TENSEI – les Aventures de Roxy ». Sans correction d'orthographe, le titre n'est pas
  touché, au caractère près.
- **AniList est écarté du choix.** Son romaji stylise : `ACT-AGE` devenait « act-age », et son
  `ORIENT` est en capitales. Il reste au manifeste comme point de comparaison.
- **`RECHERCHES_MANUELLES`, le motif qui marche, pour la troisième fois.** Trois titres sont trop
  corrompus pour que la BnF les trouve ; un terme écrit à la main débloque
  `MARIMASHITA ! IRUMA-KUN !` → *Iruma à l'école des démons* (10 notices sur 12),
  `SAGA OF TANY` → *Tanya, the evil*, `UQHOLDER` → *UQ Holder !*. Le seuil y est court-circuité :
  écrire le terme, c'est déjà affirmer l'identité.
- **La relecture a servi trois fois**, ce qui est sa raison d'être. « Légendaires (les) - Saga »
  est la forme de catalogue de manga-news, corrigée à la main en « Les Légendaires - Saga ».
- **Piège d'encodage** : la console Windows en cp1252 fait planter le script sur
  `BLACK★ROCK SHOOTER`. La sortie est forcée en UTF-8.

**Ce que ça a débloqué** : les 13 éditions sans éditeur butaient sur ces mêmes fautes. Voir
« Fait — les éditeurs au complet » ci-dessous.

### Fait — les éditeurs au complet (31 août 2026)

`Edition.editeur` était nul sur 13 éditions ; il est désormais renseigné sur **113 / 113**.

- **La cause du blocage n'était qu'à moitié les fautes de frappe.** `fetch_publishers.py` lisait
  `data/collection.json`, figé au point zéro de l'import : il ne voyait ni les titres corrigés,
  ni les séries ajoutées depuis l'application. **Même faute que celle corrigée le 30 août sur
  `fetch_covers.py`, et même remède** — il lit `data/backup.json`. Troisième script pris au même
  piège : tout script qui parle de la collection lit la sauvegarde, jamais `collection.json`.
- **Relance sur les titres corrigés : 106 éditeurs sur 113**, et **zéro divergence sur les 100
  déjà renseignés** — passe purement additive, donc sans risque de régression.
- **`apply-publishers.ts` n'existait pas.** Les 100 éditeurs du 29 août avaient été écrits par un
  moyen qui n'a pas survécu. Il suit le modèle des autres : sauvegarde préalable dans
  `data/editions-avant-editeurs.json`, et `--revert`.
- **Les 7 derniers ont été saisis à la main**, et le titre n'y était pour rien : quatre one-shots,
  sur lesquels le garde-fou par auteur ne peut pas réunir les trois notices qu'il exige, une série
  ajoutée depuis l'application sans éditeur saisi, et deux que la BnF ne rend pas.

**Ce que ça débloque, sans que ce fût le but** : l'éditeur devient un **discriminant** utilisable
par les scripts d'import. C'est exactement ce qui a permis, le 2 septembre, d'écarter une
collision de titres que rien d'autre ne voyait — voir « Établi — les archives de planning »
ci-dessous.

### Fait — le lot issu du point design (31 août 2026)

Un canevas Claude Design a servi à comparer l'état actuel et les variantes proposées, écran par
écran, aux cotes et couleurs réelles et avec les vraies couvertures. Quatre propositions sur cinq
ont été validées ; le nombre de colonnes de « Mes tomes » reste ouvert.

**La ligne de collection rend l'éditeur.** Le sous-titre disait l'état sur 66 lignes sur 109 —
« Complète » 43 fois, « À jour » 23 — c'est-à-dire exactement ce que la barre pleine et le
compteur `17 / 17` disent déjà, et l'éditeur disparaissait sur 84 lignes. Le sous-titre porte
désormais `Nom · Éditeur`, la complétion devient une pastille accolée au compteur, et un état
anormal — abandonné, en pause — devient une puce sur la ligne de titre, dans le vocabulaire du
badge « À vérifier » qui existait déjà. `sousTitreLigne` se réduit à une ligne ; `etatLigne`
disparaît au profit de `etiquetteStatutLigne` et `estComplete`.

**Les cases à paraître se calent sur les colonnes.** `CASES_A_PARAITRE = 3` était hérité de la
grille à 4 colonnes ; à 2 colonnes la troisième tombait seule et ouvrait un trou de 271 px.
`nombreCasesAParaitre` complète la rangée : Chainsaw Man affiche 22 tomes, le tome 23 annoncé et
une seule case générique, soit 24 cases en 12 rangées pleines. La constante est supprimée.

**La page Édition remplit son bas d'écran.** « Couvertures possédées » devient « Tomes
possédés ». Un bloc « Prochaine sortie » affiche le tome annoncé, sa couverture et sa date
complète. Le pied gagne « Prix du tome ». « Autres éditions » devient une vraie ligne tapable —
couverture, éditeur, barre, chevron — là où c'était un lien que rien ne signalait. Le statut
quitte le pied pour un bouton « Modifier l'état » en bas d'écran, à contour neutre pour ne pas
concurrencer le `X / Y TOMES`.

**Le lien sortant devient une recherche.** `slugMangaNews` étant nul sur les 113 éditions, le
lien ne s'affichait jamais. `URL_RECHERCHE_MANGA_NEWS` interroge `?q=<titre>` : aucun slug à
renseigner, et un titre approximatif tombe quand même juste. **Nautiljon a été écarté pour une
raison de forme, pas de droit** — lier n'est pas récupérer, mais leur URL adresse une fiche par
son titre exact (`/mangas/one+piece.html`) et un titre fautif donne un 404. Le passage sur les
noms rend ce lien direct viable si on le veut un jour.

**La ligne de planning remonte le tome dans le titre.** Le numéro était la donnée la plus utile
de l'écran et la moins visible, en pastille dans le coin de la couverture ; l'éditeur occupait
une ligne entière. Le titre porte maintenant « Tome 10 », la date passe en 13,5 px et l'éditeur
la rejoint. Une ligne de texte en moins.

**Vérifié à l'écran** : les deux éditions de Berserk se distinguent enfin par leur sous-titre et
portent leur puce « En pause » ; Chainsaw Man montre sa prochaine sortie au 14 octobre 2026, son
prix de 7,30 € et son bouton d'état ; le lien manga-news pointe bien sur la recherche ; la
dernière rangée de la grille est pleine ; le Planning affiche « RAI RAI RAI · Tome 3 · jeu 3 ».

**Tranché — la grille reste à 2 colonnes (31 août 2026).** Le canevas les a montrées côte à
côte, même écran, mêmes tomes, vraies couvertures — 4 tomes visibles à 2 colonnes, 9 à 3, 16 à 4.
La décision du 29 août avait été prise sur des cases vides ; revue avec les couvertures, elle
tient. `COLONNES_GRILLE` reste à 2, et la question est close.

### Fait — les séries liées (31 août 2026)

Demandé à l'usage : afficher sur la page Édition les **autres séries possédées** qui se
rattachent à celle-ci — préquelle, suite, hors-série, guide — comme le bloc « Autres éditions »
le fait déjà pour les éditions d'une même œuvre. Exemple donné : Akame ga Kill est la base,
Zero la préquelle, Hinowa ga Crush la suite.

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | `LienSerie` et l'énumération `TypeLienSerie` |
| `prisma/migrations/20260831120000_liens_series/` | la migration, écrite à la main |
| `scripts/fetch-relations.ts` | `npm run relations:fetch` — lit les relations AniList, n'écrit qu'un manifeste |
| `scripts/apply-relations.ts` | `npm run relations:apply` — écrit, `--revert` vide la table |
| `data/relations.json` | le manifeste, relu avant écriture |

**AniList porte la donnée, et bien.** `Media.relations` rend `PREQUEL`, `SEQUEL`, `SIDE_STORY`,
`PARENT`, `SPIN_OFF` ; sur Akame ga Kill il donne exactement la préquelle et la suite attendues.
Seules les séries **possédées** sont retenues — l'adaptation animée et le `SIDE_STORY`
*Akame ga Kill! 1.5*, non possédé, tombent au relevé et non à l'affichage.

**Résultat : 18 liens sur 16 séries.** Les liens sont stockés dans les deux sens, ce qu'AniList
fournit de chaque côté ; chaque page lit ses liens sortants.

- **Deux hors-séries empruntent l'identifiant AniList de leur mère** — `pandora-heart-8-5` et
  `the-ancient-magus-bride-supplement-2`, pointés là à la main le 30 août pour hériter des
  genres. Dérivées telles quelles, leurs relations étaient celles de la mère : le Supplément 2
  devenait la « série mère » du spin-off. `IDENTIFIANTS_EMPRUNTES` les écarte de la dérivation
  **et** des cibles ; leurs vrais liens passent par la table manuelle. Première version du
  garde-fou : écarter tout identifiant partagé — trop large, elle faisait perdre le spin-off
  légitime de Magus Bride. Ce n'est pas le partage qui est fautif, c'est l'emprunt.
- **Deux séries Mushoku Tensei sont inversées dans `data/anilist.json`**, et ça se voit
  seulement maintenant : `mushoku-tensei` pointe sur *Dasoku-hen*, qui est un hors-série, et
  `mushoku-tensei-l-epee-d-iris` sur *Isekai Ittara Honki Dasu*, qui est la série principale.
  Les relations sorties étaient donc inversées, fidèlement. `RESOLUTIONS_DOUTEUSES` les écarte.
  **La résolution AniList reste à corriger à la source** — elle affecte aussi les genres et le
  `titreVo` de la série principale.
- **Une série liée peut avoir plusieurs éditions** : le lien pointe vers celle où le plus de
  tomes sont possédés. Vérifié — Fire Force renvoie vers `soul-eater-edition-double`, 12/12.
- **La sauvegarde couvre la nouvelle table**, comme pour `Sortie` le 30 août : `backup-db.ts`
  exporte les liens et les compte. Sans quoi une restauration les aurait perdus en silence.

Vérifié à l'écran : la page d'Akame ga Kill affiche « RED EYES SWORD AKAME GA KILL – ZERO ·
Préquelle · 10/10 » et « BLUE EYES SWORD · Suite · 8/8 », couvertures et chevrons compris ; la
réciproque tient depuis Blue Eyes Sword.

### Fait — la validation explicite de la répartition (4 septembre 2026)

Point 4 de la revue du 31 août. Cocher puis décocher un tome, geste rigoureusement neutre,
effaçait définitivement `aVerifier`. **Le drapeau était déjà tombé de 37 à 12** : les trois
quarts de l'information avaient disparu depuis l'import.

| Fichier | Rôle |
|---|---|
| `lib/actions.ts` | `marquerVerifiee` retiré de `basculerTome` et `definirTousLesTomes`, devient l'action `marquerRepartitionVerifiee` |
| `components/volume-grid.tsx` | le bloc « À vérifier » et son bouton, en pied de grille |

- **Un geste explicite devait exister, sinon le drapeau ne pouvait plus jamais être levé.** Le
  bouton est en bas de « Mes tomes », c'est-à-dire là où l'on regarde justement les couvertures
  pour confirmer ce qu'on possède. Visible seulement si le drapeau est levé, et jamais en invité.
- **Le drapeau est condamné**, la migration multi-compte le supprime (§13.1). Le corriger
  maintenant n'est pas du travail perdu : sans ça les 12 derniers se seraient effacés d'ici là,
  et l'information n'est pas reconstituable.

**Vérifié par un vrai clic dans Chrome, pas par une sonde.** Le premier essai — appel de la
Server Action en curl — a rendu **400 sur les trois appels sans jamais atteindre l'application**,
et le drapeau « survivant » ne prouvait donc rien : quatrième fois qu'une sonde ment dans ce
projet. Le test valable a été mené sur NARUTO, drapeau levé : un tap sur le tome 2 rend
`POST /edition/naruto/tomes 200`, la base passe à 1 154 possédés **et `aVerifier` reste vrai** ;
le décochage ramène à 1 153, toujours vrai ; le bouton « Répartition vérifiée » le passe à faux
sans toucher aux possessions. Drapeau remis ensuite : **12 / 1 153 / 109 / 113 / 1 712**,
identique au départ.

- **Le serveur de développement a été lancé avec `ACCESS_PASSWORD` jetable** plutôt que de faire
  transiter le vrai. Vérifié que l'override prenait — 200 avec le jeton dérivé du jetable, 307
  avec celui du vrai — donc le secret de production n'a jamais servi ni circulé.
- **Piège d'automatisation** : cliquer une case par sa référence sans qu'elle soit à l'écran ne
  déclenche rien, et **rien ne le signale** — ni erreur, ni log. Le seul contrôle fiable est
  l'absence de `POST` dans le journal du serveur. Cliquer par coordonnées sur un élément visible.

### Revue du 31 août 2026 — à traiter avant la séparation catalogue/suivi

Cinq points relevés en revue d'architecture. Les deux premiers sont bloquants.

1. **Quota Blob — urgent, irréversible.** ~1 800 opérations avancées consommées sur les 2 000
   du mois. Dépassement ⇒ **store inaccessible 30 jours**, les 1 674 couvertures disparaissent.
   Le garde-fou de `covers:upload` ne couvre pas le vrai risque : **toute consultation du store
   depuis le tableau de bord Vercel compte aussi**, et rien ne l'empêche. Migrer vers
   **Cloudflare R2** — 10 Go, 1 million d'écritures par mois, egress toujours gratuit,
   compatible S3, donc changement limité au client et aux variables d'environnement — ou ne
   plus jamais ouvrir le navigateur de blobs. **Tranché le 1er septembre : R2, la carte étant
   admise** — voir « Tranché — Cloudflare R2 » ci-dessous. **Clos le 3 septembre 2026** : les
   1 688 images sont dans R2, plus aucune `couvertureUrl` ne pointe vers Blob.

2. **§6 décrit une fonctionnalité absente.** Pas de service worker, rien en cache. Construire,
   ou descendre §6 en « Reste à faire ». Le statu quo fait perdre son autorité au document.

3. **Correspondance d'affichage des genres.** Les 19 genres sont en anglais (liste fermée
   AniList), l'interface est en français. Le filtre par genre afficherait « Slice of Life » et
   « Supernatural » dans une UI française. Poser la table de correspondance **avant** de
   construire le filtre, pas après. **Filtrer sur les genres, jamais sur les thèmes** : 99
   valeurs françaises avec les coupures d'import (`Post` + `apo`, `Super` + `héros`,
   `Combats` / `Combat`) — un filtre « apo » exposé à un tiers est indéfendable.

4. **`aVerifier` effacé par un basculement neutre.** Cocher puis décocher détruit
   définitivement l'information (constat du 28 août, comportement conservé le 29). Tenable en
   mono-utilisateur ; plus du tout quand le drapeau passera dans `SuiviEdition` et que d'autres
   tâtonneront sur leur propre collection — l'indicateur de fiabilité du catalogue serait effacé
   par des gestes sans rapport. N'effacer que sur **validation explicite**. À corriger **avant**
   la migration du schéma, sinon le défaut migre avec la colonne.
   **Clos le 4 septembre 2026** — voir « Fait — la validation explicite de la répartition ».
   Le drapeau ne passe finalement pas dans `SuiviEdition` : il est supprimé (§13.1).

5. **Circuit de migration à revérifier.** Le double temps `prisma dev` + `apply-migrations.ts`
   existe parce que **le port 5432 était bloqué par le réseau du poste professionnel** (§7). Le
   développement est passé sur la machine personnelle. Si la contrainte a disparu, c'est un
   contournement complexe pour un problème qui n'existe plus.
   **Mesuré le 4 septembre 2026 : la contrainte tient toujours sur ce poste.** Une connexion
   TCP directe à l'hôte Neon sur le 5432 rend `Network is unreachable`, le 443 s'ouvre. Le
   double temps reste donc obligatoire **ici**. Sur un poste au réseau ordinaire il tombe, et
   `npm run db:migrate` reste valable dans les deux cas.

**Non comptés comme dette** : les 29 éditions sans numéros BnF — qualité de données connue,
tracée, avec une cause identifiée ; c'est du travail restant. Les éditions sans éditeur y
figuraient aussi : il n'en reste aucune depuis le 31 août. Le dépôt public
exposant les prix — décision assumée, avec sa vraie conséquence (aucun secret dans le dépôt)
correctement identifiée.

### Tranché — Cloudflare R2 (1er septembre 2026)

Le point 1 de la revue est arbitré. **R2 exige une carte enregistrée à l'activation**, écran
d'abonnement relu : `Total Due Now $0.00`, `Due Monthly $0.00 + additional usage`, débit
uniquement au franchissement d'un palier. §7 est amendé — « sans carte » devient « sans débit ».

**Ce qui justifie l'amendement, ce sont les marges, pas le confort.** Mesurées sur nos chiffres
réels :

| | Besoin réel | Palier gratuit R2 | Marge |
|---|---|---|---|
| Stockage | 39 Mo (1 674 × 23,4 Ko) | 10 Go | **×256** |
| Class A — écritures, `list` | ~1 700 par remplissage complet | 1 M / mois | **~590 remplissages par mois** |
| Class B — lectures hors cache | quelques milliers | 10 M / mois | sans objet |
| Egress | 38 Mo par remplissage | gratuit, sans plafond | — |

Le catalogue V3 de §13.2 — 36 000 tomes, ~840 Mo — tient encore dans les 10 Go. **Le dépassement
n'est pas un risque d'usage, il est hors d'atteinte par l'arithmétique.** C'est l'inverse exact de
Vercel Blob, où 1 800 opérations sur 2 000 sont déjà consommées et où *ouvrir le navigateur de
blobs* en consomme.

**Le risque résiduel n'est pas l'usage, c'est l'accident.** Cloudflare n'offre pas de plafond de
dépense dur : un débit ne pourrait venir que d'un script en boucle ou d'une URL publique
massivement sollicitée. Trois garde-fous, à poser **pendant** la migration et non après :

- **Servir derrière le cache Cloudflare**, par un domaine plutôt que l'URL `r2.dev` nue — un hit
  de cache ne compte pas en Class B, et l'egress est de toute façon gratuit.
- **Activer les notifications d'usage R2** — c'est le seul avertisseur, faute de plafond dur.
- **Garder le plafond `--max` de `covers:upload`**, écrit le 31 août contre le quota Blob. Il
  devient surdimensionné, il ne devient pas inutile : il protège de la boucle, pas du quota.

**La migration ne coûte aucune opération avancée Blob, à une condition** : ne pas énumérer le
store. `Volume.couvertureUrl` et `Sortie.couvertureUrl` portent déjà les 1 674 URL absolues — on
énumère depuis Postgres, on télécharge par les URL publiques (opérations *simples*, 10 000/mois,
et servies par le CDN), on dépose dans R2, on réécrit les URL. Un `list()` sur le store coûterait
2 opérations avancées ; il n'y a aucune raison de les payer. **`del()` étant gratuit**, le store
Vercel se supprime ensuite sans frais.

**Aucun code n'est écrit à cette date** : la décision est actée, la migration reste à faire.

### Établi — les archives de planning remontent à 2000 (2 septembre 2026)

§13.2 posait une question sans y répondre : « jusqu'où remontent les archives téléchargeables ».
Quatre sondes — septembre 2000, 2005, 2010 et 2015 — y répondent.

**L'archive existe depuis 2000 et le format ne bouge jamais.** Même en-tête
`,Date,Titre,Editeur,Ean` aux quatre dates, et **l'EAN-13 est présent dès 2000** : manga-news
stocke la forme `978…`, qui est exactement le code-barres imprimé au dos. La crainte de
l'ISBN-10 avant 2007 ne se matérialise à aucune date.

| | 2000 | 2005 | 2010 | 2015 | fenêtre 2024-2026 |
|---|---|---|---|---|---|
| Lignes du mois | **31** | 142 | 168 | 201 | ~300 |
| EAN-13 valide | 31/31 | 137/142 | 161/168 | 190/201 | 306/307 |
| ISBN gagnés sur la collection | 1 | 4 | 6 | 5 | 6,2/mois |

**Le rendement ne se dégrade pas avec l'ancienneté**, et c'est la vraie information : la valeur
de l'archive est proportionnelle au nombre de mois récupérés, sans rendement décroissant. Le seul
facteur limitant est la taille du marché français — 31 sorties en septembre 2000 contre 300
aujourd'hui.

**Ce que ça vaut.** Aujourd'hui **156 ISBN sur 1 710 volumes**, **69 éditions sur 113 sans aucun
ISBN**, et les dates de sortie ne couvrent que 2024-2026. Un scan de code-barres a donc **9,2 %**
de chance de tomber sur un tome déjà identifié (106 sur 1 153 possédés). À 5 ISBN par mois sur
~260 mois, un plancher à **janvier 2005** porterait la couverture à environ **70 %** — c'est ce
qui fait passer le scanner de démonstration à outil.

**Rendement par fichier téléchargé**, seule métrique qui compte puisque le coût est le clic :
2010→2026 vaut ~5,5 ISBN par fichier, 2005→2009 ~4, 2001→2004 ~2, avant 2001 ~1. **Plancher
recommandé : janvier 2005**, soit ~260 fichiers. Descendre à 2000 ne vaut le coup que si l'URL
de téléchargement est paramétrable par mois, auquel cas le coût devient nul. Les séries d'avant
2000 resteront hors de portée quoi qu'il arrive — Dragon Ball a été publié en France de 1993 à
2000.

#### Le piège : une collision de titres que l'égalité stricte ne voit pas

La sonde de 2005 a retenu `Leviathan Vol.4` (Asuka) pour notre `leviathan`, qui est le
**Leviathan de Kuroi Shiro chez Ki-oon**, 3 tomes, terminé. Deux œuvres différentes, même titre,
quinze ans d'écart. Appliqué tel quel, `planning:apply` aurait porté `tomesParus` de 3 à 4, créé
un tome fantôme et lui aurait collé l'ISBN d'un livre absent de la collection.

**C'est la même classe de faute qu'Akame ga Kill Zero et Dragon Ball, mais l'égalité stricte des
titres ne la voit pas** : sur 25 mois les collisions de titres sont rares, sur 25 ans elles sont
inévitables. La leçon générale : **le filtre qui suffit sur une fenêtre courte ne suffit pas sur
une archive longue**, et rien ne le signale — il échoue en silence, en écrivant.

**Le garde-fou est l'éditeur, et il vient juste de devenir disponible** : la base porte un
éditeur sur les 113 éditions depuis le 31 août, et le CSV porte la colonne `Editeur`.
Ki-oon ≠ Asuka rejette la ligne sans hésitation. Même motif que le garde-fou par auteur de
`fetch_publishers.py`.

#### Trois corrections apportées à `import_planning.py`

- **`meme_editeur` compare l'éditeur de la base à celui du planning.** La comparaison est
  tolérante — égalité, inclusion, ou appartenance au même groupe d'équivalence — parce qu'un
  éditeur est renommé ou racheté : **`GROUPES_EDITEURS` porte `kaze`/`crunchyroll`** (Crunchyroll
  a absorbé Kazé) **et `bambooedition`/`dokidoki`** (Doki Doki est le label manga de Bamboo).
  Ces deux cas ne sont pas théoriques : ils couvrent **11 des 44 éditions déjà appariées**, qu'un
  garde-fou strict aurait détruites. `Pika Édition` / `Pika` et `Delcourt-Tonkam` / `Tonkam`
  passent par la simple inclusion, sans entrée dédiée.
- **La ligne divergente est écartée du manifeste, pas acceptée ni perdue.** Elle part dans
  `data/planning-divergences.json` avec son contexte complet — éditeur attendu, éditeur trouvé,
  titre du planning, ISBN — et le script l'annonce en fin de passage. Le dispositif en deux temps
  du projet veut une relecture humaine ; une ligne suspecte doit lui arriver, pas disparaître.
  `planning.json` garde exactement sa forme, `apply-planning.ts` n'est pas touché.
- **`TITRES_MANUELS` gagne `ippo-s4-la-loi-du-ring` → `Ippo - Saison 4 - La loi du ring`.**
  manga-news écrit « Saison 4 » là où le Sheet écrit `S4` : similarité 0,81, égalité non.
  Dixième entrée de la table, quatrième fois que ce motif est le bon.
- **`MARQUEURS_AUTRE_EDITION` gagne « edition reliee » et « edition souple »**, vues toutes deux
  dans ces seuls quatre fichiers. Sans danger tant que l'appariement est strict —
  `Fullmetal Alchemist - Edition reliée` est refusé par l'égalité — mais indispensable avant
  toute tentative d'assouplissement.

**Ce qu'il ne faut surtout pas faire : passer à la similarité pour rattraper Ippo.** Le balayage
des presque-appariements sur les quatre mois remonte cinq candidats au-dessus de 0,62 et
**quatre sont faux** : `Hakaiju` → KAIJU N°8, `Monster Hunter Epic` → MONSTER HUNTER ORAGE,
`Life` → RELIFE, et `Légendaires (les)` → notre *Saga* qui est un objet distinct. Le cinquième,
`Fullmetal Alchemist - Edition reliée` à 0,72, injecterait les ISBN d'une autre édition dans
l'édition simple. **Quatrième confirmation de l'avertissement du 30 août** : la table écrite à
la main marche, le seuil ne marche pas.

**Vérifié**, sur les quatre mois passés au script corrigé : 12 éditions appariées, 16 tomes datés
tous avec ISBN, `leviathan` écarté et journalisé, **« 0 éditions où le planning dépasse la base »**
— l'élargissement fantôme a disparu. Et le garde-fou ne coûte rien sur l'acquis : les **44 paires
(édition, éditeur) du manifeste de production passent toutes**, aucune refusée.

**Piège de test à retenir** : `import_planning.py` écrit dans `data/planning.json`, qui est
versionné et porte le résultat des 27 fichiers réels. Un essai l'écrase. Sauvegarder avant, et
`git checkout -- data/planning.json` après — c'est ce qui a été fait ici.

### Fait — la table de catalogue (2 septembre 2026)

Jusqu'ici l'import de planning ne gardait que les séries **possédées** : les ~59 000 autres
lignes de l'archive étaient lues puis jetées. `ParutionCatalogue` les garde. Migration
`20260902120000_catalogue_parutions`, appliquée à Neon.

```
ParutionCatalogue (id, ean, titreBrut, serieTitre, serieNormalise,
                   marqueurEdition, numero, editeur, date)
```

**Ce que ça débloque, mesuré sur les quatre mois de sonde :**

- **Connaître une série avant de l'ajouter.** Le « catalogue de séries » n'est pas une table à
  construire, c'est un `GROUP BY serieNormalise` qui rend le nom FR, l'éditeur, le tome maximum
  et la plage de dates. **Conséquence : on ne paie pas la déduplication d'avance** — §13.2 la
  donnait comme une des deux difficultés de l'amorçage, elle ne bloque plus rien. On importe
  tout, on interroge, et on ne consolide en `Serie` / `Edition` qu'au moment où une série entre
  réellement dans une collection, un cas à la fois, sous supervision.
- **ISBN → série, exact et non approximatif.** 517 EAN distincts sur 542 lignes, **2 doublons
  seulement**. Le scanner passerait de 9,2 % de reconnaissance à une résolution locale complète
  — titre, numéro, marqueur d'édition, éditeur, date — **y compris sur une série non possédée**,
  ce qui est précisément la porte d'entrée qui manquait pour créer une seconde édition.
- **Le vrai nom FR de la série *et* de l'édition.** manga-news écrit `Racine - Marqueur Vol.N`,
  donc la racine donne le nom commercial français et le marqueur nomme l'édition (`Deluxe`,
  `1re Edition`, `Collector`, `Édition Spéciale`). **Aucune source ne donnait ce couple** : la
  BnF a cinq formats et des marqueurs instables (§ ISBN, 30 août), AniList ne connaît pas les
  éditions françaises. 4,3 % des lignes portent un marqueur, soit de l'ordre de 2 500 éditions
  alternatives nommées proprement sur l'archive complète.

**Trois règles de lecture établies sur la sonde, à appliquer à l'import :**

- **Filtrer sur les préfixes `978` et `979`.** La distribution mesurée est `978` : 507,
  `979` : 9, `379` : 3 — et les trois `379` sont un **code de périodique** partagé par trois
  numéros d'*Animeland*. Sans ce filtre, un EAN de magazine devient une clé qui désigne trois
  choses. Le second doublon, `9782351800133` sur `Monsieur est servi ! - Collector Vol.3` et
  `Monsieur est servi Vol.3`, est un vrai doublon de saisie chez la source.
- **La désinversion de l'article opère par segment, pas sur la chaîne entière.** manga-news
  catalogue à la française — `Légendaires (les)`, `Rose de Versailles (la)` — sur **5,9 % des
  lignes**. Appliquée globalement la règle rend bien « Les Légendaires », mais
  `Mobile Suit Gundam - Ecole du Ciel (l')` devient `L'Mobile Suit Gundam - Ecole du Ciel` au
  lieu de `Mobile Suit Gundam - L'École du Ciel`. Faute qui passerait une relecture, puisqu'elle
  ne touche qu'une poignée de lignes.
- **`titreBrut` garde la ligne au caractère près, les champs dérivés sont recalculables.** Si la
  désinversion ou la découpe du marqueur s'améliorent, on recalcule `serieTitre` depuis
  `titreBrut` sans retélécharger un seul CSV. C'est la raison d'être du champ.

**Pourquoi Neon et rien d'autre.** Mesuré : la base fait **9,6 Mo** aujourd'hui, et `Volume`
coûte 441 octets par ligne index compris. 59 000 lignes de catalogue pèsent **18 à 24 Mo**, soit
**~6 % du demi-Go gratuit**, marge ×17. Les lectures sont des recherches d'index, l'import un
`createMany` par lots : négligeable sur les 100 CU-h. Et surtout il faut **joindre** le catalogue
à `Edition` pour marquer « déjà en collection » sur l'écran Ajouter — un JSON statique dans R2
ferait 4 à 6 Mo mais ne se joint à rien. À garder en tête pour le hors-ligne de §6, pas pour ça.

**`ean` est indexé mais pas unique, et `(titreBrut, date)` l'est.** L'unicité sur l'EAN aurait
obligé à arbitrer les doublons de la source à l'écriture ; la table est une **copie fidèle de
l'archive**, elle accepte ce que la source contient. L'unicité sur `(titreBrut, date)` donne la
propriété qui compte vraiment : **relancer l'import ne duplique rien**, même sur des mois qui se
recouvrent.

**C'est de la donnée de catalogue au sens de §13.1** — aucun champ personnel, rien à déménager
vers `SuiviEdition` le jour de la séparation.

#### Tranché — le catalogue est hors sauvegarde

`data/backup.json` fait 1,2 Mo et **est versionné dans un dépôt public**. Y ajouter le catalogue
le porterait à 6-8 Mo réécrits en entier à chaque passage, donc autant ajouté à l'historique git
chaque fois — et surtout cela **republierait le catalogue de manga-news dans un dépôt public**,
ce qui sort du cadre posé le 30 août : « l'export est offert par le site, obtenu par
l'utilisateur, pour sa propre collection ».

**La sauvegarde existe pour protéger ce que rien ne peut reconstituer**, c'est-à-dire les
possessions. Le catalogue se reconstruit des CSV en une commande. Il est donc exclu.

- **La restauration ne l'emporte pas**, et c'est vérifié structurellement, pas supposé :
  `restaurer()` fait `serie.deleteMany()` et compte sur la cascade, or `ParutionCatalogue` a
  **zéro clé étrangère dans les deux sens** — la cascade ne peut pas l'atteindre. Le garde-fou
  « base non vide » compte les `Edition`, donc il n'est pas faussé non plus.
- **Le catalogue n'entre pas dans `Compteurs`.** La restauration compare les compteurs et échoue
  s'ils divergent ; un compteur de catalogue non restauré aurait fait échouer toute restauration.
- **`db:backup` l'annonce quand même**, à l'export comme à la restauration :
  `catalogue : N parutions volontairement hors sauvegarde, rederivables des CSV manga-news`.
  Une exclusion silencieuse se lit comme un oubli.

**Vérifié** : une ligne d'essai insérée dans la table, `npm run db:backup` relancé, **aucune
trace dans `data/backup.json`** — le fichier est identique à celui du 31 août à l'horodatage
près — puis la ligne supprimée. `npm run lint` et `npm run build` passent.

### Fait — l'archive de planning triée (2 septembre 2026)

291 CSV téléchargés, tous nommés `PlanningManga_02-09-2026 (n).csv` — manga-news les nomme à la
date de téléchargement. Rangés sous la convention `planning_AAAA-MM.csv` dans
**`~/Documents/planning_manga/`**, **par copie** : les trois dossiers d'origine restent intacts.

| | |
|---|---|
| Fichiers rangés | **288** |
| Lignes | **41 941** |
| Couverture | **janvier 2000 → janvier 2024** |
| Trou | **2000-09** seulement |
| En-tête | `,Date,Titre,Editeur,Ean` sur les 291, sans exception |
| EAN livre (978/979) | **95,4 %** des lignes |

- **Le mois vient du contenu, jamais du nom**, et le nom obtenu est **reverifié contre le
  contenu** après copie : 288 sur 288 concordent. Aucun fichier ne mélange deux mois, aucun
  n'est illisible.
- **3 collisions, toutes des doublons de téléchargement** — 2008-10, 2013-04, 2022-04 — vérifiées
  **identiques au MD5** avant d'en ignorer une copie. 291 − 3 = 288.
- **Le trou de 2000-09** est le fichier de sonde, qui était dans `Downloads` et a disparu au
  rangement. C'est le plus petit mois de toute l'archive (31 lignes) ; à retélécharger ou à
  laisser.
- **Il manque aussi février 2024 → octobre 2026**, soit 33 mois : les 27 CSV du premier lot ne
  sont plus sur ce poste. Sans conséquence sur ce qui est déjà en base — `tomesParus` n'est
  jamais abaissé, donc les deux lots s'importent dans n'importe quel ordre — mais c'est la
  fenêtre la plus utile pour le catalogue et l'écran Planning.

#### Corrigé — les rééditions auraient été écrasées par l'archive

Défaut trouvé en mesurant le gain sur les 288 mois, **avant d'écrire quoi que ce soit**. Cinq
éditions voyaient le planning dépasser leur `tomesParus`, et quatre étaient des pièges :

| Édition | En base | Planning | Ce que le planning décrit |
|---|---|---|---|
| `blame` | 6 | 10 | l'édition d'origine, possédée en 新装版 |
| `dragon-ball` | 21 | 42 | l'édition simple, possédée en édition double |
| `gantz` | 18 | 37 | l'édition d'origine, possédée en bunko |
| `neon-genesis-evangelion` | 7 | 14 | l'édition d'origine, possédée en Perfect Edition |
| `blackrock-shooter-innocent-soul` | 1 | 3 | **vrai gain** : Panini a publié 1 à 3 en 2013 |

**`REEDITIONS` existait, mais dans `apply-publication.ts` seulement** ; le circuit du planning
n'avait aucun garde-fou, et `dragon-ball` n'y figurait même pas — la BnF ne l'atteignait pas.

**Et le danger n'était pas `tomesParus`, il était l'ISBN.** `Neon Genesis Evangelion Vol.7` de
2002 porte `9782723440097` : c'est le tome 7 de l'édition d'origine, un autre livre que le tome 7
de la Perfect Edition possédée. Plafonner le dénominateur n'aurait rien réglé — il aurait fallu
plafonner *et* refuser les ISBN. **Pour une réédition, le planning décrit un objet physique
différent : l'édition entière est écartée**, pas seulement bornée. `REEDITIONS` est donc dans
`import_planning.py` et retire ces quatre slugs de l'index, avec une ligne à l'écran pour que
l'exclusion ne soit pas silencieuse.

**Troisième instance de la même leçon en une journée** — après LEVIATHAN et après les marqueurs
d'édition : *le filtre qui suffit sur 25 mois échoue en silence sur 25 ans*. Ces quatre séries
avaient cessé de paraître avant 2010, donc la fenêtre récente n'en contenait aucun volume.

**Le garde-fou par éditeur, lui, rapporte bien plus que la sonde ne le laissait croire.** Il
écarte **12 lignes, et ce sont les douze volumes du Leviathan d'Asuka** paru de 2005 à 2008 —
la sonde de septembre 2005 n'en avait montré qu'un. Sans lui, notre Leviathan de Ki-oon en
3 tomes passait à **12**, avec onze tomes fantômes et onze ISBN étrangers.

#### Ce que l'archive rapporte, mesuré et non extrapolé

Passage à blanc sur les 288 fichiers, **1,7 seconde** :

```
288 fichiers, 41941 lignes, 106 editions simples en base
4 editions ecartees car possedees en reedition
1849 lignes ecartees par un marqueur d'autre edition
83 editions appariees, 1333 tomes dates, 1333 avec ISBN
12 lignes ecartees sur divergence d'editeur
1 editions ou le planning depasse la base : blackrock-shooter-innocent-soul 1 -> 3
```

| | |
|---|---|
| Couples (édition, tome) recevant un ISBN | **1 333** |
| Éditions de la collection touchées | **83 / 106** |
| Couverture ISBN projetée | **156 → 1 489 sur 1 710, soit 87,1 %** (contre 9,1 %) |
| Séries distinctes pour le catalogue | **5 892** |
| dont portant un marqueur d'édition | **383** |

L'estimation du matin donnait ~70 % et 260 fichiers ; le réel est **87 %** avec 288 fichiers.
Le compte a été fait **deux fois par deux chemins indépendants** — un script de mesure écrit à
part, et le passage à blanc du vrai script — et les deux donnent 83 / 1333 / 12 / 1.

### Fait — l'archive de planning appliquée (3 septembre 2026)

Les 288 CSV de `~/Documents/planning_manga/` sont écrits en base. Le réel est conforme au passage
à blanc de la veille, au chiffre près.

| | avant | après |
|---|---|---|
| Volumes portant un ISBN | 156 | **1 489 sur 1 712, soit 87,0 %** |
| Volumes portant une date de sortie | 156 | **1 489** |
| Éditions sans aucun ISBN | 69 | **23 sur 113** |

`blackrock-shooter-innocent-soul` passe de 1 à 3 tomes — seule hausse, et un vrai gain : Panini a
publié les tomes 1 à 3 en 2013. Les 12 lignes du Leviathan d'Asuka sont écartées, notre Leviathan
de Ki-oon garde ses 3 tomes et zéro ISBN. Les sept compteurs sont intacts : 109 séries,
113 éditions, 1 153 possédés, 1 674 couvertures.

**Le scan de code-barres change de nature** : la reconnaissance locale passe de 9,2 % à 87 %.

#### Corrigé — l'application aurait détruit 10 sorties annoncées

Défaut trouvé **à la relecture, avant d'écrire**. `apply-planning.ts` purgeait les `Sortie` de
chaque édition du manifeste puis les recréait depuis `aParaitre`. Ce lot s'arrêtant en janvier
2024, il ne porte aucune annonce : les 16 sorties de septembre-octobre 2026 issues du premier lot
tombaient, **10 d'entre elles étant sur une édition du manifeste, dont 8 portant une
`couvertureUrl` déjà déposée dans Blob**. Les recréer plus tard depuis le lot 2024-2026 aurait
rendu les lignes mais pas les couvertures, et les réacquérir aurait coûté le quota Blob qu'il ne
faut précisément pas dépenser.

**La règle : le silence d'un import ne vaut pas suppression.** Un manifeste ne dit rien après sa
dernière ligne datée, donc la purge est bornée à la fenêtre qu'il couvre — `finDeFenetre` dérive
cette borne du manifeste lui-même, sans rien changer au script Python. Sur une réimportation de
la fenêtre récente le comportement est inchangé, toutes les annonces y étant antérieures à sa
borne ; sur une archive ancienne, plus rien n'est touché. Le script annonce la borne et le nombre
de sorties conservées, une exclusion silencieuse se lisant comme un oubli.

**Quatrième instance de la même leçon** — après LEVIATHAN, les marqueurs d'édition et les
rééditions : *le traitement qui suffit sur une fenêtre courte échoue en silence sur une archive
longue.*

#### Corrigé — la sauvegarde de reprise ne couvrait que le premier lot

`data/editions-avant-planning.json` n'était écrit que s'il n'existait pas, pour ne pas figer un
état déjà modifié. Conséquence non vue : il portait les 35 éditions du premier lot, donc un
`--revert` après ce passage aurait laissé en place les ISBN des 53 éditions propres à l'archive.
La sauvegarde est désormais **complétée sans écrasement** — chaque édition garde son plus ancien
état connu, et la couverture s'étend. 35 → **88 éditions**.

### Fait — les couvertures sur Cloudflare R2 (3 septembre 2026)

Le point 1 de la revue du 31 août est clos. Les **1 688 images sont dans R2** — 1 674 couvertures
de volume et 14 de sorties annoncées — et plus une seule `couvertureUrl` ne pointe vers Vercel
Blob. Le quota Blob, qui était à ~200 opérations d'une panne de 30 jours, ne menace plus rien.

| Fichier | Rôle |
|---|---|
| `lib/r2.ts` | le client S3, `deposer`, `listerObjets`, la base publique |
| `lib/queue.ts` | `enFile`, extrait de `upload-covers.ts` et partagé |
| `scripts/migrate-covers-r2.ts` | `npm run covers:migrate` — `--dry-run`, `--max <n>` |
| `scripts/upload-covers.ts` | bascule vers R2, plafond et `--force` intacts |
| `data/storage.json` | la base publique en service, remplace `data/blob.json` |

**La migration n'a coûté aucune opération avancée Blob**, comme le 1er septembre l'exigeait :
elle énumère depuis Postgres, télécharge par les URL publiques — opérations *simples*, servies
par le CDN — dépose dans R2 et réécrit les URL. Le store Vercel n'a jamais été listé.
Coût côté R2 : **1 689 opérations Class A sur le million mensuel**, marge ×590.

Vérifié, et pas seulement compté : une couverture tirée au hasard est **identique au MD5** à son
original Blob, servie en `200` avec `Content-Type: image/webp` et
`Cache-Control: public, max-age=31536000` — parité exacte avec Blob, l'année immuable de §5. Sur
25 URL tirées dans la base, 25 répondent `200 image/webp`. Le bucket porte 1 688 objets, soit le
compte exact. Les sept compteurs sont intacts.

**Et confirmé à l'écran** : les couvertures s'affichent bien dans l'application, vérifié par
l'utilisateur le 3 septembre. Ce contrôle-là n'est pas une formalité — trois pièges de
diagnostic recensés dans ce document rappellent que seul un test fonctionnel abouti prouve
quelque chose.

- **L'envoi s'est fait en deux temps, volontairement.** Cinq couvertures d'abord, vérifiées à
  l'octet et à l'en-tête, puis les 1 683 autres. Un mauvais `Content-Type` ou un bucket non
  exposé se serait sinon découvert après 1 688 envois **et** autant de réécritures.
- **L'endpoint ne se déduit pas de l'identifiant de compte.** Première tentative avec l'URL de
  juridiction `….eu.r2.cloudflarestorage.com`, que l'écran de création du jeton propose à côté
  de la Default : `NoSuchBucket`. Le bucket avait un *emplacement* Europe, pas une *juridiction*
  EU — deux réglages distincts, et la différence est invisible jusqu'à l'échec. D'où
  `R2_ENDPOINT` recopié tel quel plutôt que reconstruit.
- **`requestChecksumCalculation: "WHEN_REQUIRED"`** sur le client : les versions récentes du SDK
  AWS activent des sommes de contrôle que R2 n'accepte pas toujours.
- **Un échec de téléchargement laisse l'URL sur l'ancien store** au lieu de la casser. Il n'y en
  a eu aucun, mais c'est ce qui rendait la migration sûre à lancer.
- **`@vercel/blob` est désinstallé**, plus rien ne l'importe. `data/blob.json` est supprimé ; son
  origine, `https://rxcktbmfxnyzkayd.public.blob.vercel-storage.com`, reste dans l'historique git
  et dans `data/backup.json` du commit précédent, ce qui suffirait à un retour arrière.
- **La sauvegarde est réexportée après la migration** : elle portait les 1 688 anciennes URL.

**Les trois garde-fous du 1er septembre sont posés**, avec une correction sur le troisième : *Event
Notifications* est une fonction payante qui déclenche des Workers, pas un avertisseur d'usage.
L'alerte vit au niveau du compte, **Manage Account › Notifications › Billing Budget Alert**,
gratuite, réglée au seuil le plus bas — le garde-fou étant arithmétique, il doit se déclencher au
premier centime, pas à un montant « raisonnable ». Cloudflare avertit par ailleurs
automatiquement à 80 % des quotas gratuits.

**Ce qui n'est pas fait : le domaine personnalisé.** La base est l'URL `r2.dev`, que Cloudflare
réserve au développement, limite en débit et **ne met pas en cache**. Le risque réel est atténué
par le `loading="lazy"` de `components/cover.tsx:27` — le navigateur ne demande que ce qui entre
dans le viewport, quelques images à la fois et non les 109 lignes de la Collection. Voir
« Reste à faire » dans `CLAUDE.md`.

### Fait — le déploiement (consigné le 3 septembre 2026)

**L'application tourne en production sur Vercel**, et la PWA y est installée depuis Chrome.
Ce fait n'avait jamais été écrit : les sections « Fait » ne parlent que de vérifications en
`npm run dev`, en `npm run start` ou via l'IP du réseau local. **Une session de septembre a
relu ce document et en a conclu que rien n'était déployé.** D'où cette section — l'omission
coûtait plus cher que la ligne qui la répare.

- **Le dépôt pilote le déploiement** : `github.com/Yaminosenko/manga_collection`, branche `main`.
  Pousser déclenche un rebuild.
- **Le build de production applique les migrations.** `npm run build` enchaîne
  `prisma generate`, `npm run db:migrate` puis `next build` : Vercel emprunte le même script
  que le poste, sur le 443, comme §7 le prévoit. Une migration déjà appliquée est sans effet.
- **`vercel.json` ne porte que `"regions": ["fra1"]`**, ce qui règle le point de §7 sur les
  fonctions placées à Washington par défaut.
- **Les variables sont dans Vercel, pas dans le dépôt** : `DATABASE_URL`, `DIRECT_URL` et
  `ACCESS_PASSWORD` — ce dernier **doit être identique à celui du poste**, sinon les deux
  divergent. **Aucune variable `R2_*` n'y a sa place** : l'application ne fait que lire les URL
  absolues stockées en base.
- **Les couvertures n'ont demandé aucun redéploiement lors de la migration R2 du 3 septembre.**
  Les URL vivent dans Neon, que les deux environnements partagent : la base a basculé, le code
  déployé n'avait pas besoin de changer. C'est la même propriété qui rendra gratuit le passage
  à un domaine personnalisé.
- **`localhost` n'est pas un déploiement.** Chrome le traite comme un contexte sécurisé, donc
  l'installation PWA y fonctionne — mais l'application installée pointe vers le poste, ne vit
  que serveur de développement allumé, et reste hors de portée du téléphone.

**Première vérification de la production, le 3 septembre 2026.** Toutes les autres campagnes de
ce document sont locales ; celle-ci porte sur le domaine déployé.

| Chemin | Réponse |
|---|---|
| `/`, `/manquants`, `/planning`, `/edition/…/tomes` | **307 vers `/acces`** |
| `/manifest.webmanifest`, `/icon-192.png` | 200, hors garde comme prévu |
| `/.well-known/assetlinks.json` | **404, pas 307** — bien exclu du `matcher` |
| `/acces` | 200 |

Avec un jeton **invité**, l'en-tête rend « 1 153 tomes · 109 éditions », la valeur
« ≥ 8 772,91 € » et la section « Vendues 4 » — conformes à la base. **218 références d'images
sur `r2.dev`, zéro sur `blob.vercel-storage.com`**, idem sur la page Édition (48) et la grille
(46) : la migration R2 est donc confirmée en production, pas seulement en local. Le bandeau
« Mode invité » est présent et la barre ne montre que trois onglets, Ajouter étant masqué.

- **Le jeton se calcule, il ne se saisit pas.** `createHmac("sha256", ACCESS_PASSWORD)` sur le
  message `invite` suffit à un contrôle visuel, sans manipuler le mot de passe réel — la méthode
  que ce journal recommandait déjà après un test raté le 30 août.

### Fait — les sorties annoncées deviennent des tomes (3 septembre 2026)

Signalé à l'usage : une sortie annoncée dont la date arrive **ne devenait jamais un tome**.
`chargerPlanning` (`lib/editions.ts:291`) ne filtre pas sur la date, donc RAI RAI RAI tome 3,
paru le 3 septembre, serait resté au Planning indéfiniment — sans compter dans `tomesParus`,
sans apparaître dans « Mes tomes » ni dans Manquants, et **sans pouvoir être coché**. Seule la
moitié du mécanisme avait été écrite le 30 août.

**La règle du 30 août ne s'y opposait pas, elle l'appelait.** Elle justifiait d'isoler les sorties
ainsi : « un tome non paru gonflerait le dénominateur et remonterait dans Manquants, **où il n'a
rien à faire puisqu'on ne peut pas l'acheter** ». La date passée, on peut l'acheter : la
justification tombe, et la conversion devient la suite logique.

| Fichier | Rôle |
|---|---|
| `lib/promotion.ts` | `promouvoirSortie`, `promouvoirSortiesEchues` — la conversion, en transaction |
| `lib/actions.ts` | `marquerSortieObtenue`, réservée au propriétaire |
| `app/api/cron/route.ts` | la tâche quotidienne, hors garde, protégée par `CRON_SECRET` |
| `components/planning-claim.tsx` | le bouton « Je l'ai » |
| `vercel.json` | `crons`, une fois par jour à 4 h |

**Deux chemins, un seul résultat.** Un bouton « Je l'ai » sur les lignes dont la date est passée
crée le tome **possédé** et la sortie disparaît ; sans geste, elle reste au Planning tout le mois
puis le cron la promeut en tome **non possédé**, qui rejoint alors Manquants. Le seuil est le
premier jour du mois courant, pas la date exacte : les dates manga-news glissent, et un tome
annoncé le 3 peut arriver le 12.

- **Le tome hérite de l'ISBN, de la date et de la couverture de l'annonce.** C'est ce qui rend la
  promotion préférable à une simple hausse de `tomesParus` : les 14 couvertures de sorties déjà
  dans R2 ne sont pas perdues, et l'ISBN alimente le scanner.
- **`tomesParus` est relu dans la transaction, pas avant.** Première version : le compte était
  lu avec la sortie, donc deux sorties d'une même édition promues à la suite travaillaient sur
  une valeur périmée et la seconde tentait de recréer un volume existant.
- **Les helpers purs sont dans `lib/domain.ts`, pas dans `lib/promotion.ts`.** Ce dernier importe
  Prisma ; `components/planning-claim.tsx` étant client, l'importer aurait cassé le build —
  le piège documenté à l'étape 3.
- **Le bouton est sorti du `<Link>`** qui enveloppait toute la ligne : un contrôle imbriqué dans
  un lien ne se comporte correctement ni au clavier ni au tap.
- **Le refus d'une sortie future est côté serveur**, pas seulement masqué dans l'interface —
  vérifié, `promouvoirSortie` sur `radiant` 20 évalué au 1er janvier rend `null`.
- **`/api/cron` est hors du `matcher` de `proxy.ts`**, sinon la garde le renverrait vers `/acces`.
  Il se protège donc seul : sans `CRON_SECRET`, il répond 401 à tout. Échec fermé, comme
  `ACCESS_PASSWORD`.

**Vérifié de bout en bout, avec restauration à l'identique** : `rai-rai-rai` passe de
`tomesParus=2, sorties=[3]` à `tomesParus=3` avec le tome 3 possédé portant l'ISBN
`9791032723579`, sa date et sa couverture, puis revient exactement à son état initial. Les
compteurs globaux sont intacts — 109 / 113 / 1 712 / 1 153 / 16 sorties / 1 674 couvertures. Et
**0 sortie échue au 3 septembre** : le cron ne promeut rien aujourd'hui, ce qui est le
comportement attendu six jours sur sept.

**C'est la première brique du rafraîchissement de fond de §5**, qui n'existait pas. Restent à y
ajouter les nouveaux tomes parus, `editionTerminee` et les couvertures manquantes.

### Fait — `ParutionCatalogue` alimentée (8 septembre 2026)

La table existait depuis le 2 septembre et **rien ne l'écrivait**. Elle porte désormais
**8 296 parutions**, d'août 2024 à décembre 2026.

| Fichier | Rôle |
|---|---|
| `scripts/import_catalogue.py` | `npm run catalogue:import <dossier>` — lit les CSV, n'écrit que des manifestes |
| `scripts/apply-catalogue.ts` | `npm run catalogue:apply` — écrit ; `--dry-run`, `--recalculer` |
| `data/catalogue.json` | le manifeste, **non versionné** |
| `data/catalogue-controles.json` | les cas à relire, **non versionné** |

**Aucun garde-fou d'`import_planning.py` n'est repris, et c'est le point de départ.** Ce script
écarte les rééditions, les marqueurs d'autre édition, les divergences d'éditeur, et n'apparie que
les séries possédées — parce qu'il protège **la collection** de mauvais appariements. Le
catalogue, lui, est une *copie fidèle de l'archive* : y appliquer ces filtres reviendrait à
amputer la source de tout ce qui n'est pas déjà en collection, c'est-à-dire de sa raison d'être.
Les deux scripts lisent les mêmes CSV et n'ont donc volontairement aucun code commun.

**Les trois règles de lecture du 2 septembre sont implémentées et vérifiées** sur les exemples
que la spécification donnait comme pièges :

| Entrée | `serieTitre` | `marqueurEdition` |
|---|---|---|
| `Mobile Suit Gundam - Ecole du Ciel (l')` | `Mobile Suit Gundam - L'Ecole du Ciel` | — |
| `Légendaires (les)` | `Les Légendaires` | — |
| `Légendaires (les) - Saga` | `Les Légendaires - Saga` | — |
| `Fullmetal Alchemist - Edition reliée` | `Fullmetal Alchemist` | `Edition reliée` |
| `Ippo - Saison 4 - La loi du ring` | inchangé | — |
| `Übel Blatt II` | inchangé | — |

La désinversion **par segment** est donc bien celle qui tourne : globale, elle aurait rendu
`L'Mobile Suit Gundam - Ecole du Ciel`. Et `Légendaires (les) - Saga` reste un objet distinct de
la série de base, ce qui est exact. L'accent n'est pas restauré — `L'Ecole` et non `L'École` —
la source n'en portant pas et `titreBrut` gardant la ligne au caractère près.

- **Le marqueur ne s'extrait qu'à partir de deux segments.** Sans cette garde, un titre d'un
  seul segment contenant un mot de la liste perdrait sa racine entière : `Romantique Vol.1`
  n'aurait plus de série. Avec elle, `Naruto - Roman Vol.1` se découpe correctement.
- **Un EAN non livre est mis à `null`, la ligne est gardée.** Les 7 cas sont des préfixes `370`
  de coffrets et d'éditions collector. La règle du 2 septembre visait la clé, pas la ligne :
  supprimer la ligne aurait retiré du catalogue un objet qui existe.
- **Les lignes sans `Vol.N` sont gardées, `numero` à `null`** — 809 sur 8 296, soit les artbooks,
  guides, coffrets et one-shots.

**Résultat mesuré : 8 296 parutions, 2 702 séries distinctes, 8 195 avec EAN (98,8 %),
771 marqueurs d'édition.** Les 2 702 séries sont moins que les 2 988 racines brutes comptées le
matin : c'est la consolidation qui opère, `Vampire Knight - Edition Perfect` et `Vampire Knight`
étant désormais la même série avec deux marqueurs.

**Ce que ça débloque, vérifié en base** : `berserk` rend `Berserk`, tome maximum 43, marqueurs
`Collector` et `Edition Prestige` ; `chainsawman` rend `Collector` et `Edition Limitée`. **Aucune
autre source ne donnait le couple nom FR + nom d'édition française** — la BnF a cinq formats et
des marqueurs instables, AniList ne connaît pas les éditions françaises. C'est la porte d'entrée
qui manquait pour créer une seconde édition.

**L'import est rejouable, et c'est prouvé** : second passage, `0 inserées, 8 296 déjà présentes`.
La clé `(titreBrut, date)` fait le travail, comme le 2 septembre l'avait prévu.

#### Quatre limites trouvées en vérifiant, toutes petites et toutes à connaître

- **La clé `(titreBrut, date)` perd les objets multiples du même jour.** Doki Doki a sorti
  **trois coffrets Sun-Ken Rock le 5 novembre 2025**, même titre, trois EAN — `…16300`, `…16317`,
  `…16324`. Un seul entre, deux EAN sont perdus. C'est le prix de la propriété qui compte
  davantage — un import rejouable sur des mois qui se recouvrent — mais un scan des deux autres
  coffrets ne résoudra pas. 2 lignes sur 8 298.
- **5 EAN sont portés par plusieurs lignes, pour quatre causes distinctes.** Une sortie
  **repoussée** et donc annoncée deux fois (`Nights With a Cat Vol.8` en octobre puis novembre
  2026) ; un même livre sous **deux éditeurs et deux graphies** (`Magnum Opus - La malédiction
  dorée Vol.3` chez H2T contre `Malédiction dorée (La)` chez Nouvelle Hydre) ; un **Deluxe et son
  édition simple partageant un EAN** (`Veil Vol.5`), ce qui est impossible et donc fautif à la
  source ; et un EAN **manifestement mal saisi**, partagé par `Martial Universe Vol.10` et
  `Berserk of Gluttony Vol.12` à sept mois d'écart. **Conséquence pour le scanner : une
  résolution par EAN doit rendre la ligne la plus récente, pas la première.**
- **`ORDER BY numero DESC` place les `NULL` en tête sous PostgreSQL.** Avec 809 lignes sans
  numéro, « le dernier tome d'une série » remonte un coffret : la requête sur `kagurabachi` rend
  `Kagurabachi - Coffret` avant le tome 11. Exclure les `null` ou demander `NULLS LAST`.
- **La liste des marqueurs n'est pas exhaustive et le restera.** `L'Attaque Des Titans - Grand
  Format - Hachette Collection` n'en porte aucun, faute de `grand format` dans la liste, et
  `Edition Limitée` / `Edition limitée` coexistent sans être unifiées. Sans gravité : `--recalculer`
  réécrit `serieTitre`, `marqueurEdition` et `numero` depuis `titreBrut` **sans retélécharger un
  CSV**, ce qui est exactement la raison d'être de ce champ.

**Ce qui manque : les 288 fichiers de janvier 2000 à janvier 2024**, qui sont sur une autre
machine. Le catalogue est donc à **8 296 lignes sur les ~50 000** de l'archive complète, et à
2 702 séries sur ~5 900. L'ordre d'import n'a aucune importance — la clé rend chaque passage
idempotent, et rien dans ce circuit ne touche `Edition`, `Volume` ni `Sortie`.

**Aucune sauvegarde n'a été prise avant l'écriture, volontairement.** `ParutionCatalogue` n'a
aucune clé étrangère dans les deux sens, elle est hors de `data/backup.json` depuis le
2 septembre et hors des compteurs de restauration : une sauvegarde ne l'aurait pas protégée, et
un `createMany` sur ce seul modèle ne peut rien atteindre d'autre. Les compteurs de la collection
sont intacts après écriture.

---

### Fait — la Phase 0 du passage au multi-compte (9 septembre 2026)

Les prérequis de §13.1, avant d'écrire une seule migration.

**La sauvegarde datait du 3 septembre et mentait de deux tomes.** Relevé sur Neon :
109 séries, 113 éditions, 1 714 tomes, 1 155 possédés, 2 forcées, 1 676 couvertures — contre
1 712 et 1 153 dans le fichier. L'écart vient de la promotion des sorties échues, qui crée des
tomes : `data/backup.json` n'est jamais périmé par une erreur, seulement par le temps.

**Le commit est tagué `avant-multi-compte`.** C'est le seul chemin de retour, et il porte
l'ancien `scripts/backup-db.ts`, seul capable de relire ce `backup.json` : la Phase 2 fait passer
ses compteurs de 8 à 7, `aVerifier` disparaissant et `forcees` devenant `suivies`, inversé.

**Les 12 éditions `aVerifier` ont été relues et le drapeau est à zéro.** Onze par
`updateMany`, sur la relecture du propriétaire ; la douzième — `doubt`, 4 tomes — gardée
exprès pour éprouver le bouton, puis baissée par un vrai clic. Aucune répartition n'a eu besoin
d'être corrigée : 1 155 possédés avant, 1 155 après. La colonne meurt avec la migration 2 et
l'information n'était pas reconstituable après coup, d'où l'insistance.

**Deux corrections de chiffres dans `CLAUDE.md`.** Le tableau de contrôle de la Phase 1
attendait 1 712 possessions et 1 153 possédées ; comme ces deux compteurs bougent seuls, le
contrôle se fait désormais contre le `compteurs` du `backup.json` fraîchement écrit, pas contre
un tableau figé. Et les couvertures manquantes ont un troisième slug :
`blackrock-shooter-innocent-soul` 2 et 3, nés de la promotion d'une sortie annoncée —
`promouvoir()` recopie la couverture de la `Sortie` (`lib/promotion.ts:55`) et celle-ci était
nulle, donc **un tome promu sans couverture le reste** jusqu'au prochain remplissage manuel.

**La Phase 0 gagne un quatrième point.** Relire les 12 était écrit dans le corps de §13.1 mais
absent de la liste d'exécution : un prérequis qu'une session pressée aurait sauté.

### Corrigé — la validation de répartition confirmait avant d'écrire (9 septembre 2026)

Trouvé en cherchant pourquoi les 12 drapeaux étaient toujours levés après une relecture que
l'écran avait pourtant confirmée.

`components/volume-grid.tsx` posait `setValidee(true)` **avant** le `await` de l'action. Le bloc
« À vérifier » et son bouton disparaissaient donc dès le tap, que l'écriture atteigne Neon ou
non, et rien ne les ramenait : un `useState` ordinaire, jamais réconcilié avec le serveur. À
comparer aux cases de la grille juste au-dessus, qui passent par `useOptimistic` et se
réalignent seules sur l'état serveur à la fin de la transition.

L'état local disparaît. C'est `aVerifier`, lu en base, qui décide de l'affichage — le bloc est
retiré par la revalidation, comme `PlanningClaim` le fait déjà pour « Je l'ai ». Un échec devient
visible, `LIBELLE_REPARTITION_ERREUR` suivant la mise en forme des `error.tsx` existants.

**C'était un défaut latent, pas la cause prouvée.** Le 4 septembre avait éprouvé ce bouton par un
vrai clic et l'écriture passait ; le chemin serveur est intact, `marquerRepartitionVerifiee`
n'a pas bougé. Pourquoi les 12 ont survécu à la relecture n'est pas établi et ne le sera pas :
la trace n'existe plus. Ce qui est corrigé, c'est qu'un tel échec ne peut plus se déguiser en
succès.

**Vérifié fonctionnellement, sur `doubt`** : clic par coordonnées sur le bouton visible, le bloc
disparaît, `aVerifier` passe de 1 à 0 en base et les possessions ne bougent pas — 113 éditions,
1 714 tomes, 1 155 possédés, 1 676 couvertures, 2 forcées, `suivie` attendu toujours à 84.

- **Le piège d'automatisation du 4 septembre s'est reproduit, sous une autre forme.** Le premier
  clic, aux coordonnées lues sur une capture, n'a rien déclenché : la hauteur du viewport avait
  changé entre la capture et le clic — 744 px puis 698 — et le bouton à y=722 était sorti de
  l'écran. Aucune erreur, aucun log, l'écran inchangé. **Recapturer juste avant de cliquer, et
  ne conclure que sur la base.**

### Fait — les trois migrations répétées sur le banc (9 septembre 2026)

Phase 1 de §13.1. Les trois migrations sont écrites, jouées sur une copie fidèle de la base et
vérifiées par écriture réelle, pas seulement par des compteurs.

| Fichier | Rôle |
|---|---|
| `prisma/pending-migrations/20260909120000_utilisateurs_et_alias/` | l'enum `RoleUtilisateur`, la table `Utilisateur`, la ligne du propriétaire, `Serie.alias` et son index GIN |
| `prisma/pending-migrations/20260909120100_suivi_edition/` | `SuiviEdition`, le backfill, `Edition.creeeParId`, puis le `DROP` des 5 colonnes |
| `prisma/pending-migrations/20260909120200_possession_par_compte/` | `Possession.utilisateurId`, l'échange des index, la clé étrangère |
| `scripts/apply-migrations.ts` | accepte `LOCAL_DATABASE_URL` (pilote `pg`) et `MIGRATIONS_DIR` |

**Le SQL est hors de `prisma/migrations/` et doit y rester** jusqu'à ce que le code de la Phase 2
soit prêt : `npm run build` enchaîne `db:migrate`, donc un dossier posé au bon endroit part au
prochain déploiement Vercel **sans le code qui va avec**. C'est le piège que §13.1 nomme, et le
seul moyen de ne pas y tomber est que le chemin normal ne voie rien.

**Le runner ne savait pas parler à un Postgres local.** Il n'ouvrait qu'un `Pool` Neon, qui parle
le proxy WebSocket de Neon et pas le protocole Postgres : la répétition était impossible en
l'état. Il choisit désormais `pg` quand `LOCAL_DATABASE_URL` est là, comme `backup-db.ts` le fait
depuis le 30 août, et `MIGRATIONS_DIR` permet de viser le dossier en attente. Le chemin de
production ne bouge pas — sans ces deux variables, c'est `DIRECT_URL` et `prisma/migrations`.

L'id du propriétaire est un **UUID littéral figé dans le SQL**, `f087527f-…0169fe`, généré une
fois : une migration ponctuelle doit être déterministe. L'email reste **nul**, le dépôt étant
public.

#### Les contrôles, tous passés

| Attendu | Obtenu |
|---|---|
| `SuiviEdition` = 113, toutes sur le propriétaire | 113 / 113 |
| statuts préservés | `EN_COURS=86 ABANDONNEE=18 EN_PAUSE=5 VENDUE=4` |
| `suivie=true` = 84, aucune hors `EN_COURS` | 84, et 0 hors `EN_COURS` |
| `ajouteeLe` reprise | 0 nulle, du 28 au 30 août |
| `Possession` = 1 714 sur le propriétaire, 1 155 possédés | conforme |
| `Serie.alias` renseigné | 105 sur 109, et 0 divergence avec `titreVo` |
| `Edition` sans les 5 colonnes | « aucune » restante |
| `SuiviEdition` sans `raisonCompletion` ni `aVerifier` | 6 colonnes, aucune des deux |
| index échangés sur `Possession` | `utilisateurId_volumeId_key` et `utilisateurId_possede_idx`, l'ancien `volumeId_key` disparu |
| `creeeParId` | nul sur les 113, ce qui veut dire « venu de l'import » |

**Trois vérifications par écriture réelle, dans une transaction annulée ensuite**, parce qu'un
`pg_indexes` qui affiche le bon nom ne prouve pas que la contrainte protège quelque chose :
deux comptes sur le **même** `volumeId` sont acceptés — l'ancien `volumeId @unique` est bien
mort ; un second `(utilisateurId, volumeId)` identique est refusé, `duplicate key value violates
unique constraint "Possession_utilisateurId_volumeId_key"` ; et supprimer le compte emporte ses
possessions et ses suivis en laissant **les 1 714 lignes du propriétaire intactes**. 1 714 avant,
1 714 après annulation.

**Le Planning perd ses 4 fantômes, et ce sont les bons.** Les sorties portées par une édition non
suivie sont exactement `blue-exorcist`, `les-legendaires-saga`, `one-puch-man` et
`why-nobody-remember-my-world` — les quatre relevés le 4 septembre. Le backfill
`statut = 'EN_COURS' AND termineeForcee = false` fait donc ce que §13.1 avait prédit, sans rien
changer à Manquants.

#### Deux propriétés du banc, à connaître avant de le remonter

- **`npx prisma dev` rend une URL sur `template1`.** Toute base créée ensuite en hérite : la
  base `manga` de cette répétition est arrivée avec le schéma **et** le `_prisma_migrations` du
  banc du 30 août, si bien que seules 4 des 5 migrations existantes ont été rejouées. Sans
  conséquence ici — l'état d'arrivée était bon, 8 tables et 0 édition — mais un banc qu'on croit
  vierge ne l'est pas.
- **`LOCAL_DATABASE_URL` ne doit pas entrer dans `.env`.** `backup-db.ts` s'en sert pour choisir
  sa cible : une sauvegarde lancée ensuite irait silencieusement frapper le banc au lieu de Neon,
  et écraserait `data/backup.json` avec l'état du banc. Elle se passe en préfixe de commande.
- Le banc tourne en **PostgreSQL 17.5 (wasm)** là où Neon est en **18.6**. `gen_random_uuid()` et
  l'index GIN sur `text[]` sont natifs des deux côtés.

**Ce que la Phase 1 ne couvre pas, et qui vient avec la Phase 2** : `backup-db.ts` lit encore
`statut` et `aVerifier` sur `Edition` et niche la possession sous le volume. Après migration il
ne sait donc ni sauvegarder ni restaurer le banc — c'est le point 4 de la Phase 2, et il doit
être fait **avant** qu'on ait besoin du filet.

### Fait — la Phase 2 éprouvée sur le banc (9 septembre 2026)

Le code de la séparation catalogue/suivi tourne sur une copie fidèle de la base, migrée. Voie A
de la vérification : `lib/prisma.ts` choisit l'adaptateur `pg` quand `LOCAL_DATABASE_URL` est
présente, ce qui permet d'éprouver les écrans **sans toucher à Neon**. `pg` et
`@prisma/adapter-pg` passent en `dependencies`, étant désormais référencés depuis du code
applicatif ; sans la variable, c'est `DATABASE_URL` et l'adaptateur Neon, inchangé.

| Écran | Lu à l'écran |
|---|---|
| Collection | 1 155 tomes · 109 éditions · ≥ 8 787,61 € — identique à avant |
| Manquants | **116 tomes · 16 éditions**, section repliée disparue, AIR GEAR avec ses 5 trous |
| Planning | **10 sorties**, aucune des 4 fantômes |
| Page Édition | « Statut · Terminée par choix » conservé sur `judge`, bloc Séries liées intact |
| État | nouveau bloc « SUIVI », « Suivie / Non suivie » |
| Mes tomes | grille sans bloc « À vérifier » |

**Quatre écritures réelles, chacune recontrôlée en base.** `judge` passé à « Suivie » → `true`
en base, suivies 84 → 85, **et Manquants monte à 117 tomes · 17 éditions avec JUDGE dedans** :
la réversibilité d'un tap, celle que §13.1 promet en échange de la section repliée. Retour à
« Non suivie » → `false`, 84. `doubt` tome 2 coché → 1 156 possédés, sur la nouvelle clé
`(utilisateurId, volumeId)` ; décoché → 1 155. Le banc est revenu à sa base exacte :
1 714 possessions, 1 155 possédés, 84 suivies, 113 suivis.

**Le piège d'automatisation, sixième manifestation.** Un premier rétablissement de `judge`,
cliqué **par référence d'élément juste après la navigation**, n'a rien écrit — sans doute avant
l'hydratation. Aucune erreur, l'écran inchangé, et je ne l'ai vu qu'en relisant la base. Le
geste refait par coordonnées, sur un élément visible, est passé. **Recapturer avant de cliquer,
et ne conclure que sur la base.**

#### Ce qui reste non vérifié, et pourquoi

**`creerSerieAvecEdition` n'a pas pu être exercée.** Ses changements de Phase 2 — créer le
`SuiviEdition`, renseigner `creeeParId`, ne plus créer de possessions — compilent mais n'ont pas
tourné. Le formulaire de confirmation n'est rendu que depuis un **résultat distant**
(`components/add-series.tsx`, `choisie` vient de `resultats.distantes`), et le scanner ne fait
que pointer des éditions existantes. Sans AniList, il n'existe donc aucun chemin d'interface
vers la création. À reprendre dès qu'AniList revient, ou quand `/ajouter` sera branché sur
`ParutionCatalogue`.

**Le mode invité non plus**, faute de vouloir saisir le mot de passe pour fabriquer un jeton
invité. Le propriétaire confirme qu'il fonctionne ; la ligne qui le résout vers le propriétaire
est dans `lib/utilisateur.ts` et n'a pas été exercée.

### Établi — AniList a coupé son API (9 septembre 2026)

Constaté en éprouvant `/ajouter`. Toute requête à `graphql.anilist.co` rend **403** avec
« The AniList API has been temporarily disabled due to severe stability issues. » La réponse
vient d'AniList : ce n'est ni le réseau du poste professionnel, ni un défaut de notre code, ni
une clé manquante — vérifié en direct au curl, avec et sans `User-Agent`.

**Ce que ça prouve au passage, et qui est une bonne nouvelle** : la règle de §11 — « une API
muette ne casse jamais un écran » — tient sur le terrain. `/ajouter` affiche la collection
locale avec ses compteurs justes et la mention « La recherche externe est indisponible. La
collection locale reste consultable. » Aucune trace, aucun écran cassé. Ce chemin de dégradation
n'avait jamais été éprouvé autrement qu'en théorie.

**Ce que ça coûte** : plus aucun ajout de série depuis l'application, `anilist:fetch` et
`relations:fetch` ne rendront rien, et le pont vers les titres romaji de MangaDex est coupé — le
sélecteur de couvertures en dépend (§5). La sonde du 28 août reste vraie de ce que l'API
*donnait* ; elle ne disait rien de sa disponibilité, et c'est la leçon : une source mesurée
n'est pas une source acquise.

**Ce que ça renforce** : brancher `/ajouter` et `/scanner` sur `ParutionCatalogue`, déjà dans
« Reste à faire ». Le catalogue porte le nom FR, le marqueur d'édition, l'éditeur, la date et
l'EAN, il est en base, et il ne dépend de personne. La dépendance à AniList pour la porte
d'entrée était un point unique de rupture ; c'est maintenant démontré.

### Fait — la séparation appliquée à la production (9 septembre 2026)

Les trois migrations sont jouées sur Neon, par **la commande de production exacte** —
`npm run db:migrate`, `DIRECT_URL`, `prisma/migrations`, sans aucune variable de banc — pour que
ce qui tourne soit littéralement ce que Vercel exécutera.

**Contrôle avant :** les compteurs de `data/backup.json` concordaient à l'unité avec Neon. Le
chemin de retour couvrait donc l'état réel, et pas celui du matin. Ce contrôle vaut d'être
gardé : sans lui, une écriture faite en production entre la sauvegarde et la migration serait
perdue sans trace.

**Contrôle après**, identique au banc au chiffre près : 1 `Utilisateur` `PROPRIETAIRE` à `email`
nul, 113 `SuiviEdition` sur ce seul compte, statuts `86/18/5/4` préservés, `suivie=true` sur 84
et aucune hors `EN_COURS`, `ajouteeLe` sans nulle, 1 714 possessions dont 1 155 possédées,
`alias` sur 105 séries sans divergence avec `titreVo`, `creeeParId` nul sur les 113, aucune des
5 colonnes restante sur `Edition`, index de `Possession` échangés, index GIN sur `alias`.
Intacts : 109 séries, 113 éditions, 1 714 tomes, 14 sorties, 18 liens, 8 296 parutions.

**Le filet éprouvé dans les deux sens, pour la première fois depuis sa réécriture** :
sauvegarde de Neon dans la nouvelle forme, puis restauration complète sur le banc — 1
utilisateur, 113 suivis, 1 714 possessions, sept compteurs concordants.

**La production vérifiée à l'écran, en mode invité.** 10 commits et le tag poussés, Vercel
déployé, puis `https://manga-collection-wcj8.vercel.app` ouvert par le bouton « Entrer en
invité » — aucun mot de passe n'a été saisi ni n'avait à l'être. Bandeau « Mode invité ·
consultation seule », Collection **1 155 tomes · 109 éditions · ≥ 8 787,61 €**, Manquants
**116 tomes · 16 éditions**, Planning **10 sorties**, et **aucun bouton « Je l'ai »** : les
contrôles d'écriture sont masqués. Session invitée refermée par « Quitter ».

**Ça vérifie du même coup la résolution invité → propriétaire** de `lib/utilisateur.ts`, qui
était l'un des deux chemins déclarés non vérifiés une heure plus tôt. Il n'en reste qu'un,
`creerSerieAvecEdition`, bloqué par la coupure d'AniList.

**L'URL de production n'était écrite nulle part** — ni dans le dépôt, ni dans `JOURNAL.md`, ni
dans `CLAUDE.md`. Impossible de contrôler un déploiement sans la demander au propriétaire, alors
que le journal prétend faire foi sur ce qui est fait. Elle est désormais en tête de §12.

**Ordre à retenir pour la prochaine migration** : la base est partie avant le code, donc la
production a servi l'ancien code sur le nouveau schéma pendant quelques minutes — le temps du
`git push`. Sans utilisateur derrière, c'est sans conséquence ; avec, il faut pousser d'abord et
migrer ensuite, ou accepter une fenêtre d'erreur. §13.1 disait « les trois partent ensemble avec
le code » sans trancher lequel des deux part en premier.

### Fait — la wish list (9 septembre 2026)

Premier écran rendu bon marché par la séparation catalogue/suivi : **aucun champ ajouté**,
l'appartenance est une requête. Deux arbitrages posés avant de coder — **cinquième onglet** de la
barre du bas plutôt qu'une section repliée dans la Collection, parce qu'une wish list qu'il faut
scroller jusqu'en bas est une wish list qu'on oublie, et elle sert justement debout dans un
rayon ; et **la wish list avant** le branchement d'`/ajouter` sur `ParutionCatalogue`, en
assumant qu'elle reste vide en pratique.

| Fichier | Rôle |
|---|---|
| `lib/domain.ts` | `LigneWishList`, `WishList`, et `estEnWishList()` — la règle, écrite une fois |
| `lib/editions.ts` | `chargerWishList()`, plus `auMoinsUnTomePossede()` / `aucunTomePossede()` |
| `components/wishlist-row.tsx` | la ligne : couverture du tome 1, titre, `Nom · Éditeur`, `0 / Y` |
| `app/(tabs)/wishlist/` | `page.tsx` et `error.tsx` |
| `components/tab-bar.tsx` · `components/icons.tsx` | le cinquième onglet et son signet |

Pas de barre de progression sur la ligne : elle serait toujours vide. Et ces séries ne comptent
ni dans les compteurs d'en-tête de la Collection ni dans la valeur — comme les vendues, et pour
la même raison.

#### Le défaut trouvé en éprouvant, et il était de fond

`chargerManquants` et `chargerPlanning` ne filtraient que sur `suivie`. **Une entrée de wish list
remontait donc dans Manquants avec tous ses tomes** : mesuré à l'écran, l'édition passée en wish
list a fait monter Manquants de 116 à **117 tomes**, y apparaissant avec ses 2 tomes au lieu du 1
qui manquait avant. Le tableau de §13.1 disait « rien » pour les deux écrans ; le code disait le
contraire, et le tableau avait raison — **Manquants sert à combler les trous d'une édition qu'on
a, pas à acheter une série entière.** Mettre une série de 40 tomes en wish list y aurait ajouté
40 lignes.

Corrigé par une condition partagée, *au moins un tome possédé*, sur les deux écrans. Après :
**115 tomes · 15 éditions**, l'édition disparue de la liste de courses.

**`revaliderEdition` ne revalidait pas `/wishlist`** — même classe d'oubli que le Planning le
3 septembre. Ajouté là et dans `creerEdition`, puisque cocher un tome fait franchir la frontière.

#### Une ligne manquait au tableau de §13.1

Trouvée en cherchant pourquoi la wish list restait vide après avoir vidé `doubt` : cette édition
est `ABANDONNEE` donc `suivie=false`, et le cas **« 0 possédé, non suivie, non vendue »** n'était
décrit nulle part. Elle reste en **Collection à `0 / N`**, ce qui est cohérent avec « une série
reste en Collection tant qu'elle a des tomes possédés ou en a eu » : la wish list demande
`suivie`, c'est-à-dire une intention d'achat. Le tableau porte désormais cette cinquième ligne.

**La sonde n'a rien prouvé une fois de plus, mais dans l'autre sens** : l'écran vide était
*correct*, et j'ai d'abord soupçonné un cache. C'est la base qui a tranché — `doubt` est
`ABANDONNEE, suivie=false`.

#### Vérifié fonctionnellement, aller et retour

Sur le banc, jamais en production. Décocher tous les tomes d'une édition suivie
(`blackrock-shooter-the-game`, 1/2) : elle quitte la Collection — **1 153 tomes · 108 éditions ·
≥ 8 771,67 €** contre 1 155 · 109 · ≥ 8 787,61 € — apparaît en wish list à `0 / 2` avec la
mention « 1 série », et sort de Manquants. Recocher le tome 1 : tout revient, wish list vide,
Manquants à **116 tomes · 16 éditions**. Le banc est à sa base exacte : 1 155 possédés,
1 714 possessions, 84 suivies, et seules les 4 `VENDUE` à zéro tome.

### Fait — l'archive de catalogue complétée jusqu'à 2000 (9 septembre 2026)

Les 288 CSV de janvier 2000 à janvier 2024 n'étaient pas sur une autre machine : ils étaient
dans `~/Documents/planning_manga`, déjà datés et rangés en `planning_YYYY-MM.csv`. Les trois
dossiers voisins — `2000-2008`, `2008-2017`, `2017-2024`, 291 fichiers nommés
`PlanningManga_02-09-2026 (N).csv` — sont les **téléchargements bruts** du 2 septembre, dont
`planning_manga` est la version renommée. C'est celle-là qu'on importe ; les bruts ne servent à
rien d'autre qu'à refaire le renommage.

**`2000-09` manque bien**, comme la spec l'annonçait : le mois passe de `2000-08` à `2000-10`.
Et le trou de février → juillet 2024 subsiste, `planning_manga` s'arrêtant à `2024-01` quand le
lot déjà importé démarre à `2024-08`.

```
288 fichiers, 41941 lignes lues
41936 parutions retenues, 9515 series distinctes
couverture : 2000-01-01 -> 2024-01-31
40027 avec EAN livre (95.4%), 164 EAN non livre mis a null
4646 lignes sans Vol.N, 3657 titres desinverses, 2259 marqueurs detectes
5 doublons (titreBrut, date) ecartes
```

Le chiffre de 41 941 lignes anciennes que §12 annonçait tombe exactement juste.

**Manifeste relu avant d'appliquer**, comme la règle l'exige, et il est sain : les désinversions
restaurent correctement l'article français — `Journal de mon père (le)` → `Le Journal de mon
père` — les marqueurs séparent bien la série de son édition — `Dragon Ball - Deluxe` devient
série « Dragon Ball » + marqueur « Deluxe » — et **les 164 EAN écartés sont des magazines**,
Animeland portant un code de périodique identique sur des dizaines de numéros. Les 5 doublons
sont légitimes, même titre et même date.

**L'écriture est purement additive** : `apply-catalogue.ts` ne fait qu'un `createMany` avec
`skipDuplicates`, aucune suppression, donc les 8 296 lignes récentes ne risquaient rien.
Vérifié dans le code avant de lancer, et confirmé après : `41936 inserees, 0 deja presentes`.

**Table : 50 232 parutions, 11 315 séries distinctes, 48 222 avec EAN**, du 1er janvier 2000 au
31 décembre 2026.

#### Ce que ça débloque, mesuré avant et après

| | Avant | Après |
|---|---|---|
| Nos EAN de tomes résolus au catalogue | 158 / 1 491 — **10,6 %** | **1 491 / 1 491 — 100 %** |
| Éditions de la collection appariées | 44 / 113 | **90 / 113** |
| EAN mobilisables pour leurs tomes | 231 / 745 — **31 %** | **1 539 / 1 554 — 99 %** |
| Séries dont le tome 1 porte un EAN | — | **6 023** |

**100 % de nos ISBN se retrouvent au catalogue.** Le verrou du 31 août — « le vrai verrou n'est
pas la source, c'est l'ISBN » — est levé pour tout ce qu'on possède, et les 6 023 tomes 1
identifiés ouvrent le cas qui manquait : scanner le premier tome d'une série qu'on ne possède
pas. Les 23 éditions encore non appariées sont celles dont aucun tome ne porte d'ISBN en base,
donc sans EAN à apparier — ce n'est pas un défaut du catalogue.

**La conséquence sur le chantier `/ajouter` est directe** : la récolte des EAN d'une série ne
demande plus la recherche BnF par titre, mesurée le même jour à 95 % de notices avec code mais
handicapée par la confusion entre éditions. Le catalogue donne la même chose avec le nom FR, le
marqueur d'édition et l'éditeur déjà séparés.

### Établi — ce que l'ISBN donne vraiment (9 septembre 2026)

Trois hypothèses posées avant de refondre `/ajouter` : une fois l'ISBN en main, a-t-on le
nombre de tomes, les codes du reste de la série, et une couverture par tome ? Mesuré, pas
supposé. **Deux vraies, une fausse.**

#### Le nombre de tomes : oui

Par le catalogue, sur les 44 éditions appariées avant complétion de l'archive : `max(numero)`
est **23 fois exactement égal** à notre `tomesParus`, **21 fois au-dessus** — des tomes
annoncés — et **jamais en dessous**. Par la BnF en recherche par titre, le `max` du numéro
parsé égale notre compte dans **9 cas sur 12**.

**Les trois écarts sont tous des confusions d'édition, pas des erreurs de source.** BERSERK
rend 43 là où notre base dit 6, parce que la recherche par titre mélange l'édition simple et
la Prestige. GANTZ rend 37 contre 18 pour la même raison — et **c'est notre base qui a
raison** : le propriétaire possède la Perfect Edition, 18 tomes chez Delcourt/Tonkam, quand
l'édition simple en fait 37 chez Tonkam. J'avais conclu l'inverse ; correction faite le jour
même après vérification en base.

> **Défaut trouvé au passage, non corrigé.** Notre ligne GANTZ porte `tomesParus = 18`, juste
> pour la Perfect Edition, mais `nom = « Édition simple »` et `editeur = Tonkam`, qui sont ceux
> de l'édition à 37 tomes. Un mélange hérité du Sheet, qui ne portait pas de nom d'édition.
> **Le catalogue permet désormais d'auditer les 113 éditions** sur ce motif : celles dont le
> compte colle à un candidat mais dont le nom ou l'éditeur colle à un autre.

#### Les codes du reste de la série : oui, par les deux, et l'archive change tout

Avant la complétion de l'archive, le catalogue ne pouvait pas : **231 EAN mobilisables pour
745 tomes, 31 %**, brutalement corrélés à l'ancienneté — 100 % pour les séries nées après août
2024, **3 % pour D.Gray-man, 4 % pour Terraformars**. Après les 288 fichiers anciens :
**1 539 sur 1 554, soit 99 %**.

La BnF sait aussi le faire, par titre : **environ 95 % des notices portent un EAN ou un ISBN**
(39/40, 40/40, 37/40, 14/15, 16/17). **Ça révise §5**, qui affirmait « l'ISBN par tome reste
donc ouvert ». Son obstacle n'est pas le code mais **l'attribution à un numéro** : `200$h` rend
`Vol. 20` pour Beastars et `Friend`, `Black`, `Howling` pour Bleach — de **18 % à 98 %** de
numéros exploitables selon la série. Le catalogue n'a pas ce problème, ses numéros étant déjà
extraits, d'où le choix de le prendre comme source d'identité.

#### Une couverture par tome : oui, mais inutilisable

Le service BnF Couvertures répond **41 fois sur 59 EAN tirés au hasard, soit 69 %** — 36 % pour
les parutions des années 2000, 69 % pour les 2010, 86 % pour les 2020.

**Mais la seule taille disponible plafonne à 150 px de haut** : 95×150, 100×150, 105×150,
108×150 selon le format d'origine. `couverture=2`, `3`, `4`, `0`, l'endpoint par ARK et les
autres noms de paramètre rendent tous 400 ou 500. L'application a besoin de **256×360** : c'est
**2,4 fois trop petit**.

**Les « trois tailles » de §5 n'existent pas**, et l'ordre des sources de couvertures décidé le
31 août — BnF en premier — reposait donc sur une hypothèse jamais mesurée. À cette résolution
la BnF ne peut servir que de vignette de repli. **MangaDex reste nécessaire.**

Détail exploitable : un EAN sans couverture rend **500 déterministe**, avec
`IllegalArgumentException: id to load is required for loading`, jamais un 404 propre.

#### Ce que la BnF donne et qu'on n'utilisait pas : l'auteur

`700$a` + `700$b`, filtrés sur le code de fonction `070`, et `701` pour les co-auteurs. Vérifié
sur 6 ISBN, jamais vide : Beastars → Paru Itagaki, **Ajin → Tsuina Miura + Gamon Sakurai**,
Radiant → Tony Valente. Les `702` sont à écarter, ce sont les traducteurs, illustrateurs,
réalisateurs et compositeurs.

**Ça lève l'obstacle bloquant du 4 septembre** : `Serie.auteur` est `NOT NULL` et le CSV
manga-news ne porte pas d'auteur, ce qui interdisait de créer une série depuis le catalogue
seul. La BnF le fournit par ISBN, et le catalogue fournit l'ISBN.

**En revanche le titre BnF n'est pas fiable** : pour l'ISBN de Bleach tome 22, `200$a` rend
« Conquistadores », le sous-titre du tome. Chaque source sur ce qu'elle sait — le catalogue
pour l'identité, la BnF pour l'auteur et le prix.

#### La structure du catalogue, telle qu'elle sert l'algorithme

| Mesure | Valeur |
|---|---|
| Groupes `(serieNormalise, marqueurEdition)` | **12 619** pour 11 315 séries |
| Séries multi-édition | **863** |
| Groupes sans aucun numéro de tome | **5 361**, soit 42 % — one-shots, coffrets, artbooks |
| Groupes d'une seule ligne | **6 356** |
| Lignes de date future | **944** |
| Groupes dont `tomesParus` serait gonflé sans filtre de date | **722** |
| Groupes dont l'éditeur varie | **141** |
| Groupes dont le `serieTitre` varie | **57**, et les écarts sont cosmétiques (`Assassin'S` / `Assassin's`) |
| `pg_trgm` | disponible sur Neon, **pas installée** |

**Les magazines polluent, et aucune règle automatique ne les distingue.** Animeland compte 257
« tomes », et ses éditeurs — Anime Manga Presse, AM Media Network, Ynnis, Tokyo arena — ne
suffisent pas à les repérer puisque Glénat en publie aussi. Le nombre de tomes non plus :
Détective Conan en a 107. Décidé : on ne filtre pas, l'humain choisit dans une liste classée.

#### Une sonde a encore menti, et dans le sens le plus dangereux

Ma première lecture du XML BnF rendait `null` sur tous les champs, et j'ai commencé à écrire
que le parseur de `lib/bnf.ts` était cassé en production. **C'était ma transcription qui avait
perdu un antislash** — le motif compilé était `[sS]` au lieu de `[\s\S]`, donc il ne
franchissait pas les retours à la ligne. Le vrai module marche : `chercherParIsbn` rend titre,
éditeur, année, format et prix.

Septième manifestation du même piège, et la première où il allait produire un **faux rapport de
défaut** plutôt qu'un faux succès. La règle vaut dans les deux sens : **appeler le vrai module,
jamais une copie du code.** Constat utile obtenu en le faisant : `chercherPrixDefautCentimes`
rend 690 pour Beastars et **`null` pour Goodnight Punpun**, ce qui explique enfin pourquoi
c'est la seule série sans prix de la collection.

### Fait — l'audit des 113 éditions contre le catalogue (9 septembre 2026)

Déclenché par la découverte que notre ligne GANTZ porte le compte de la Perfect Edition et le
nom de l'édition simple. Question : combien de lignes ont ce défaut ? `npm run editions:audit`,
**lecture seule**, apparie chaque édition au catalogue **par les EAN de ses tomes** — jamais par
similarité de titre — puis compare nom, éditeur et `tomesParus` au groupe dominant.

```
113 editions auditees, 74 conformes au catalogue
39 portent au moins un ecart :
   23  aucun tome ne porte d'ISBN
    9  editeur
    7  tomesParus
```

**Zéro écart de nom d'édition.** Sur les 90 éditions appariables, « Édition simple » est le bon
nom partout. Le défaut GANTZ n'est donc pas répandu — mais voir la limite ci-dessous.

#### Les 9 écarts d'éditeur n'en sont pas

Les neuf sont **le même fait** : base « Bamboo Édition », catalogue « Doki Doki ». Interrogée
comme troisième source sur les ISBN des tomes 1, **la BnF confirme notre base** — « Bamboo éd. »
pour Servamp, « Bamboo édition » pour Mushoku Tensei et Talentless.

**Doki Doki est le label manga de Bamboo Édition.** Le catalogue manga-news nomme le label, la
BnF l'éditeur légal du dépôt. Rien à corriger, et **une règle de §4 corrigée dans la foulée** :
`/ajouter` prend l'éditeur de la **BnF par ISBN**, pas du catalogue, sinon les nouvelles séries
diraient « Doki Doki » quand les 113 anciennes, remplies par `publishers:fetch`, disent
« Bamboo Édition ».

#### Les 7 écarts de tomes parus se lisent par leur direction

| Édition | Base | Catalogue | Lecture |
|---|---|---|---|
| `marimashita-iruma-kun` | 34 | **35** paru, 37 annoncé | **le catalogue a raison** |
| `saga-of-tany-the-evil-youjo-senki` | 22 | **23** | **le catalogue a raison** |
| `fire-force` | **34** | 32 | notre base a raison |
| `mashle` | **18** | 17 | notre base a raison |
| `tsugumi-project` | **7** | 6 | notre base a raison |
| `ippo-s4-la-loi-du-ring` | **27** | 21 | notre base a raison |
| `pokemon-la-grande-aventure` | **6** | 3 | notre base a raison |

**La direction de l'écart dit quelle source croire, et c'est vérifiable.** Dans les cinq cas où
notre base est devant, **nos tomes excédentaires ne portent ni ISBN ni date de sortie**, et le
dernier tome que nous ayons *avec* ISBN correspond exactement au dernier que connaît le
catalogue — Fire Force s'arrête à 32 en décembre 2023 des deux côtés, Mashle à 17 en novembre
2023, Tsugumi à 6 en mai 2023. Leurs tomes suivants sont sortis **dans le trou de février à
juillet 2024**, celui que l'archive n'a pas. Le catalogue est incomplet, pas notre base.

Dans les deux cas où le catalogue est devant, ce sont **de vrais tomes que nous n'avons pas
encore** — et c'est le seul travail que cet audit produit : deux `tomesParus` à relever, plus
deux sorties annoncées à récupérer sur Iruma-kun.

#### La limite, et elle porte exactement sur le cas qui a motivé l'audit

**Les 23 éditions sans aucun ISBN sont invisibles à l'audit, et GANTZ est parmi elles.** Sa
ligne dit `tomesAvecIsbn: 0`, donc aucun candidat ne peut lui être opposé.

Ces 23 ne sont pas un échantillon au hasard : ce sont **les variantes d'édition et les
hors-séries** — `berserk-prestige-edition`, `dragon-ball-tome-units`,
`fullmetal-alchemist-edition-double`, `soul-eater-edition-double`, `hellsing-perfect-edition`,
plus une dizaine de one-shots et de suppléments, plus quelques séries anciennes
(`blame`, `neon-genesis-evangelion`, `goodnight-punpun`, `saint-seiya-the-lost-canvas`).

**C'est mécanique et il faut le retenir : les scripts qui remplissent les ISBN apparient par
titre, donc ils échouent précisément sur les variantes — et les variantes sont exactement ce
qu'un audit par ISBN ne peut pas juger.** L'angle mort de l'outil coïncide avec la zone de
risque. GANTZ reste donc à corriger à la main, et rien ne dit combien de ses 22 voisines
partagent son défaut.

### Fait — la resolution du catalogue et l'ecriture depuis un candidat (9 septembre 2026)

Deux tranches du chantier `/ajouter`, sans toucher aux ecrans. Le SQL et l'ecriture d'abord,
eprouves sur le banc ; l'interface viendra dessus.

| Fichier | Rôle |
|---|---|
| `prisma/migrations/…_recherche_catalogue/` | `CREATE EXTENSION pg_trgm` et l'index GIN trigramme sur `serieNormalise` |
| `lib/normalisation.ts` | la normalisation du script Python, reproduite en TypeScript |
| `lib/catalogue.ts` | `rechercherCandidats`, `candidatParEan`, `candidatParGroupe`, `tomesDuGroupe` |
| `lib/enrichissement.ts` | auteur, éditeur et prix par la BnF, sur les derniers EAN du groupe |
| `lib/bnf.ts` | `NoticeBnf` gagne `auteurs` — `700`/`701` filtrés sur le code de fonction `070` |
| `lib/creation.ts` | `creerDepuisCandidat`, et son noyau `creerDepuisCandidatPour` |

**La normalisation est verifiee, pas supposee** : identique à celle du Python sur **400 lignes
sur 400** du catalogue. Sans ça les requêtes ne seraient jamais tombées sur `serieNormalise`.

**Le noyau d'écriture est séparé du contexte de requête.** `creerDepuisCandidat` lit
l'utilisateur par les cookies ; `creerDepuisCandidatPour` prend son id en argument. Ce n'est pas
de l'abstraction gratuite : sans ça l'écriture n'était éprouvable que par l'interface, donc pas
avant qu'elle existe.

#### Ce que l'essai sur le banc a montré

**`gantz` rend ses deux vraies éditions** — simple à 37 tomes chez Tonkam, Perfect Edition à 18
chez Delcourt / Tonkam — ce qui est exactement ce qui manquait pour choisir. Créer la Perfect
Edition **l'attache à la série `gantz` existante** au lieu de fabriquer `gantz-2` : le défaut
ouvert de `creerSerieAvecEdition` est levé. Ses 18 tomes arrivent **tous avec ISBN et date**,
l'auteur vient de la BnF, et aucune possession n'est créée — la série atterrit donc en wish
list, conformément à §4.

`berserk`, `chainsaw-man` et l'EAN d'Ajin sont marqués « en collection » par appariement EAN, pas
par titre. De 94 à 304 ms par recherche.

#### Trois défauts trouvés en éprouvant, tous corrigés

- **La casse des marqueurs dédoublait les candidats.** « Chainsaw Man · Edition Limitée » à
  21 tomes et « Edition limitée » à 22 sortaient comme deux éditions distinctes. Le groupement
  se fait désormais sur le marqueur en minuscules, la forme affichée étant la plus récente, et
  les deux fusionnent à 22. C'est le défaut de casse que §12 avait relevé à l'import, vu ici
  par son effet.
- **Les one-shots perdaient leur EAN.** Un groupe sans aucun `Vol.N` reçoit `tomesParus = 1`,
  mais `tomesDuGroupe` ne rendait que les lignes numérotées : le tome créé n'avait ni ISBN ni
  date, alors que la ligne du catalogue en portait un. **Ça touchait 5 361 groupes, soit 42 %
  du catalogue.** Corrigé : sans ligne numérotée, la plus récente des lignes sans numéro
  devient le tome 1. Hideout passe de `0 avec ISBN` à `1 avec ISBN`, et la BnF rend alors
  auteur, éditeur et **prix 750**.
- **Le prix abandonnait au premier échec.** Un seul EAN était interrogé ; désormais jusqu'à
  `EAN_ESSAYES_POUR_ENRICHIR` (3), en partant du dernier tome paru, et on s'arrête dès que les
  trois champs sont remplis.

**Limite qui reste** : la Perfect Edition de Gantz n'a **pas de prix** même après trois ISBN —
ces notices ne portent pas de `010$d`. Le champ reste vide dans le formulaire, à saisir.

#### Une erreur de ma part, sur le banc, et ce qu'elle prouve

Mon script d'essai listait `hideout` parmi les éditions à annuler, alors que `hideout` **existait
déjà** en base et que l'essai n'avait créé que `hideout-2`. La série a donc été supprimée avec
elle : le banc est passé de 109 séries à 108. **Restauré par `db:backup -- --restore --reset`,
compteurs concordants**, et le second essai est reparti de 109 / 113 / 1 716 / 16 pour y revenir
exactement après annulation.

C'est précisément à ça que sert le banc, et c'est un argument de plus pour ne jamais éprouver
une écriture sur Neon : la même erreur en production aurait supprimé une série réelle et ses
possessions, récupérables seulement par une restauration complète.

**Le banc est désormais équipé** : les migrations y sont, `pg_trgm` y fonctionne — le Postgres
wasm de `prisma dev` la fournit —, et le catalogue y est chargé des 41 936 lignes anciennes.
Il n'est pas dans la sauvegarde, donc `catalogue:apply` est à rejouer après chaque
restauration.

### Fait — l'écran Rechercher (9 septembre 2026)

L'ajout ne passe plus par AniList. §4 décrivait la cible ; elle tourne.

| Fichier | Rôle |
|---|---|
| `components/search-series.tsx` | remplace `add-series.tsx` : recherche, candidats, confirmation |
| `lib/actions.ts` | `rechercherAuCatalogue`, `preparerCandidat`, `ajouterCandidat` |
| `components/tab-bar.tsx` | l'onglet devient « Rechercher », avec la loupe |

**La route reste `/ajouter`**, comme §4 le prévoit : la changer casserait les raccourcis de la
PWA installée pour rien. Seuls le libellé et le titre d'écran changent.

#### Ce que l'écran fait, vérifié à l'écran et en base

Une recherche sur `gantz` rend **la collection locale d'abord** — GANTZ · Édition simple · 2/18
— puis **onze candidats de catalogue, un par édition** : Édition simple à 37 tomes chez Tonkam,
**Perfect Édition à 18 tomes chez Delcourt / Tonkam**, le Coffret T1 à T3, puis Gantz E, G,
Osaka. C'est exactement ce qui manquait pour choisir son édition, et c'est le cas qui a motivé
la décision de §4.

`rechercherAuCatalogue` en **220 ms**, `preparerCandidat` en **357 ms** — la seconde interroge
la BnF, d'où l'écart.

**Le formulaire arrive rempli** : auteur *Hiroya Oku* et éditeur *Delcourt-Tonkam* venus de la
BnF, 18 tomes du catalogue, et **« Édition terminée » pré-cochée** par la règle des 24 mois.

**« Suivre » écrit et reste, « Ajouter » écrit et ouvre la grille.** Les deux vérifiés :

| | `gantz-perfect-edition` par « Suivre » | `megumi-tsugumi` par « Ajouter » |
|---|---|---|
| Série | **rattachée à `gantz` existante** | nouvelle série créée |
| Tomes | 18, **tous avec ISBN et date** | 4, tous avec ISBN |
| Auteur · éditeur | Hiroya Oku · Delcourt-Tonkam | Mitsuru Si · Taifu comics |
| Prix BnF | **aucun** — cette notice n'a pas de `010$d` | **935** |
| `editionTerminee` | true | true |
| Possessions | **0** | **0** |
| Après | reste sur la fiche, **1 série en wish list** | redirige vers `/tomes` |

**Le rattachement à la série existante est le point qui compte** : 109 séries avant, 109 après
la création de la Perfect Edition, et 114 éditions. Le défaut de la série fantôme `berserk-2`
est levé, et c'est le marqueur d'édition du catalogue qui le permet.

L'anti-doublon par EAN se voit aussi à l'écran : chercher `tsugumi` marque « Tsugumi Project ·
Déjà dans la collection » sur la ligne de catalogue, et laisse « Megumi & Tsugumi » sans
marque — deux séries différentes, correctement séparées.

#### Un défaut d'affichage corrigé, un défaut supposé qui n'existait pas

« 1 tomes parus » sur les coffrets et one-shots : un libellé singulier a été ajouté.

**J'ai cru trouver un recouvrement de la barre d'onglets sur les boutons du formulaire.**
`elementFromPoint` rendait bien le `NAV` à la place du bouton, et le `<nav>` est `sticky
bottom-0`. Mais après défilement jusqu'en bas, le bouton est à y 617-661 et la barre commence à
679 : **aucun recouvrement**, `elementFromPoint` rend le bouton. Le `sticky` reprend sa place
naturelle en fin de conteneur. Rien à corriger — la page avait simplement besoin d'être défilée.

#### Le piège d'automatisation, septième et huitième fois

Deux clics par coordonnées sur le bouton de soumission n'ont **rien déclenché** — aucun `POST`
dans le journal du serveur — alors que `elementFromPoint` rendait bien le bouton à ces
coordonnées et que le bouton n'était pas désactivé. Et l'action `type` du pilote a laissé le
champ de recherche **vide** au second essai, après avoir marché au premier.

La chaîne a donc été éprouvée par un clic DOM sur le bouton, puis **contrôlée en base** — ce qui
reste la seule preuve qui vaille. Ces deux échecs sont des limites de l'automatisation, pas de
l'application : le même geste depuis un vrai navigateur passe. **Mais il faut le dire plutôt
que de laisser croire que le clic réel a été fait.**

#### Ce qui reste du chantier

Le scanner lit encore l'ancien chemin : `resoudreIsbn` charge **toutes** les éditions pour
apparier un titre de notice BnF, et ne consulte pas `ParutionCatalogue`. C'est la dernière
requête qui charge toute la base, et le dernier morceau du circuit de §4.

`creerEdition` et `creerSerieAvecEdition` restent en place sans être atteignables depuis
l'interface : ils servent la saisie entièrement manuelle, rang 5 de la résolution de §4, qui
n'a pas encore d'écran.

### Fait — le scanner sur le catalogue (9 septembre 2026)

Dernier morceau du circuit de §4, et **dernière requête qui chargeait toute la base**.

`resoudreIsbn` suit désormais l'échelle de §4 : `Volume.isbn`, puis `Sortie.isbn`, puis
**`ParutionCatalogue` par EAN**, puis la BnF. Le rang 3 est neuf : il rend un `CandidatPrepare`
complet, donc le scanner sait ce qu'est un tome dont l'édition n'est pas encore en collection.

**Ce qui disparaît** : l'ancien rang final chargeait *toutes* les éditions
(`prisma.edition.findMany` sans `where`) pour comparer un titre de notice BnF normalisé à celui
de chaque série. §13.2 avait relevé cette requête ; à 11 315 séries de catalogue elle n'avait
plus de sens. La notice BnF sert maintenant à **relancer la recherche du catalogue sur son
titre**, ce qui réutilise du code déjà éprouvé au lieu d'un appariement maison.

#### Vérifié à l'écran, sur le banc

| EAN saisi | Rang atteint | Ce que la carte affiche | Temps |
|---|---|---|---|
| `9782820337825` | 1, `Volume.isbn` | « CHAINSAW MAN · tome 1 · Édition simple · Possédé · Ouvrir » | **26 ms** |
| `9782375061909` | 3, catalogue | « Megumi & Tsugumi · Édition simple · Taifu comics · 4 tomes parus · 4 avec ISBN » puis « Cette édition n'est pas dans votre collection » et « Chercher pour ajouter » | **272 ms** |

L'écart de temps dit exactement la bonne chose : un tome déjà connu ne coûte qu'une requête
locale, un tome inconnu paie le catalogue et la BnF.

Le banc est intact après les deux essais — 109 séries, 113 éditions, 1 716 tomes, 1 155
possédés — la résolution étant en lecture seule.

#### Comment la saisie a été pilotée, et pourquoi c'est dit

**L'action `type` du pilote a laissé le champ vide**, comme sur l'écran Rechercher une heure
plus tôt. Le contournement retenu n'est pas un événement fabriqué naïf — celui-là ne déclenche
pas `onChange`, le document en a la trace depuis août — mais le **setter natif de
`HTMLInputElement.prototype.value` suivi d'un événement `input` bouillonnant**, qui est la seule
façon de faire voir une saisie à React. Contrôlé sur place : `champ.value` a 13 caractères et
React a bien pris la valeur.

C'est un pilotage légitime, pas une sonde : ce qui prouve le résultat reste la carte affichée et
la trace serveur, pas le fait d'avoir tapé.

#### Ce que le scanner ne fait toujours pas

**Il ne crée rien.** Un tome dont l'édition est inconnue renvoie vers l'écran Rechercher au lieu
d'ouvrir la confirmation avec le candidat déjà résolu — l'utilisateur doit retaper le titre. §4
prévoit qu'un scan puisse créer l'édition **et marquer le tome scanné comme possédé**, ce qui
est le seul chemin qui fait entrer une série directement en Collection plutôt qu'en wish list.
C'est le prochain pas, et il demande de porter le candidat d'un écran à l'autre.

### Fait — les trois pistes de mise au point du scanner (9 septembre 2026), non vérifiées

Les trois pistes que §12 listait comme « non essayées » sont écrites. **Aucune n'est vérifiée**,
et c'est structurel : `BarcodeDetector` n'existe pas sur Chrome de bureau et ce poste n'a pas de
caméra utile. L'entrée est donc dans le journal pour dire ce qui a été *écrit*, pas ce qui a été
*prouvé* — contrairement à la règle habituelle, et c'est dit.

| Piste | Implémentation |
|---|---|
| Aperçu trop petit pour juger la netteté | hauteur fixe de 240 px remplacée par `aspect-[4/3]` pleine largeur, ~322 px à 430 |
| `facingMode: environment` attrape l'ultra grand-angle | sélecteur de caméra dès qu'il y en a plusieurs, choix mémorisé en `localStorage`, retour au `facingMode` si le `deviceId` exact échoue |
| Pas de zoom | `zoom: 2` appliqué si la piste déclare la capacité avec un maximum > 1 |

Deux corrections venues en écrivant :

- **Le tap sur l'aperçu réappliquait `continuous`**, alors qu'un tap-to-focus doit demander une
  mise au point ponctuelle. Il demande maintenant `single-shot` quand l'appareil le déclare, et
  retombe sur `continuous` sinon.
- **Le bouton surligné est la caméra réellement active**, lue dans `getSettings().deviceId`, et
  non celle demandée. Si le `deviceId` exact échoue et qu'on retombe sur `facingMode`, le
  surlignage dit la vérité. Au passage, ça évite de lire `localStorage` pendant le rendu.

**Ce qui est vérifié, et c'est peu** : sans caméra l'écran affiche « Le scan par la caméra n'est
disponible que sur Android », masque l'aperçu, ne rend aucun bouton de sélection et garde le
champ ISBN — la dégradation que §11 exige. Le champ manuel, lui, est éprouvé : il a servi à
valider les deux rangs de résolution le même jour.

**Si la netteté ne s'améliore pas sur téléphone**, la piste suivante n'est pas la mise au point
mais la lumière : un rayon de librairie est sombre, et `torch` est une contrainte largement
supportée sur Android. Elle n'est pas implémentée.

### Fait — l'enchaînement après un scan (9 septembre 2026)

Dernier geste du circuit de §4. Un tome scanné dont l'édition n'existe pas renvoyait vers
l'écran Rechercher **en perdant le candidat déjà résolu** : il fallait retaper le titre. Le
candidat voyage maintenant par l'URL.

`/ajouter?serie=<serieNormalise>&marqueur=<marqueurNormalise>&isbn=<ean>` — l'écran lit ces
paramètres, prépare le candidat et **ouvre la confirmation directement**. L'ISBN scanné descend
en champ caché, et `ajouterCandidat` coche le tome correspondant après création.

Ni le nom d'une série ni un EAN ne sont des données personnelles, donc l'URL est un véhicule
légitime — et elle a l'avantage de survivre à une navigation.

#### Vérifié bout en bout sur le banc

EAN `9782375061909` saisi au scanner : la carte rend « Megumi & Tsugumi · Édition simple ·
Taifu comics · 4 tomes parus · 4 avec ISBN » et propose **« Ajouter et cocher ce tome »**. Le
lien ouvre la confirmation, dont la mention devient « Le tome scanné sera coché : la série entre
directement dans la collection, pas en wish list ». « Ajouter » redirige vers
`/edition/megumi-tsugumi/tomes`, qui affiche **1 / 4 tomes**.

En base, et c'est là que ça compte :

```
t1 isbn=9782375061909 possede=true      <- le tome scanne
t2, t3, t4 : aucune ligne de possession <- lignes creuses
en wish list : 0 · en collection : 110
```

**Les trois autres tomes n'ont aucune ligne de `Possession`**, pas une ligne à `false` : c'est la
règle des lignes creuses de §2, et elle se vérifie ici pour la première fois sur une création
par scan. Et la série entre **directement en Collection** — la wish list reste à zéro — ce qui
est le seul chemin qui le fait, comme §4 le prescrit.

Banc restauré : 109 séries, 113 éditions, 1 716 tomes, 1 155 possédés.

#### Le chantier `/ajouter` est clos, sauf deux trous nommés

La **saisie entièrement manuelle** — rang 5 de la résolution — n'a pas d'écran :
`creerEdition` et `creerSerieAvecEdition` restent en place, inatteignables depuis l'interface.
Les garder est un choix : ils servent le cas où ni le catalogue ni la BnF ne connaissent le tome.

Et la recherche **ne connaît pas les abréviations** : « jjk » ne rend rien. Le catalogue n'a pas
d'alias, et c'est `Serie.alias` — déjà en base depuis la migration, renseigné sur 105 séries —
plus les alias appris de §13.3 qui rattraperont ça.

### Tranché — pas de saisie manuelle (9 septembre 2026)

Le rang 5 de la résolution de §4 — « saisie entièrement manuelle » — est **écarté**, et son code
**supprimé** plutôt que laissé en dormance : `creerEdition`, `creerSerieAvecEdition`,
`ChampsEdition`, `chercherPrix` et `chercherPrixDefautCentimes`, plus les cinq aides que cette
dernière était seule à utiliser.

**Le motif est celui que l'audit avait mis au jour.** Un formulaire vide fabrique des fiches sans
ISBN, sans date et sans couverture — c'est-à-dire exactement les 23 éditions que
`editions:audit` ne peut pas juger, et dont GANTZ montre le coût : compte juste, nom et éditeur
faux, invisibles à tout contrôle. Le catalogue rend cette porte inutile dans 99 % des cas
mesurés ; la garder aurait été garder le moyen de dégrader la base.

Conséquence assumée : **un tome que ni le catalogue ni la BnF ne connaissent ne s'ajoute pas.**
L'écran le dit et s'arrête. Si le cas se présente vraiment, la réponse n'est pas un formulaire
mais un trou d'archive à combler.

Disparaît au passage la recherche de prix **par titre**, celle qui rendait `null` pour
Goodnight Punpun. Le prix vient désormais de `010$d` **par ISBN**, ce qui est à la fois plus
juste et plus simple.

**Build de production vérifié** avant de pousser, puisque c'est lui qui aurait bloqué un test
sur téléphone : `next build` passe, les quatorze routes sont dynamiques, et `useSearchParams`
ne réclame pas de frontière `Suspense` — la page portant `force-dynamic`.

### Corrigé — l'ajout en un tap, et l'auteur des notices récentes (9 septembre 2026)

Deux défauts remontés du **premier essai sur téléphone**, sur « L'Atelier des sorciers · Édition
grimoire ». La caméra, elle, fonctionne : le tome 23 de Tanya a été scanné et coché — vérifié en
base, `possede=true`. Les trois pistes de mise au point sortent donc du non-vérifié.

#### L'auteur manquait sur l'édition récente

Mesuré sur les cinq EAN de l'Édition grimoire, et la cause est nette :

```
t5 9791043301438 -> notice presente, auteurs=[]        prix=1995
t4 9791043301421 -> notice presente, auteurs=[]        prix=1995
t3 9791043303005 -> AUCUNE NOTICE
t2 9791043300677 -> auteurs=["Kamome Shirahama"]       prix=1995
t1 9782811698874 -> auteurs=["Kamome Shirahama"]       prix=1995
```

**Le dépôt légal catalogue en plusieurs temps** : la notice existe avant que le lien d'auteur
y soit posé. `enrichirDepuisTomes` n'interrogeait que les **trois plus récents**, donc
précisément les notices incomplètes.

Corrigé par une distinction qui tient à la nature des champs : **le prix change d'un tome à
l'autre, l'auteur non.** On interroge donc les deux plus récents *et* les deux plus anciens, en
commençant par les récents ; le prix vient du premier qui en porte un, l'auteur de n'importe
lequel. Résultat mesuré : Grimoire rend « Kamome Shirahama » et **19,95 €**, l'édition simple de
la même série rend le même auteur et **7,70 €** — les deux prix sont justes, ce que l'ancienne
recherche par titre n'aurait pas su faire.

#### « Grimoire » n'est pas reconnu comme un marqueur d'édition

Trouvé en cherchant le premier défaut. `latelierdessorcierseditiongrimoire` est une **série à
part entière** au catalogue, et non une édition de `latelierdessorciers`, parce que
« grimoire » n'est pas dans la liste `MARQUEURS_EDITION` du script d'import. La liste connaît
coffret, collector, perfect, prestige, deluxe, artbook… mais pas celui-là.

**Ce n'est donc pas seulement un problème de casse**, comme le 9 septembre le supposait : la
liste est aussi incomplète. Le corriger demande d'ajouter le marqueur au Python puis
`catalogue:apply -- --recalculer`, qui réécrit les champs dérivés des 50 232 lignes sans
retélécharger un CSV. **Pas fait** : c'est une réécriture large de données de production, à
décider séparément.

#### Le formulaire de confirmation est supprimé

Le propriétaire l'a écarté après essai : *« c'est bien pour une appli manuelle, mais là on vise
de l'automatisme »*. **Un tap sur un résultat crée l'édition et ouvre sa page.**

La page d'édition était déjà la bonne destination : bouton `X / Y TOMES` vers la grille de
cochage, et « Modifier l'état » pour le statut, la parution et le suivi. Les deux gestes que le
formulaire prétendait anticiper y étaient déjà, au bon endroit.

Disparaissent avec lui : les deux boutons « Ajouter » / « Suivre », le passage du candidat par
l'URL, la lecture de `FormData`, et six libellés. `ajouterCandidatDirect` remplace
`ajouterCandidat` et prend trois arguments au lieu d'un formulaire.

**Vérifié sur le banc** : un tap sur « L'Atelier des sorciers · Édition simple » mène à
`/edition/l-atelier-des-sorciers`, qui affiche `0 / 12`, l'auteur **Kamome Shirahama**, le prix
**7,70 €** et le bouton de cochage. En base : 12 tomes créés, **12 avec ISBN**, aucune
possession, un `SuiviEdition` à `EN_COURS`, `creeeParId` renseigné. 110 séries, 114 éditions.

**Ce qu'on perd, et c'est assumé** : `nom` et `tomesParus` n'ont plus d'endroit où se corriger.
Le formulaire était le seul. Si le besoin se présente, ces deux champs iront à l'écran État — pas
à la création.

### Fait — l'archive de catalogue est complète (9 septembre 2026)

Les deux trous que §12 traînait depuis le 3 septembre sont comblés. Le propriétaire a
téléchargé les mois manquants ; neuf fichiers, dont sept utiles.

| Fichier | Mois | Lignes |
|---|---|---|
| `PlanningManga_09-09-2026.csv` | **septembre 2000** | **31** |
| `(1)` à `(6)` | **février → juillet 2024** | 303, 262, 285, 293, 293, 309 |
| `(7)`, `(8)` | août, septembre 2024 — déjà importés | 285, 318 |

**Les 31 lignes de septembre 2000 sont exactement le chiffre que §12 annonçait**, écrit le
2 septembre sans avoir le fichier. Et les deux mois de recouvrement ont été absorbés sans bruit :
`1 777 inserees, 602 deja presentes` — la clé `(titreBrut, date)` fait son travail.

**Piège évité, et il valait la peine** : le dossier Téléchargements contient une douzaine
d'exports clients en `.csv`. `import_catalogue.py` avale **tous** les `*.csv` d'un dossier ; le
pointer là aurait ingéré des données personnelles dans le catalogue. Les neuf fichiers de
planning ont donc été copiés dans un dossier propre d'abord. **Ne jamais pointer l'import sur un
dossier qu'on n'a pas trié.**

Deux fichiers ont d'abord échappé à ma détection de mois — février et août 2024 — parce que je
cherchais l'accent dans un flux d'octets. C'était ma sonde, pas les fichiers.

#### L'état de l'archive, et ce que ça change

| | Avant | Après |
|---|---|---|
| Parutions | 50 232 | **52 009** |
| Séries distinctes | 11 315 | **11 530** |
| Avec EAN | 48 222 | **49 956** |
| Couverture | deux trous | **2000-01 → 2026-12, 324 mois, aucun manquant** |
| Nos ISBN résolus | 1 491 / 1 491 | **1 493 / 1 493** |
| Écarts de `tomesParus` à l'audit | 5 | **2** |
| Éditions conformes | 74 / 113 | **79 / 113** |

**La prédiction du matin est vérifiée.** J'avais écrit que les cinq écarts restants venaient du
trou de février à juillet 2024, et que les tomes excédentaires de notre base n'avaient ni ISBN
ni date pour cette raison. Combler le trou a fait disparaître **exactement** les trois que
j'avais nommés : `fire-force` 34/32, `mashle` 18/17, `tsugumi-project` 7/6.

#### Les deux écarts qui restent ont une autre cause, et c'est la même que « Grimoire »

Ni l'un ni l'autre n'est un trou d'archive : ce sont des **découpages de séries** dans les
titres de manga-news.

- `pokemon-la-grande-aventure` : notre base dit 6, le groupe apparié dit 3. Mais le catalogue
  connaît **six séries distinctes** sous ce nom — « Kiosque » (12), « Noir et Blanc » (9),
  « Epée & Bouclier » (7), **« (Glénat) » (6)**, « Soleil et Lune » (6), et « La Grande
  Aventure » (3). Notre 6 correspond exactement au variant Glénat : c'est un appariement sur le
  mauvais groupe, pas une donnée fausse.
- `ippo-s4-la-loi-du-ring` : notre base dit 27, le catalogue 21 pour la saison 4 — et 21 aussi
  pour les saisons 3 et 5, 30 pour la 1, 36 pour la 6. **Indéterminé** : soit le Sheet a compté
  large, soit manga-news découpe les saisons autrement. Je ne tranche pas.

C'est la même racine que le cas « Grimoire » relevé le même jour : **le découpage série /
édition repose sur le titre**, et la liste des marqueurs est incomplète. Le report du
`--recalculer` est consigné en « Reste à faire ».

---

### Fait — MangaBaka remplace AniList, et les abréviations trouvent enfin

**10 septembre 2026.** AniList était coupée depuis la veille ; MangaBaka la remplace sur toute
la couche série, et son catalogue apporte au passage ce que « Reste à faire » désignait comme
l'entrée la plus rentable : les abréviations.

#### Ce que la sonde a établi, en ~45 requêtes

`https://api.mangabaka.org/v2/`, sans clé, **30 requêtes par minute sur la recherche et 180 sur
le reste**, uniquement sur les requêtes non cachées. 300 000+ séries, plus un dump nightly.
**C'est la première source, après la BnF, dont l'usage programmatique n'est pas en attente d'une
autorisation** — leur site demande explicitement qu'on passe par l'API plutôt que par le site.

Mesuré sur 25 séries de la collection interrogées par leur titre VF : **22 / 25 appariées**. Sa
recherche indexe les titres français et alternatifs — `L'Atelier des sorciers` et
`BLUE EYES SWORD` → *Hinowa ga CRUSH!* tombent juste, là où le seuil AniList mettait **0,000**.

**Et les abréviations sont dans la donnée**, pas à apprendre : Jujutsu Kaisen porte
`{"language":"ja-Latn","traits":["alternative"],"title":"JJK","note":"Short title"}`.

**Ce qu'elle ne donne pas : rien au niveau du tome.** Aucun ISBN — grep sur l'objet complet de
115 Ko : zéro —, aucune couverture ni date par tome, `search?q=<ean>` rend 0 résultat.
`final_volume` est le compte japonais et n'égale notre `tomesParus` VF que sur **11 / 22**.
L'éditeur VF n'est là que sur **2 / 22**. `ParutionCatalogue` + BnF restent donc le seul chemin
vers l'EAN, `tomesParus` et l'éditeur.

#### Les trois pièces livrées

| Pièce | Ce qu'elle fait |
|---|---|
| `Serie.aliasNormalises` + index GIN | la recherche locale faisait `alias: { has: requete }`, une égalité **sensible à la casse** qui ne pouvait pas rapprocher « jjk » de « JJK ». Elle interroge la forme normalisée |
| le rebond (`lib/rebond.ts`) | local et catalogue à zéro ⇒ MangaBaka traduit le terme, `ParutionCatalogue` est relancé sur les titres rendus. Délai propre de 3,5 s, pas les 8 s des autres appels : c'est dans le chemin d'une frappe |
| `AliasRecherche` | mémorise la traduction. La deuxième fois ne sort pas de la base |

`lib/anilist.ts` et ses deux scripts sont **supprimés**, pas mis en dormance. `data/anilist.json`
reste : c'est la trace de ses 26 recherches manuelles, reprises dans `fetch-mangabaka.ts`.
**`relations:fetch` ne fait plus aucun appel** — les liens sont déjà dans le manifeste MangaBaka,
il les dérive hors ligne.

#### La règle d'appariement : l'égalité exacte, et rien d'autre

`mangabaka:apply` **n'écrit que les appariements exacts** — un des titres MangaBaka, normalisé,
égal au terme cherché. C'est la seule règle d'appariement automatique que ce document n'ait pas
vue échouer, et le résultat est **107 exactes sur 107 appariements**, 110 séries interrogées.

Il a fallu deux corrections pour y arriver, et les deux disent la même chose : **l'étalon est le
terme cherché, pas le titre local.**

- Le premier passage comparait au titre VF. `red-eyes-sword-akame-ga-kill-zero` retenait alors la
  série mère, et `IPPO – S4 LA LOI DU RING` marquait 0,368 sur un candidat juste. Quand
  `RECHERCHES_MANUELLES` fournit le terme, c'est **lui** qui a été écrit à la main, donc lui qui
  fait foi.
- Trois entrées manuelles héritées d'AniList pointaient volontairement vers la **série mère**,
  faute de mieux à l'époque. Avec l'étalon corrigé, elles devenaient « exactes » et auraient
  écrit les alias et l'identifiant du parent sur l'enfant. Corrigées : `mushoku-tensei` → id 217,
  `mushoku-tensei-l-epee-d-iris` → id 9594 (et le Sheet écrit « Iris » là où l'édition dit
  « Eris »), `the-ancient-magus-bride-supplement-2` → id 101258, 断片集. **Aucun identifiant n'est
  plus partagé entre deux séries.**
- `pandora-heart-8-5` n'existe pas chez MangaBaka — seul un artbook « Odds and Ends » s'en
  approche, et ce n'est pas le même objet. Il rejoint `ABSENTES_DE_MANGABAKA` avec
  `les-legendaires-saga` et `my-hero-academia-ultra-archive`.

#### Trois défauts trouvés par la répétition sur le banc, dont deux invisibles autrement

Le banc a servi exactement à ce pour quoi il existe.

1. **Le poids le plus fort n'est pas `core`, c'est `defining`** — et ma règle de thèmes ne
   retenait que `core`, donc ignorait les 34 tags les plus caractéristiques de Jujutsu Kaisen
   pour en garder 29 moins pertinents. Corrigé par un rang de poids explicite.
2. **Le vocabulaire de genres de MangaBaka n'est pas celui d'AniList** : la première application
   a fait disparaître `Ecchi`, `Mecha`, `Sports` et `Hentai`. Perdre `Hentai` est un gain — il
   était faux sur Hellsing et Radiant. Perdre les trois autres était une régression, et les trois
   existent en tags (`Settings > Sci-Fi > Mecha`, `Themes > Sports`,
   `Sexual Content > Intensity > Ecchi`) : `TAGS_PROMUS_EN_GENRE` les remonte au rang de genre.
3. **La normalisation arrachait le dakuten japonais.** `ワンパンマン` devenait `ワンハンマン` :
   `NFKD` décompose パ en ハ + U+3099, et le filtre à diacritiques emportait la marque. U+3099
   n'est pas un accent latin. Corrigé en ne dépouillant que les marques qui suivent une lettre
   **latine**, puis en recomposant en NFC — sans quoi le dernier filtre, qui ne garde que lettres
   et chiffres, supprimait la marque devenue autonome.

Un quatrième contrôle, mené par acquit de conscience : `'x' = ANY(colonne)` **ne peut pas**
emprunter un index GIN, seul `colonne @> ARRAY['x']` le fait — vérifié plan à la main,
`enable_seqscan` coupé. Le `has` de Prisma compile bien en `@>`, donc l'index sert.

#### Vérifié à l'écran, puis en base

Sur la production, dans le navigateur, en tapant pour de vrai :

- **« OPM » ouvre sur ONE-PUNCH MAN**, section « Déjà dans la collection ».
- **« jjk » affiche « Trouvé sous "Jujutsu Kaisen" »** puis **sept éditions distinctes** du
  catalogue avec leur compte de tomes — simple 30, Prestige 30, Roman 2, Agenda, trois Coffrets
  Starter, toutes chez Ki-oon. C'est §4 appliqué : une ligne par édition, pas par série.
- La base porte ensuite la ligne `AliasRecherche` `jjk → Jujutsu Kaisen (id 6199)`, écrite par ce
  clic et par rien d'autre.

État après écriture : **107 / 110 identifiants**, **1 214 formes indexées** dont 86 japonaises,
**998 alias ajoutés**, **60 séries portant une abréviation**, **28 liens de séries** contre 18,
2 cibles remplies, 11 séries pourvues de thèmes. Les 99 thèmes français sont intacts — seules les
séries qui n'en avaient aucun en ont reçu.

#### Deux choses à savoir, écrites le jour même

**La licence est CC BY-NC-SA 4.0**, et c'est une **quatrième échéance externe** de §13.4 :
le `NC` interdit d'encaisser un euro avec cette source en place, le `SA` imposerait de
repartager à l'identique. L'attribution est en pied de `/ajouter`.

**`api.mangabaka.org` se ferme au poste professionnel après ~250 requêtes** — connexion fermée,
`curl` rend 000, pas un 429, alors que `mangabaka.org` et `catalogue.bnf.fr` répondent 200 dans
la même seconde. Ce n'est pas un plafond franchi : les cadences étaient à 24 et 120 contre 30 et
180 annoncées. `mangabaka:fetch` est donc **reprenable**, et il l'a fallu. `-- --recalculer`
rejoue les règles sur les identifiants déjà résolus sans consommer le quota de recherche.

---

### Fait — la passe de couvertures, et deux defauts payes au prix fort

**10 septembre 2026.** Passe sur les tomes ajoutes depuis, leurs series et le planning.
**1 676 → 1 708 couvertures de tomes** et **12 → 14 sorties**. Le chemin pour y arriver a coute
plus cher que le resultat, et c'est ce qui vaut d'etre ecrit.

#### D'abord la mesure, qui a change la source a employer

45 tomes et 4 sorties sans couverture, dont **38 et 4 portaient un ISBN**. §5 met la BnF en tete
depuis le 31 aout, donc sonde de la BnF par ISBN : **31 / 42, toutes a 97–108 × 150 px**, et
`couverture=1` est la seule valeur du parametre qui reponde — les « trois tailles » annoncees
n'existent pas. Open Library : **0 / 5**, ce qui confirme le 28 aout.

Et un constat structurel : **les 4 sorties annoncees ne peuvent pas avoir de couverture BnF**,
le depot legal n'ayant pas lieu avant parution. §5 n'a donc aucune source pour le planning.

Quatre niveaux de couverture existent en base et ils ne se valent pas. `Volume` et `Sortie` sont
affiches ; `Edition` l'est aussi mais **retombe sur la couverture du dernier tome possede**, donc
ses 0/114 ne font aucun trou visible ; et **`Serie.couvertureUrl` n'est lu par aucun ecran** — les
blocs « Autres editions » et « Series liees » prennent la couverture du tome 1. Le remplir depuis
MangaBaka, qui a de belles images, n'aurait rien change a l'ecran.

#### Le premier defaut : une idempotence fondee sur un dossier ignore par git

`fetch_covers.py` decidait qu'une couverture manquait **si le fichier local etait absent**.
`public/covers/` n'est pas dans le depot. Sur ce poste il etait vide : le script a entrepris de
retelecharger **les 1 680 couvertures**. J'ai coupe a **~1 287**.

Rien n'a ete publie — ces images existent deja dans R2 et le dossier est ignore — mais c'est
exactement la recuperation massive que §5 dit d'eviter avant reponse de MangaDex, et j'aurais du
verifier l'idempotence avant de lancer, pas apres. **Corrige** : le script consulte d'abord
`couvertureUrl` dans `data/backup.json`, puis son propre manifeste, et le fichier local en
dernier. Le piege general est note en « Pieges etablis » : un script qui deduit son etat d'un
dossier ignore repartira de zero sur un autre poste.

#### Le second : trois scripts s'executaient a l'import

`fetch_covers.py`, `fetch_publishers.py` et `generate_icons.py` appelaient `main()` sans garde
`if __name__ == "__main__"`. Mon script de verification importait `fetch_covers` pour reutiliser
ses fonctions : **la passe entiere s'est relancee**. Elle a fini l'acquisition, ce qui tombait
bien, mais ce n'etait pas la decision. La garde est posee sur les trois — celle de
`fetch_publishers.py` compte double, il interroge la BnF.

#### La regle de langue, tranchee par le proprietaire

Ma premiere sonde MangaDex **plafonnait a 100 resultats sans paginer**. Iruma-kun en a 216,
Youjo Senki 205 : j'ai lu une tranche arbitraire et conclu que seules des couvertures coreennes
et bresiliennes existaient. Le proprietaire a corrige — « il y a bien les tomes en jap » — et
pose la regle : **fr d'abord, `ja` sinon, jamais une autre langue.** C'etait deja
`LANGUES_PAR_PREFERENCE` dans `fetch_covers.py` ; seule ma sonde deviait.

Deux raisons de s'y tenir, vues a l'oeil :
- le **logo coreen** d'Iruma-kun occupe une bande large en bas de l'image, sans commune mesure
  avec le logo japonais d'origine ;
- la couverture de Youjo Senki t.23 etiquetee `pt-br` est **en espagnol**, avec le **logo Panini
  Manga incruste** et des marges d'habillage. Pas « la meme illustration avec un autre titre »,
  mais la maquette d'un autre editeur. **La metadonnee `locale` de MangaDex n'est pas fiable.**

Avec la regle : **6 couvertures, toutes japonaises**, de 722×1024 a 1800×2560 — blackrock t.2 et
t.3, iruma t.35, **iruma t.36 et t.37 qui sont des sorties**, tany t.23. Les trois series sans
identifiant MangaDex — `ippo-s4`, `les-legendaires-saga`, `grimoire` — n'ont rien, comme le
proprietaire l'avait anticipe pour Grimoire.

#### `sourceCouverture`, et l'inversion assumee de l'ordre des sources

Migration additive, sur `Volume` **et sur `Sortie`** — la seconde parce que `promouvoir()`
recopie la couverture de la sortie vers le tome. Repetee sur un banc neuf, **eprouvee par
ecriture reelle** avant d'aller sur Neon.

`null` veut dire **« indetermine, anterieur au champ »**, comme `Edition.creeeParId`. Les 1 680
images d'alors ne sont pas marquables : melange de MangaDex et de depots manuels, rien ne permet
de les departager apres coup, et les marquer en masse serait inventer une provenance.

`covers:bnf` complete MangaDex par ISBN : **28 obtenues** — ippo t.8–21, grimoire t.1/2/4/5,
legendaires t.2–8/10–12 — et `covers:upload` en tire `sourceCouverture = "bnf"`. Cout R2 du
passage : 30 operations Class A sur le million mensuel.

**L'ordre de §5 met la BnF en tete pour une raison juridique, pas de qualite.** Mesure faite,
elle rend moins de la moitie de la cote necessaire quand MangaDex en japonais rend 5 a 10 fois
mieux. L'usage retenu inverse donc l'ordre ecrit : MangaDex quand elle a la serie, la BnF en
complement, et `sourceCouverture` pour l'attribution ou le remplacement.

#### Verifie a l'ecran, et une inquietude qui tombe

J'avais annonce que les images a 150 px seraient « visiblement molles » dans la grille, planche
de comparaison a l'appui — a pleine opacite c'est vrai. **A l'ecran, ca ne se voit presque pas**,
et pour une raison de conception : ces couvertures ne tombent que sur des tomes **non possedes**,
que la grille affiche a **34 % d'opacite**. Verifie sur `les-legendaires-saga` et sur
`ippo-s4-la-loi-du-ring`, le cas que j'avais signale comme le plus genant parce qu'il melange
haute definition et BnF : les tomes 8 a 12 se lisent tres bien, et les 5, 6, 7 restent vides a
juste titre.

**Le cas a surveiller est l'inverse** : le jour ou un de ces tomes est coche, il passe en pleine
opacite et l'ecart saute aux yeux. `sourceCouverture = "bnf"` est ce qui permettra de le
retrouver.

Au passage, un symptome de l'avertissement de §12 sur `r2.dev` : les images nouvellement
deposees ont mis plusieurs secondes a apparaitre, cases vides a l'ecran entre-temps. L'URL est
bien limitee en debit et non mise en cache.

#### Ce qui reste, et ce n'est pas un probleme de source

13 tomes et 2 sorties. **7 des 13 n'ont aucun ISBN en base** — `ippo-s4` t.22–27 et
`les-legendaires-saga` t.9 —, donc rien a interroger : c'est le verrou que §5 annonce depuis le
31 aout. 6 ont un ISBN mais aucune notice illustree a la BnF ni identifiant MangaDex. Le chemin
le plus rentable est de **leur trouver un ISBN dans `ParutionCatalogue`**, pas de chercher une
source de plus.

---

### Corrige — la BnF ne plafonne pas a 150 px, et la documentation le disait

**10 septembre 2026, en fin de journee.** Le proprietaire a produit la documentation officielle du
service Couvertures. **Elle contredit deux entrees de ce journal et trois passages de
`CLAUDE.md`.** Mesure sur un meme ISBN :

| Requete | Resultat |
|---|---|
| `&couverture=1` seul | 106×150 · 6,9 Ko |
| `&couverture=1&taille=originale` | **600×853** · 618 Ko |
| `…&taille=originale&largeur=256&hauteur=360` | **253×360** · 32,6 Ko, redimensionnee cote serveur |

**La cause est nette et elle m'appartient : le nom du parametre a ete devine au lieu d'etre lu.**
L'entree du 2 septembre avait essaye `couverture=2`, `3`, `4`, `0` en supposant que ce chiffre
etait une taille, et en avait conclu que « les trois tailles de §5 n'existent pas ». Ce matin j'ai
refait le meme essai et tire la meme conclusion, en l'ecrivant cette fois dans `CLAUDE.md` comme
une mesure etablie. **Le chiffre apres `couverture` n'est pas une taille : c'est 1 pour la
premiere de couverture et 4 pour la quatrieme.** Le `4` rendait 500 parce que la notice testee
n'a pas de dos. Le parametre de taille s'appelle `taille`.

Deux mecanismes ont concouru. Le premier est d'avoir sonde plutot que cherche : cinq essais de
parametres ne valent pas une page de documentation, et la page existait. Le second est d'avoir
**herite d'une affirmation du depot et de l'avoir traitee comme acquise** — elle etait dans §5
depuis le 31 aout, elle sonnait juste, et ma sonde l'a « confirmee » parce qu'elle repetait la
meme erreur.

#### Ce que la documentation apporte d'autre, et qui etait deja utile

- **Le 500 signifie « aucune image sur la notice »**, explicitement, et ce n'est pas une
  indisponibilite du service. Le cache des echecs de `VignetteCatalogue` est donc bien fonde, et
  **verifie** : **0 / 15** des EAN sans miniature en ont une en taille d'origine. Les 283 echecs
  deja memorises restent valides, seules les images positives ont ete refaites.
- On peut savoir **a l'avance** si une notice porte une image : **zone 950 en Intermarc**,
  `950$b = C1`. Interrogeable par le SRU que `lib/bnf.ts` utilise deja.
- L'interrogation par **`EAN=`** existe a cote de `ISBN=` — c'est le nom de notre champ.
- **Licence ouverte de l'Etat**, avec obligation de mentionner **la provenance et la date de
  recuperation**. D'ou `couvertureRecupereeLe`, ajoutee dans la meme migration que
  `VignetteCatalogue`. Et elle **n'interdit pas l'usage commercial** : cette source ne pese pas
  sur §13.4, contrairement au `NC` de MangaBaka.

#### Ce que ca change

**La BnF devient la source principale et non un pis-aller** : edition francaise, bon tome,
appariement exact par EAN, cote de grille, licence permissive. Verifie a l'oeil sur Zettai Karen
Children t.1 — jaquette Kana francaise, 242×360, nette.

**La distinction « vignette 150 px pour la recherche / couverture 256×360 pour la grille » tombe.**
Une seule image sert les deux, et le chantier des vignettes de catalogue s'en trouve simplifie.

**Les 28 couvertures deposees a 150 px le matin ont ete refaites le meme jour**, en meme temps que
les series ajoutees entre-temps : **74 couvertures**, 24 a 33 Ko, toutes avec leur source et leur
date. La collection passe a **1 754 / 1 770**. `fetch_covers_bnf.py` gagne `--refaire`, qui reprend
ce qui est deja marque `bnf` — c'est ce qui a permis la reprise, et ce qui la permettra la
prochaine fois que la cote demandee changera.

**Volumetrie revue.** L'image passe de 7,4 a **22,3 Ko** mesures. Les 12 405 groupes de catalogue
font donc **~147 Mo** au lieu de 49, et le catalogue entier **~591 Mo** au lieu de 196 — soit
**1,5 % et 5,9 % des 10 Go de R2**. La conclusion ne bouge pas : ca tient largement.

**Rendement mesure, et il depend beaucoup de l'ordre.** 68 % sur les gros groupes (One Piece,
Detective Conan, Kingdom, Gintama, Bleach, Naruto), 53 % sur un tirage aleatoire de 90, mais
**20 a 29 % sur le debut alphabetique** — `#Cooking Karine`, `+Anima`, `100 Manga Artists` : le
tri par titre concentrait les artbooks et les essais. `fetch-vignettes.ts` trie donc par
**nombre de lignes du groupe decroissant**, pour qu'un passage plafonne serve d'abord ce qu'on
cherche vraiment.

#### Lacune corrigee au passage

`sourceCouverture` et `couvertureRecupereeLe` avaient ete ajoutees au schema **sans etre portees
dans `backup-db.ts`** : une restauration les aurait perdues silencieusement. Corrige, et la
sauvegarde les porte desormais sur les tomes comme sur les sorties.
