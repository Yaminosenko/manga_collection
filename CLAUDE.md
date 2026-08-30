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
**Deux axes indépendants, et il faut les deux.** « J'ai tous les tomes parus » n'est pas
« la série est finie » :

| Condition | Libellé |
|---|---|
| `possédés == tomesParus` et `editionTerminee` vrai | **Complète** |
| `possédés == tomesParus`, édition non terminée ou inconnue | **À jour** |

`termineeForcee = true` force « Terminée par choix » quel que soit le compte.
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

**Grille de couvertures, 2 colonnes.** Une case par tome de 1 à `tomesParus`, couverture du
tome en fond, ratio 0,71. Le handoff en prescrivait 4 ; le test sur téléphone du 29 août 2026
a tranché pour 2 — voir §12.

| État | Traitement |
|---|---|
| Possédé | Contour accent, couverture pleine, pastille du numéro, coche en haut à droite |
| Manquant | Contour neutre, même couverture à 34 % d'opacité, pastille du numéro |
| À paraître | Contour pointillé, case vide, non cliquable |

- **Trois cases « à paraître »** si `editionTerminee` est faux. Celles dont la sortie est
  annoncée portent leur **numéro et leur mois** ; les autres restent un signal anonyme. Le
  compte de trois est un plafond, pas un ajout : deux annonces laissent une case générique.
- **Tap = coche ou décoche.** Un seul tap : pas de confirmation, pas de mode édition,
  enregistrement au fil de l'eau. Appui long réservé V2, sans effet en V1.
- Actions de masse `Tout` / `Aucun` — jamais les cases à paraître.
- Compteur `X / Y tomes` en tête, légende des trois états en pied.

Écartée : la grille de pastilles numérotées à 7 colonnes sans couverture. Elle reste la piste
de repli si la vue d'ensemble manque sur les séries longues — à 2 colonnes, Berserk occupe
21 rangées et Bleach 37 — sous forme d'un second mode d'affichage basculable depuis l'en-tête.

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
| AniList (GraphQL) | Métadonnées série, couverture série, pont vers les titres romaji | 12/12 · sans clé, sans quota gênant |
| MangaDex | Couvertures de tome | **93 % en `ja` · en attente d'autorisation** |
| BnF (SRU) | Éditeur, ISBN, date de parution VF | **éditeur : 100/112 · sans clé** |
| Google Books | Tomes VF par ISBN, date de parution, couverture tome | **bloqué sans clé d'API, couverture jamais mesurée** |
| Open Library | Complément ISBN, couverture par ISBN | 0/11 sur des ISBN français |
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

### Ce que la sonde du 29 août 2026 a établi

**MangaDex couvre les tomes, mais en japonais.** Mesuré sur 30 éditions tirées au hasard, en
vérifiant la présence de chaque tome de 1 à N : **359 tomes sur 384, soit 93 %**, et sans trou
en milieu de série — c'est 100 % ou 0 % par série. Le français, lui, ne donne que **8 %** :
les couvertures y sont déposées par la communauté, langue par langue, et suivent l'activité
de scantrad, pas la publication. Naruto et Bleach n'ont que leur jeu japonais canonique.

**L'illustration japonaise est la même que la française, seul le logo-titre change.** Vérifié
côte à côte sur les trois séries qui ont les deux jeux. Le rendu est accepté (29 août 2026),
y compris sur les titres entièrement en katakana comme Chainsaw Man.

**Le pont passe par AniList.** Le titre VF est souvent introuvable tel quel ; AniList donne le
romaji, MangaDex répond dessus. 11 correspondances sur 12 sur l'échantillon d'août.

**La politique est `fr` d'abord, `ja` en repli.** Radiant l'impose : série française, 19
couvertures `fr` contre 4 `ja`.

**Poids réel mesuré : 23,3 Ko par couverture** en WebP 256×360, soit ~38 Mo pour 1 640 tomes.
L'estimation de ~18 Ko était basse ; l'ordre de grandeur tient.

**Les CGU de MangaDex interdisent la récupération systématique** pour constituer une base,
sans autorisation écrite, alors que la documentation de l'API décrit une API publique ouverte
aux clients tiers et impose de recopier les images plutôt que de les lier. La contradiction est
dans leurs textes, pas dans notre lecture. **Une demande d'autorisation est rédigée, à envoyer
à `admin@mangadex.org`** — même posture que manga-news. Rien de massif n'est téléchargé avant
réponse ; seul l'essai visuel de 75 couvertures a été fait, au titre de l'usage personnel.

**MangaDex est instable comme source** : ~7 000 titres et ~25 % des chapitres retirés sur
notifications DMCA en mai 2025. Une couverture disponible aujourd'hui peut disparaître. La
recopie dans Blob nous en rend indépendants une fois faite.

**BnF donne l'éditeur, pas les couvertures.** Le dépôt légal rend le catalogue exhaustif sur le
VF. Une notice porte titre, ISBN, éditeur et année. En revanche le **numéro de tome n'est pas
exploitable** : cinq formats coexistent (`Naruto. 22`, `Beastars. Vol. 20`, `Chainsaw Man. T.22`,
`Spy x Family - Tome 16`) et la moitié des notices portent le sous-titre du tome à la place du
numéro — Bleach remonte `Black`, `Friend`, `Howling`. Pire, `Naruto. 22 (Éd. Hokage)` est une
autre édition française. **L'ISBN par tome reste donc ouvert ; l'éditeur est acquis.**

**MangaLib et MangaHook sont des impasses.** MangaHook est un scraper auto-hébergé d'un
agrégateur pirate, son API de démonstration est morte, et il ne donne qu'une vignette par série
et des pages de chapitre — jamais de couverture par tome. MangaLib est géobloqué depuis la
France (DDoS-Guard 1020) et ses jaquettes seraient d'édition russe.

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
| Accès privé | Garde applicative, mot de passe unique dans `proxy.ts` | Hobby ne sait pas protéger la production |
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
- **Le domaine de production est public, et Hobby ne sait pas le fermer.** Vérifié dans la
  documentation Vercel le 30 août 2026 : la méthode *Vercel Authentication* existe sur tous les
  plans, mais la portée **All Deployments** — la seule qui couvre la production — est réservée
  aux plans **Pro et Enterprise**, et *Password Protection* est Enterprise ou un module à
  **150 $/mois** sur Pro. Sur Hobby, *Standard Protection* protège les prévisualisations et les
  URL générées, jamais le domaine de production. **La garde est donc dans l'application**, voir
  §12. Activer quand même *Standard Protection* : elle ferme les prévisualisations pour rien.
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

Dernière mise à jour : 30 août 2026.

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
`http://192.168.1.13:3000` valide donc la mise en page, jamais l'installation** — celle-ci
attend le déploiement Vercel.

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
le manifeste de §12 remplit déjà tous les critères.

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

**Ce qui reste à fournir : 81 images sur 13 éditions.**

| Cause | Tomes |
|---|---|
| 5 éditions non simples, exclues de MangaDex par nature — un tome double ne correspond à aucun tome japonais | 36 |
| 5 éditions sans fiche MangaDex — `ippo-s4-la-loi-du-ring` (27), `les-legendaires-saga` (12), et trois hors-séries | 42 |
| `solo-leveling` tome 19, trou isolé | 1 |
| `radiant` 20 et `the-ancient-magus-bride` 24, annoncés sans jaquette déposée | 2 |

### Reste à faire

- **Ajouter une seconde édition à une série existante** n'est pas couvert : `creerSerieAvecEdition`
  (`lib/creation.ts:33`) crée toujours une `Serie` neuve, et les résultats locaux de `/ajouter`
  sont de simples liens vers la fiche existante. Créer une Perfect Edition depuis le résultat
  AniList produirait une série fantôme `berserk-2` : bloc « Autres éditions » vide des deux
  côtés, et `sousTitreLigne` (`lib/domain.ts:165`) reperdrait le nom d'édition puisqu'il teste
  `editionsDeLaSerie > 1`. **La porte d'entrée est l'ISBN, pas AniList** — voir la sonde du
  30 août ci-dessus.
- **Couvertures** : 1 611 sur 1 690, déposées dans Vercel Blob. Les 79 manquantes n'ont
  aucune source automatique et attendent `npm run covers:manuelles` — voir le détail ci-dessus. Le remplissage reste
  **manuel et local** : `npm run db:backup`, puis `covers:fetch`, puis `covers:upload`.
  §5 prévoit un rafraîchissement de fond qui ramasserait les couvertures manquantes — il
  n'existe pas. Le porter demande de réécrire en TypeScript le sélecteur MangaDex de
  `fetch_covers.py`, celui qui pénalise les fiches satellites : sans lui, un appariement naïf
  fait repartir Bleach avec 1 tome sur 74 (§ couvertures, 29 août).
- **PWA** : le manifeste et les icônes sont faits, **le service worker non**. Rien n'est mis
  en cache — mais l'installation, elle, n'attend que le HTTPS, pas le service worker.
- **APK autonome par Bubblewrap** : décidé possible, pas fait. `/.well-known/` est déjà ouvert
  côté garde ; restent le keystore et `assetlinks.json`.
- **12 éditions sans éditeur** (§ BnF) : les fautes de frappe du Sheet les bloquent.
  **Ne pas transposer la similarité de `fetch_covers.py`** comme le suggérait la note
  précédente : l'enrichissement AniList a montré que le seuil rejette les bonnes réponses dès
  que le titre VF s'éloigne. La table `RECHERCHES_MANUELLES` de `fetch-anilist.ts` est le
  motif qui marche, et les titres romaji désormais en base (`titreVo`, 104/108) donnent
  au passage un second terme de recherche à essayer contre la BnF.
- **Thèmes** : 99 valeurs françaises, avec les coupures d'import (`Post` + `apo`, `Super` +
  `héros`, `Dieux` + `Déesses`, `Combats` / `Combat`). Aucun écran ne les affiche et
  `creerSerieAvecEdition` les laisse vides : sans écran, le nettoyage ne rapporte rien.
- **Automatiser la sauvegarde.** `npm run db:backup` existe et est prouvé, mais il se lance à
  la main. Un cron Vercel quotidien ne peut pas écrire dans le dépôt ; le plus simple reste de
  le lancer depuis le poste avant chaque manipulation de masse et de commiter le résultat.

### Reprendre sur un poste neuf

1. `git clone` puis `npm install` — le client Prisma se régénère tout seul.
2. Créer `.env` sur le modèle de `.env.example`, avec les deux chaînes reprises du tableau de
   bord Neon (**Connect**, interrupteur *Connection pooling* pour l'une, sans pour l'autre).
   Les secrets ne sont pas dans le dépôt et n'y seront jamais.
3. `npm run dev`. **Ne pas relancer le seed** : la base Neon est déjà remplie, elle est la
   source de vérité, pas `data/collection.json`.
4. `npm run db:backup` avant toute manipulation de masse. `data/backup.json` est versionné et
   `npm run db:backup -- --restore --reset` remonte la base entière si Neon la perd.
5. Rien à faire pour les couvertures : elles sont dans Blob et la base porte leurs URL
   absolues. `npm run covers:fetch` ne sert plus qu'à en acquérir de nouvelles, suivi de
   `npm run covers:upload` — qui réclame `BLOB_READ_WRITE_TOKEN` dans `.env`.

Le blocage du port 5432 décrit en §7 est propre au poste professionnel. Sur un réseau ordinaire,
`prisma migrate dev` attaque Neon directement et le détour par `npx prisma dev` devient inutile —
`npm run db:migrate` reste valable partout.

### Décisions encore ouvertes

- **Clé d'API Google Books** : à créer, et à vérifier qu'elle ne réclame pas de carte. Sans elle,
  aucune couverture de tome ni ISBN (§5). L'étape 5 ne l'a pas exigée — elle ne sert qu'au
  niveau tome, donc au remplissage des couvertures et au rafraîchissement de fond.
- **Contradiction dans le handoff** : l'option retenue y est nommée `2b` en tête et `1b` en pied.
  Cosmétique, la description est la même.
- **`Edition.slugMangaNews` est nul sur les 112 éditions.** Le Sheet ne le portait pas, et le
  lien manga-news ne s'affiche donc jamais. `Edition.editeur` est réglé : 100/112 depuis la BnF.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
