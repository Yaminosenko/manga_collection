# Manga Collection — spécification

Application personnelle de suivi de collection de mangas, mono-utilisateur.
Ce document est la source de vérité du projet. Le lire en entier au début de chaque session.

---

## 1. Le problème

Un Google Sheet suit la collection avec un compteur par série (`10 tomes possédés sur 12`).
Ce compteur ne dit pas **lesquels** sont possédés : il peut manquer les tomes 4 et 8, pas les 11 et 12.
L'application remplace le compteur par un suivi au tome physique.

Point de départ : 112 lignes, 108 séries, 112 éditions, 1640 tomes parus dont 1148 possédés.

---

## 2. Modèle de données

Quatre niveaux. Une ligne par tome physique — c'est ce qui résout le problème ci-dessus.

```
Serie      (id, slug, titre, titreVo, auteur, genres[], themes[], cible, couvertureUrl)
Edition    (id, serieId, slug, nom, editeur, tomesParus, editionTerminee,
            prixDefautCentimes, statut, termineeForcee, raisonCompletion, aVerifier,
            slugMangaNews, couvertureUrl, ajouteeLe)
Volume     (id, editionId, numero, isbn, dateSortie, prixCentimes, couvertureUrl)
Possession (id, volumeId, possede, dateAchat, prixPayeCentimes, etat, lu, note)
```

### Serie
Regroupe les éditions d'une même œuvre. Aucun écran ne l'affiche seule en V1 : elle sert
uniquement au bloc « Autres éditions » de la page édition.

Un suffixe de titre n'est une autre **édition** que s'il porte un marqueur explicite
(`Édition double`, `Perfect Edition`, `Édition Prestige`, `Tomes unitaires`).
Tout autre suffixe est une œuvre distincte : `MY HERO ACADEMIA - Smash` et
`MUSHOKU TENSEI – L'épée d'Iris` sont des séries à part entière, pas des éditions.

4 séries multi-éditions à l'import : Berserk, Dragon Ball, Fullmetal Alchemist, Soul Eater.

### Edition
**L'objet central de l'application.** Une édition = une ligne dans la Collection = une page.

- `tomesParus` — nombre de tomes **sortis en France**. Jamais le total japonais, jamais un
  total prévisionnel. C'est le dénominateur affiché partout.
- `editionTerminee` — booléen. `false` ⇒ hachuré « à paraître ». `null` = inconnu, traité
  comme `false`. Ne stocke **pas** combien de tomes restent : cette donnée n'est pas fiable.
- `prixDefaut` — prix courant du tome pour cette édition. Un `Volume.prix` renseigné l'écrase.
- `statut` — `EN_COURS` | `ABANDONNEE` | `EN_PAUSE` | `VENDUE`. C'est le rapport personnel à
  la série, pas l'état de publication.
- `termineeForcee` — `true` quand la collection est déclarée finie malgré des tomes manquants.
- `aVerifier` — `true` sur les éditions incomplètes issues de la migration, dont la répartition
  des tomes est devinée. Passe à `false` dès la première validation manuelle.

### Volume
Un tome de l'édition. Généré de 1 à `tomesParus`. Enrichi progressivement (ISBN, date, couverture).

### Possession
Le lien avec la collection réelle. En V1 seul `possede` est écrit ; les autres champs existent
et attendent la V2.

---

## 3. Règles métier

### Complétion
Calculée : `possédés == tomesParus`.
`termineeForcee = true` la force à vrai quel que soit le compte.
Une édition forcée **garde sa barre réelle** (11/13 reste affiché) et ses tomes manquants
**ne remontent pas** dans l'écran Manquants.

3 éditions forcées à l'import : AIR GEAR (32/37), JUDGE (5/6), NOZOKIANA (11/13).
Motif : tomes lus ailleurs, volontairement non rachetés.

### Barre de progression
Trois zones : possédés / sortis non possédés / à paraître.
La zone « à paraître » est un **symbole de largeur fixe**, pas une proportion — présente si et
seulement si `editionTerminee` est faux.

### Statut affiché
Le statut personnel prime sur l'état de publication dans le sous-titre.
Une série abandonnée affiche « Abandonné », pas « Édition en cours ».

### Vendues
Section repliée en bas de la Collection. Exclues du tri et des compteurs d'en-tête.
Pas de barre de progression : le libellé « Vendu » la remplace.
4 éditions à l'import, toutes à 0 tome possédé.

### Prix
**Tout prix est un entier de centimes.** Le flottant est écarté pour l'exactitude des sommes,
et `Decimal` parce qu'il ne traverse pas la frontière serveur/client de React.

`Edition.prixDefautCentimes` × nombre de tomes possédés, sauf pour les tomes ayant un
`Volume.prixCentimes`. Valeur totale de la collection = somme sur toutes les éditions non vendues.

---

## 4. Écrans V1

### Collection — écran principal
Liste des éditions. Une ligne par édition.

- Couverture du **dernier tome possédé**
- Titre, puis `Nom d'édition · Éditeur`
- `X / Y tomes · <état>` où Y = `tomesParus`
- Barre à trois zones
- Terminée : badge de complétion, pas de hachuré
- Abandonnée / en pause : icône dédiée + désaturation
- En-tête : compteurs globaux, recherche, menu de tri
- Tri : alphabétique, tomes possédés, % de complétion, ajout récent, à vérifier en premier.
  Sens inversable, choix mémorisé.
- Bas de liste : section « Vendues », repliée par défaut

### Édition — page de détail
Fusion des pages Série et Édition de la référence : un seul niveau, pas deux.
La page Édition **ne coche aucun tome** : elle donne à voir, la sélection se fait dans sa
sous-page.

1. En-tête : couverture, titre, `Nom d'édition · Éditeur`, badge « À vérifier » le cas échéant,
   `X / Y`, barre à trois zones
2. Bouton `X / Y TOMES` — pleine largeur, contour accent, libellé recalculé à chaque
   changement. **Seul accès à la sous-page « Mes tomes ».**
3. Carrousel horizontal des couvertures — **tomes possédés uniquement**, chargement paresseux,
   purement visuel, ne mène nulle part
4. Bloc « Autres éditions » — affiché seulement si la série en compte plusieurs
5. Pied : auteur, genres, statut, prix, lien sortant manga-news

### Mes tomes — sous-page de sélection
Le cœur de l'application : le geste que l'utilisateur répète des dizaines de fois.

**Grille de couvertures, 4 colonnes.** Une case par tome de 1 à `tomesParus`, couverture du
tome en fond, ratio 0,71.

| État | Traitement |
|---|---|
| Possédé | Contour accent, couverture pleine, pastille du numéro, coche en haut à droite |
| Manquant | Contour neutre, même couverture à 34 % d'opacité, pastille du numéro |
| À paraître | Contour pointillé, case vide, non cliquable |

- **Trois cases fantômes « à paraître »** si `editionTerminee` est faux. Un signal, pas une
  donnée : l'application ne sait pas combien de tomes restent.
- **Tap = coche ou décoche.** Un seul tap : pas de confirmation, pas de mode édition,
  enregistrement au fil de l'eau. Appui long réservé V2, sans effet en V1.
- Actions de masse `Tout` / `Aucun` — jamais les cases à paraître.
- Compteur `X / Y tomes` en tête, légende des trois états en pied.

Écartée : la grille de pastilles numérotées à 7 colonnes sans couverture. Elle reste la piste
de repli si la vue d'ensemble manque sur les séries longues — Berserk occupe 11 rangées à
4 colonnes — sous forme d'un second mode d'affichage basculable depuis l'en-tête.

### Manquants
Tous les tomes non possédés et déjà parus, groupés par édition.
Exclut les éditions vendues et les éditions à complétion forcée.

### Ajout de série
1. Recherche — résultats mêlant la collection locale (anti-doublon) et l'API externe
2. **Confirmation d'édition** — étape obligatoire. Les API ne connaissent pas les éditions
   françaises : nom, éditeur et nombre de tomes parus sont pré-remplis puis corrigés à la main.
   C'est ici qu'on crée une édition qui n'existe dans aucune base.
3. Génération des tomes, aucun possédé
4. Atterrissage sur la page édition

Scan de code-barres EAN-13 : après les quatre écrans ci-dessus.

---

## 5. Données externes

### Règle absolue
Les API externes sont appelées **à l'import et au rafraîchissement de fond**. Jamais à
l'ouverture d'un écran. Tout écran lit la base locale.

### Sources
| Source | Usage | État mesuré |
|---|---|---|
| AniList (GraphQL) | Métadonnées série, couverture série | 12/12 · sans clé, sans quota gênant |
| Google Books | Tomes VF par ISBN, date de parution, couverture tome | **bloqué sans clé d'API** |
| Open Library | Complément ISBN | répond, mais sans ISBN sur les recherches par titre |
| manga-news | Planning des sorties VF | **En attente d'autorisation** |

### Ce que la sonde du 28 août 2026 a établi (échantillon de 12 séries)

**AniList couvre le niveau série, et lui seul.** 12 correspondances sur 12, couverture et auteur
à chaque fois, y compris sur des titres VF éloignés du romaji — `BLUE EYES SWORD` → *Hinowa ga
Yuku!*, `LES CHRONIQUES D'AZFAREO` → *Azufareo no Sobayounin*.

**Son compte de volumes est japonais et ne remplace jamais `tomesParus`.** Sur 12 : 7 coïncident
avec le compte VF, 2 divergent — `ACT-AGE` annoncé 12 au Japon contre 2 parus en France — et 3
sont nuls, systématiquement sur les séries en cours. Même chose pour `status` : il décrit la
publication japonaise, pas l'édition française. Il ne pilote donc pas `editionTerminee`.

**Google Books exige une clé.** Sans clé, l'API répond 429 dès le premier appel : le quota
journalier du projet anonyme partagé est épuisé en permanence. Une clé Google Cloud est
gratuite, avec ~1 000 requêtes par jour — de quoi couvrir les 1640 tomes en deux passes.
Sans elle, aucun ISBN, aucune date VF, aucune couverture de tome.

Nautiljon interdit explicitement la récupération de ses données. Aucune utilisation.

manga-news n'a pas d'API. Une demande d'autorisation doit être envoyée avant toute
utilisation programmatique. En attendant, `slugMangaNews` ne sert qu'à construire un
lien sortant vers la fiche officielle.

### Images
Téléchargées une fois, redimensionnées **à l'import sur le poste local**, déposées dans
Vercel Blob et servies telles quelles.
**Jamais de référence directe à une URL d'API externe** — elles expirent.
**Jamais l'optimiseur d'images de Next.js** — le plan Hobby le plafonne à 1 000 images
sources par mois et renvoie une erreur 402 au-delà.

**Une seule taille : 256×360 en WebP, ~18 Ko.** Elle couvre toutes les cotes du design à
densité 3 : liste 156×222, carrousel 198×282, en-tête d'édition 222×312, grille 252×354.
Le format 400×570 ne sert qu'à la fiche tome plein écran, qui est en V2.

**1640 couvertures**, pas 1148 : la grille de sélection affiche aussi les 492 tomes manquants,
avec la même couverture à 34 % d'opacité. Volumétrie : **~30 Mo**, soit 3 % du Go offert.

Chargement : paresseux sur chaque image, seul ce qui entre dans le viewport est demandé.
Une couverture ne change jamais — cache immuable d'un an, un deuxième passage sur une
édition coûte zéro octet.

Une couverture absente n'est jamais bloquante : placeholder avec le numéro de tome,
et possibilité d'uploader une photo manuellement. Google Books ne couvrant que 50 à 70 %
des tomes VF, un tiers de placeholders au départ est le cas nominal, pas une panne.

### Rafraîchissement
Tâche de fond hebdomadaire : nouveaux tomes parus, mise à jour de `editionTerminee`,
récupération des couvertures manquantes. Jamais déclenchée par la navigation.

---

## 6. Mode hors ligne

Consultation seule.

- Les données texte (~300 Ko) sont mises en cache et restent consultables sans réseau
- Les images **ne sont pas** mises en cache volontairement (~60 Mo), hors cache navigateur naturel
- Aucune écriture hors ligne : pas de cochage, pas d'ajout, pas de modification
- Bandeau « Hors ligne · consultation seule » en haut d'écran
- Pastilles visuellement inertes — elles ne doivent pas sembler cassées

Synchronisation bidirectionnelle : hors périmètre, V2 au plus tôt.

---

## 7. Stack

**Arrêtée.** Contrainte fondatrice : **coût zéro, sans carte bancaire**, et aucune machine
allumée en permanence. Tout ce qui suit découle de là.

| Rôle | Choix | Plan |
|---|---|---|
| Application | Next.js (App Router), React, TypeScript | — |
| ORM | Prisma | — |
| Base | PostgreSQL sur Neon | Free — 0,5 Go, 100 CU-h/mois, veille après 5 min |
| Hébergement | Vercel | Hobby — usage personnel, sans carte, non facturable |
| Couvertures | Vercel Blob | Hobby — 1 Go inclus, ~30 Mo nécessaires |
| Accès privé | Vercel Authentication, portée **All Deployments** | inclus sur Hobby |
| Mobile | PWA installable | — |

Alternative écartée : FastAPI + React séparés. Deux déploiements, une couche API à écrire et
à maintenir, aucun hébergeur gratuit crédible pour la partie Python sans mise en veille longue.

Le script d'import est en Python et **ne dépend d'aucun de ces choix** : il produit un JSON
neutre. Changer de stack ne le remet pas en cause.

### Conséquences du gratuit, à ne pas découvrir plus tard

- **Pas de système de fichiers persistant.** §5 dit « stockées et servies par le serveur » :
  en pratique, servies depuis Vercel Blob. Aucune écriture disque ne survit.
- **La base s'endort au bout de 5 minutes d'inactivité.** Premier écran après une pause :
  ~1 s de réveil. Prévoir un état de chargement, jamais un écran figé.
- **Le déploiement est public par défaut.** Sans Vercel Authentication en portée
  `All Deployments`, l'URL suffit à lire la collection. À activer avant le premier déploiement
  contenant des données réelles.
- **Pas de sauvegarde longue durée sur le plan gratuit.** Un export JSON régulier de la base,
  versionné dans le dépôt, est le seul filet. `data/collection.json` en est le point zéro.
- **Le remplissage initial des 1640 couvertures se lance depuis le poste local**, pas depuis
  une fonction serverless : redimensionnement et écriture vers Blob en masse, hors de toute
  limite de durée d'exécution.
- **Les crons Hobby sont peu nombreux et à déclenchement quotidien.** Le rafraîchissement
  hebdomadaire (§5) s'implémente comme une tâche quotidienne qui ne fait rien six jours sur sept.
- **Fonction et base dans la même région : Francfort.** Neon en `eu-central-1`, Vercel en
  `fra1`. Vercel place les fonctions à Washington (`iad1`) par défaut : laissé tel quel, chaque
  requête traverserait l'Atlantique — ~90 ms aller-retour, plusieurs fois par page, en plus du
  réveil de la base. À régler avant le premier déploiement.
- **Deux chaînes de connexion.** L'application utilise la chaîne poolée (hôte `-pooler`) :
  en serverless chaque invocation ouvre sa connexion, sans pooler la base sature. Les
  migrations utilisent la chaîne directe, `DIRECT_URL`.
- **Le port 5432 est bloqué par le réseau du poste de développement**, le 443 passe. Toute la
  communication avec Neon passe donc par le driver `@neondatabase/serverless` en WebSocket.
  Conséquence sur les migrations : le moteur Prisma ne sait pas emprunter l'adaptateur pour
  le DDL, il exige un accès direct. Le circuit est donc en deux temps —
  `npx prisma dev` lève un Postgres local le temps d'écrire la migration avec
  `prisma migrate dev --config prisma7.local.config.ts`, puis `npm run db:migrate`
  (`scripts/apply-migrations.ts`) l'applique à Neon sur le 443 en tenant la table
  `_prisma_migrations` exactement comme Prisma l'attend. Vercel emprunte le même script.

Contraintes transverses :
- Mobile d'abord. Cible tactile minimale 44 px.
- **Dépôt public, assumé.** `data/export.csv` et `data/collection.json` exposent donc les prix
  payés et la valeur de la collection. Décision prise en connaissance de cause. La conséquence
  à tenir est ailleurs : aucun secret ne doit jamais entrer dans le dépôt — jetons Neon et Blob
  dans `.env`, jamais dans un fichier suivi, jamais dans un commit.
- **Mode sombre uniquement en V1.** Nocturne ne fournit aucune rampe claire : la dériver est
  un travail de design à part entière, reporté. Les tokens sont posés en variables CSS, aucun
  composant ne code une couleur — ajouter le mode clair reviendra à redéfinir les variables.
- **Palette arrêtée : Nocturne.** Les tokens vivent dans `app/globals.css`, consommés via les
  classes Tailwind qu'ils génèrent.

### Références visuelles — `design/`

Le dossier `design/` contient les maquettes HTML et le design system dont elles sont tirées.
**Le lire avant de coder un écran.**

- `design/design_handoff_page_edition/README.md` — **le document de référence**. Décrit écran
  par écran la Collection, la page Édition et la sous-page « Mes tomes » : structure, cotes,
  états, interactions. Fait foi sur le rendu.
- `design/design_handoff_page_edition/Grille de pastilles.dc.html` — le prototype, ouvrable
  dans un navigateur, interactif. Malgré son nom, la direction retenue y est la **grille de
  couvertures à 4 colonnes** ; les autres options du fichier sont la trace des arbitrages et
  ne s'implémentent pas.
- `design/design_handoff_page_edition/nocturne/` — les tokens et composants du design system.
  Lire `readme.md` avant d'écrire du style ; toute couleur, espacement et rayon vient de
  `styles.css` via `var(--*)`.
- `design/README.md` — index du dossier et journal de ce qui est repris ou écarté de
  l'application de référence.

**Ces fichiers sont une référence visuelle, pas du code à reprendre.**

Ce qu'on en tire :
- proportions, espacements, hiérarchie typographique
- palette, contrastes, traitement des états (possédé / manquant / à paraître)
- densité de la grille, taille des cibles tactiles
- ce que l'écran donne à voir en premier

Ce qu'on n'en tire pas :
- le balisage HTML, les classes, la structure du DOM
- les styles en dur, les valeurs magiques, les couleurs codées en clair
- l'organisation des fichiers

Le code applicatif est écrit à partir de zéro selon les conventions de la section 11 :
composants React, Tailwind, tokens de couleur nommés, mode sombre géré par variables.
Reproduire le rendu, pas le fichier.

Les captures issues de l'application de référence documentent des **comportements**
(anatomie d'une ligne, barre à trois zones), jamais une direction artistique à imiter.

---

## 8. Migration

`scripts/import_sheet.py` convertit l'export CSV du Google Sheet en `data/collection.json`.

```bash
python scripts/import_sheet.py data/export.csv data/collection.json
```

Résultat attendu :

```
Lignes lues            : 112
Series                 : 108
Editions               : 112
Tomes possedes         : 1148
Editions a verifier    : 37
Completions forcees    : 3
Series multi-editions  : 4
```

### Hypothèse assumée
Le Sheet ne dit pas **quels** tomes sont possédés. Le script attribue les N premiers.
C'est faux partout où il y a un trou — d'où le drapeau `aVerifier` sur les 37 éditions
incomplètes. Les 75 autres sont complètes, donc exactes.

Sans ce drapeau, impossible de distinguer plus tard le vérifié du deviné, et l'écran
Manquants ferait acheter des doublons.

### Normalisations appliquées
- Statuts : espaces de fin supprimés (`EN COURS ` et `EN COURS` étaient deux valeurs distinctes)
- `FINI` → `statut = EN_COURS` + complétion calculée. Si l'édition est incomplète,
  `termineeForcee = true`. Le statut du Sheet mélangeait rapport personnel et complétion.
- Nombres : virgule décimale française convertie
- `LIEN NAUTILJON` : ignorée. L'export CSV ne conserve pas les hyperliens, la colonne ne
  contient que le titre répété.
- `GENRE / TAGS`, `THEME`, `CIBLES` : conservées, découpées en listes.
  Répartition des cibles : 83 shōnen, 21 seinen, 7 ecchi, 1 shōjo.

---

## 9. Hors périmètre V1

Décidé, à ne pas réintroduire sans arbitrage :

- Page de détail d'un tome (résumé, prix marchand, boutons d'achat)
- Écriture hors ligne et synchronisation
- Suivi de lecture — le champ `Possession.lu` existe mais n'est pas exposé
- Écran « Sorties à venir » — dépend de l'autorisation manga-news
- Scan de code-barres — après les quatre écrans de base
- Statistiques détaillées
- Multi-utilisateur, partage, fonctions sociales

---

## 10. Ordre de construction

1. Schéma + seed depuis `collection.json` — donne 1148 tomes en base pour concevoir sur du réel
2. Page Édition + sous-page « Mes tomes » (grille de couvertures) — le cœur, l'écran le plus difficile
3. Collection — la liste, la recherche, le tri
4. Manquants
5. Ajout de série via API

Chaque étape est utilisable seule. Après l'étape 2, l'application est déjà supérieure au Sheet.

---

## 11. Conventions

- Interface et **modèle métier** en français — `tomesParus`, `possede`, `aVerifier` : c'est la
  langue du domaine, et celle de `collection.json`. Tout le reste du code est en anglais :
  noms de fichiers, fonctions techniques, scripts d'infrastructure
- Aucun commentaire dans le code : les noms portent l'intention
- Pas de valeurs magiques : les seuils et libellés sont des constantes nommées
- Tout écran affichant des données prévoit ses états : chargement, vide, erreur, hors ligne
- Une couverture manquante, une API muette ou une donnée absente ne cassent jamais un écran
- Les maquettes de `design/` se regardent, ne se copient pas : le code est réécrit proprement
- Aucune couleur en dur dans un composant — tokens nommés, pour que les deux modes suivent

---

## 12. État d'avancement

Dernière mise à jour : 28 août 2026.

Ce document est la mémoire du projet. Il est versionné : une session ouverte sur un autre
poste le retrouve intact. Rien d'utile ne doit vivre ailleurs.

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
| `components/volume-grid.tsx` | la grille 4 colonnes, client, `useOptimistic` |
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

**À trancher — `aVerifier` est trop facile à effacer.** Un seul tap dans la grille suffit, et
il n'y a aucun retour visible. Au cours des tests, le drapeau d'AIR GEAR est passé à faux sans
que l'action responsable ait pu être identifiée — c'est précisément le problème : sur 37
éditions marquées, une interaction accidentelle détruit silencieusement l'information, et
rien ne permet de s'en apercevoir. Pistes : ne l'effacer que sur `Tout` / `Aucun`, ou le
laisser à un geste explicite.

**À trancher — pas de largeur maximale.** Sur un écran large, la grille de « Mes tomes »
étale quatre cases de près de 400 px. Le design est coté pour 390 px. Un conteneur centré
à ~430 px réglerait l'affichage bureau sans toucher au mobile.

**À trancher — les genres d'AniList sont en anglais.** Une série ajoutée affiche
« Action · Adventure · Drama » quand la collection importée porte « Aventure · Fantastique ·
Horreur ».

**Non testé** : le rendu sur un vrai téléphone. `resize_window` n'a pas eu d'effet sur ce
poste, tous les tests se sont faits à 1920 px. La vérification tactile passe par l'URL réseau
qu'affiche `npm run dev`, ouverte depuis le mobile sur le même Wi-Fi.

### Reste à faire

- **Ajouter une seconde édition à une série existante** n'est pas couvert : les résultats
  locaux mènent à la fiche existante. §4 ne décrit que la création d'une série neuve, mais
  4 séries de la collection sont multi-éditions — le cas se posera.
- **Couvertures** : les 1640 restent à remplir depuis le poste local (§5). C'est ce qui
  sépare aujourd'hui les écrans réels des maquettes.
- **Premier déploiement Vercel**, jamais fait. Vercel Authentication en portée
  `All Deployments` à activer avant toute donnée réelle en ligne.
- **PWA** : ni manifeste ni service worker. Le mode hors ligne de §6 se limite pour l'instant
  au bandeau et à l'inertie des pastilles ; rien n'est mis en cache.

### Reprendre sur un poste neuf

1. `git clone` puis `npm install` — le client Prisma se régénère tout seul.
2. Créer `.env` sur le modèle de `.env.example`, avec les deux chaînes reprises du tableau de
   bord Neon (**Connect**, interrupteur *Connection pooling* pour l'une, sans pour l'autre).
   Les secrets ne sont pas dans le dépôt et n'y seront jamais.
3. `npm run dev`. **Ne pas relancer le seed** : la base Neon est déjà remplie, elle est la
   source de vérité, pas `data/collection.json`.

Le blocage du port 5432 décrit en §7 est propre au poste professionnel. Sur un réseau ordinaire,
`prisma migrate dev` attaque Neon directement et le détour par `npx prisma dev` devient inutile —
`npm run db:migrate` reste valable partout.

### Décisions encore ouvertes

- **Clé d'API Google Books** : à créer, et à vérifier qu'elle ne réclame pas de carte. Sans elle,
  aucune couverture de tome ni ISBN (§5). L'étape 5 ne l'a pas exigée — elle ne sert qu'au
  niveau tome, donc au remplissage des couvertures et au rafraîchissement de fond.
- **Premier déploiement Vercel** : jamais fait. Variables `DATABASE_URL` et `DIRECT_URL` à
  déclarer, Vercel Authentication à activer avant toute donnée réelle en ligne.
- **Contradiction dans le handoff** : l'option retenue y est nommée `2b` en tête et `1b` en pied.
  Cosmétique, la description est la même.
- **`Edition.editeur` et `Edition.slugMangaNews` sont nuls sur les 112 éditions.** Le Sheet ne
  les portait pas. Le sous-titre tombe donc sur le seul nom d'édition et le lien manga-news ne
  s'affiche jamais. À remplir automatiquement depuis les API externes (§5), pas à la main.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
