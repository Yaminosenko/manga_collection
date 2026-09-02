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

> **Révision programmée — voir §13.1.** Quatre champs de `Edition` (`statut`, `termineeForcee`,
> `raisonCompletion`, `aVerifier`) sont des données **personnelles** rangées dans une table de
> **catalogue**. Tant qu'il n'y a qu'un utilisateur, personne ne s'en aperçoit ; au second
> compte, ils s'écrasent. Ils déménagent dans `SuiviEdition`. **À faire tant que la base ne
> porte qu'un utilisateur** — le coût double à chaque compte créé.

### Volume
Un tome de l'édition. Généré de 1 à `tomesParus`. Enrichi progressivement (ISBN, date,
couverture, `sourceCouverture`).

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
| BnF (SRU) | Éditeur, ISBN, date de parution VF, **prix en UNIMARC `010$d`** | **éditeur : 106/113 · sans clé**, les 7 derniers saisis à la main |
| BnF (Service Couvertures) | **Couvertures VF par ISBN/EAN** | sans clé · réutilisation documentée · URL en bêta |
| MangaDex | Couvertures de tome, **dernier recours** | **93 % en `ja` · en attente d'autorisation** |
| Google Books | Tomes VF par ISBN, date de parution, couverture tome | **bloqué sans clé d'API, couverture jamais mesurée** |
| Open Library | Complément ISBN, couverture par ISBN | 0/11 sur des ISBN français |
| manga-news | Planning des sorties VF | **Export mensuel offert aux visiteurs, archives qualifiées jusqu'à 2000** · l'usage *programmatique* reste en attente d'autorisation |

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

### Ordre des sources de couverture (31 août 2026)

Décidé après recherche. **La couverture japonaise sur une édition française est un pis-aller,
plus le chemin principal.**

1. **BnF, service Couvertures.** Interrogeable **directement par ISBN ou EAN**, sans passer par
   l'ARK : `openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=<isbn>&couverture=1`.
   Trois tailles. **Seule source dont le statut juridique est écrit** : réutilisation possible
   avec mention de la source et de la date de récupération — la seule tenable le jour d'une
   ouverture ou d'une monétisation. Toutes les notices ne portent pas d'image ; URL en bêta.
2. **Open Library.** `covers.openlibrary.org/b/isbn/<isbn>-L.jpg`, avec `?default=false` pour
   obtenir un 404 plutôt qu'une image vide. Faible sur le manga français, gratuite à essayer.
3. **MangaDex.** Dernier recours assumé.
4. **Dépôt manuel**, déjà en place.

**Le vrai verrou n'est pas la source, c'est l'ISBN.** Toutes les bonnes sources s'interrogent
par ISBN ; MangaDex n'a été retenu que faute d'ISBN, d'où le sélecteur d'appariement par titre
et ses ratés. Le planning manga-news porte un EAN sur 306 lignes sur 307 : **l'import des
archives supprime l'appariement par similarité** — planning → EAN → BnF. C'est le même chantier
que la construction du catalogue (§13.2), pas un chantier de couvertures.
**L'archive est qualifiée jusqu'à septembre 2000, EAN-13 compris** (2 septembre 2026) : le
verrou n'attend plus qu'un lot de CSV.

**Champ `sourceCouverture` sur `Volume`, à ajouter.** Sans lui, les 1 674 images actuelles sont
un sac indistinct : impossible de savoir lesquelles viennent de MangaDex et méritent d'être
remplacées par la version française, ni de fournir l'attribution exigée par la BnF.

**Scrapers par éditeur : V3, conditionnel.** L'éditeur venu de la BnF permet de router un tome
vers le bon site. Mais un scraper s'écrit en une heure et se maintient éternellement, et rien
ne dit lesquels valent le coup avant que la chaîne planning → EAN → BnF ait tourné. Trois
règles si on y va : compter les tomes par éditeur d'abord et n'écrire que pour les trois ou
quatre premiers ; chaque scraper déclare ce qu'il attend et **échoue bruyamment** ; un scraper
cassé ne bloque jamais les autres. Demander d'abord aux éditeurs s'ils exposent un flux ONIX —
une réponse positive remplace le scraper par un import propre.

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

> **NON IMPLÉMENTÉ au 31 août 2026.** Le service worker n'existe pas, rien n'est mis en cache.
> Cette section décrit la cible, pas l'état. Relevé en revue : l'usage en librairie — celui qui
> justifie l'application — ne fonctionne pas hors réseau. À construire ou à assumer
> explicitement, mais la spec ne doit pas décrire une fonctionnalité absente.

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

> **Amendement du 1er septembre 2026 — la carte est admise, le débit ne l'est pas.** Cloudflare
> R2 exige une carte enregistrée à l'activation, sans débit sous les paliers gratuits (§13.2).
> La contrainte devient donc : **coût zéro, et aucun débit possible sans franchir un palier hors
> d'atteinte.** C'est une phrase plus faible que l'originale, et elle est écrite comme telle
> plutôt que glissée en silence : « sans carte » était un garde-fou mécanique — impossible de
> payer —, « sans débit » est un garde-fou arithmétique, qui suppose qu'on mesure la marge.
> Elle ne vaut que pour un service dont le palier gratuit est à deux ordres de grandeur du
> besoin, marge chiffrée à l'appui. Tout autre service reste soumis à la règle d'origine.

| Rôle | Choix | Plan |
|---|---|---|
| Application | Next.js (App Router), React, TypeScript | — |
| ORM | Prisma | — |
| Base | PostgreSQL sur Neon | Free — 0,5 Go, 100 CU-h/mois, veille après 5 min |
| Hébergement | Vercel | Hobby — usage personnel, sans carte, non facturable |
| Couvertures | Vercel Blob | Hobby — 1 Go inclus, ~30 Mo nécessaires |
| Accès privé | Garde applicative : mot de passe pour écrire, bouton invité pour consulter | Hobby ne sait pas protéger la production |
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

Dernière mise à jour : 2 septembre 2026.

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
aucune écriture** — la garde de §12 tient sur ce chemin aussi.

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
- **Ce seuil n'est pas celui que §12 déconseille.** L'avertissement du 30 août vise la
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

### Revue du 31 août 2026 — à traiter avant la séparation catalogue/suivi

Cinq points relevés en revue d'architecture. Les deux premiers sont bloquants.

1. **Quota Blob — urgent, irréversible.** ~1 800 opérations avancées consommées sur les 2 000
   du mois. Dépassement ⇒ **store inaccessible 30 jours**, les 1 674 couvertures disparaissent.
   Le garde-fou de `covers:upload` ne couvre pas le vrai risque : **toute consultation du store
   depuis le tableau de bord Vercel compte aussi**, et rien ne l'empêche. Migrer vers
   **Cloudflare R2** — 10 Go, 1 million d'écritures par mois, egress toujours gratuit,
   compatible S3, donc changement limité au client et aux variables d'environnement — ou ne
   plus jamais ouvrir le navigateur de blobs. **Tranché le 1er septembre : R2, la carte étant
   admise** — voir « Tranché — Cloudflare R2 » ci-dessous. Le point reste bloquant jusqu'à la
   migration : d'ici là, **ne pas ouvrir le navigateur de blobs**.

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

5. **Circuit de migration à revérifier.** Le double temps `prisma dev` + `apply-migrations.ts`
   existe parce que **le port 5432 était bloqué par le réseau du poste professionnel** (§7). Le
   développement est passé sur la machine personnelle. Si la contrainte a disparu, c'est un
   contournement complexe pour un problème qui n'existe plus.

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
  de §12 veut une relecture humaine ; une ligne suspecte doit lui arriver, pas disparaître.
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

### Reste à faire

- **Migrer les couvertures vers Cloudflare R2** (tranché le 1er septembre, voir ci-dessus).
  **Le point le plus urgent du backlog** : jusqu'à la migration, le quota Blob reste à ~200
  opérations de la panne de 30 jours, et **il ne faut pas ouvrir le navigateur de blobs**. Le
  travail : un client S3 en remplacement de `@vercel/blob`, un script de migration qui énumère
  depuis Postgres, la réécriture des `couvertureUrl` et `Sortie.couvertureUrl`, les trois
  garde-fous ci-dessus, puis la suppression du store Vercel. `scripts/upload-covers.ts` est le
  seul auteur de `couvertureUrl` et reste le seul point d'écriture à reprendre.
- **Écran « Wish list »** (demandé le 30 août) : les séries pas encore commencées mais qu'on
  compte acheter. Distinct des Manquants, qui ne parle que de tomes absents d'éditions déjà
  possédées. Demande sans doute un `statut` supplémentaire ou un drapeau sur `Edition`, et de
  décider si ces séries comptent dans les compteurs d'en-tête et dans la valeur — a priori non,
  comme les vendues.
- **Ajouter une seconde édition à une série existante** n'est pas couvert : `creerSerieAvecEdition`
  (`lib/creation.ts:33`) crée toujours une `Serie` neuve, et les résultats locaux de `/ajouter`
  sont de simples liens vers la fiche existante. Créer une Perfect Edition depuis le résultat
  AniList produirait une série fantôme `berserk-2` : bloc « Autres éditions » vide des deux
  côtés, et `sousTitreLigne` (`lib/domain.ts:165`) reperdrait le nom d'édition puisqu'il teste
  `editionsDeLaSerie > 1`. **La porte d'entrée est l'ISBN, pas AniList** — voir la sonde du
  30 août ci-dessus.
- **Couvertures** : 1 674 sur 1 710, déposées dans Vercel Blob. Restent 36 tomes parus —
  `ippo-s4-la-loi-du-ring` 25 et `les-legendaires-saga` 11 — et deux annonces,
  `radiant` 20 et `les-legendaires-saga`. Le remplissage reste
  **manuel et local** : `npm run db:backup`, puis `covers:fetch`, puis `covers:upload`.
  §5 prévoit un rafraîchissement de fond qui ramasserait les couvertures manquantes — il
  n'existe pas. Le porter demande de réécrire en TypeScript le sélecteur MangaDex de
  `fetch_covers.py`, celui qui pénalise les fiches satellites : sans lui, un appariement naïf
  fait repartir Bleach avec 1 tome sur 74 (§ couvertures, 29 août).
- **PWA** : le manifeste et les icônes sont faits, **le service worker non**. Rien n'est mis
  en cache — mais l'installation, elle, n'attend que le HTTPS, pas le service worker.
- **APK autonome par Bubblewrap** : décidé possible, pas fait. `/.well-known/` est déjà ouvert
  côté garde ; restent le keystore et `assetlinks.json`.
- **Appliquer l'archive de planning.** Les 288 CSV sont rangés dans
  `~/Documents/planning_manga/` et le passage à blanc est propre (1 333 ISBN, une seule hausse
  de `tomesParus`, voir ci-dessus). Il reste à lancer `planning:import` puis `planning:apply`
  pour de vrai — **`npm run db:backup` d'abord**.
- **Alimenter `ParutionCatalogue`** : la table est en place, rien ne l'écrit encore. Les trois
  règles de lecture (préfixes 978/979, désinversion de l'article **par segment**, découpe du
  marqueur d'édition) sont établies et mesurées. Le manifeste intermédiaire ne doit **pas**
  être versionné, pour la même raison que le catalogue est hors sauvegarde.
- **Deux trous dans l'archive** : `2000-09` (31 lignes, le plus petit mois) et
  **février 2024 → octobre 2026**, 33 mois, la fenêtre la plus utile pour le catalogue et
  l'écran Planning. À retélécharger.
- **Thèmes** : 99 valeurs françaises, avec les coupures d'import (`Post` + `apo`, `Super` +
  `héros`, `Dieux` + `Déesses`, `Combats` / `Combat`). Aucun écran ne les affiche et
  `creerSerieAvecEdition` les laisse vides : sans écran, le nettoyage ne rapporte rien.
- **Automatiser la sauvegarde.** `npm run db:backup` existe et est prouvé, mais il se lance à
  la main. Un cron Vercel quotidien ne peut pas écrire dans le dépôt ; le plus simple reste de
  le lancer depuis le poste avant chaque manipulation de masse et de commiter le résultat.

### Reprendre sur un poste neuf

1. `git clone`, puis `npm install` — le client Prisma se régénère tout seul.
2. **Python et Pillow** pour les scripts de couvertures : `pip install -r requirements.txt`.
3. Créer `.env` sur le modèle de `.env.example`. **Trois variables sont indispensables** :

   | Variable | Où la trouver |
   |---|---|
   | `DATABASE_URL` | Neon → *Connect*, interrupteur **Connection pooling** activé |
   | `DIRECT_URL` | le même, **sans** le pooling. Sert aux migrations |
   | `ACCESS_PASSWORD` | le mot de passe de la garde. **Le même que dans Vercel**, sinon les deux divergent |

   Deux autres sont facultatives : `BLOB_READ_WRITE_TOKEN` (Vercel → Storage → le store, onglet
   `.env.local`) pour déposer des couvertures, et `LOCAL_DATABASE_URL` pour exercer un script
   destructif sur un Postgres local. **Aucun secret n'est dans le dépôt et n'y sera jamais.**
4. `npm run dev`. **Ne pas relancer le seed** : la base Neon est remplie et fait foi, pas
   `data/collection.json` qui est figé au point zéro de l'import.

**Ce qui n'est pas dans le dépôt et qu'un poste neuf n'aura pas :**

- **Les couvertures** (`public/covers/`, ignoré). Sans objet pour l'affichage : elles sont dans
  Blob et la base porte leurs URL absolues. Ne les récupérer que pour en acquérir de nouvelles.
- **Les CSV de planning manga-news.** À retélécharger depuis le site, un fichier par mois. Le
  script les prend en argument ou par `PLANNING_DIR` ; il refuse de tourner si le dossier
  n'existe pas plutôt que de travailler à vide.
- **Les images de couvertures fournies à la main.** Elles ont déjà été converties et déposées ;
  seul un nouveau lot en demanderait.

**Les commandes, dans leur ordre d'emploi :**

| Commande | Rôle |
|---|---|
| `npm run db:backup` | **avant toute manipulation de masse.** `-- --restore --reset` remonte tout |
| `npm run planning:import <dossier>` | lit les CSV manga-news, n'écrit qu'un manifeste — **relire aussi `data/planning-divergences.json`** |
| `npm run planning:apply` | écrit `tomesParus`, ISBN, dates et sorties annoncées |
| `npm run covers:fetch` | acquiert les couvertures manquantes depuis MangaDex |
| `npm run covers:manuelles <dossier>` | convertit un lot fourni à la main |
| `npm run covers:upload` | dépose dans Blob et écrit `couvertureUrl`. `-- --force <slug>[:<numero>]` pour corriger, `-- --max <n>` pour relever le plafond de 150 envois |
| `npm run anilist:fetch` puis `anilist:apply` | genres et titres VO |
| `npm run publication:fetch` puis `publication:apply` | tomes parus BnF et état de parution |
| `npm run titles:fetch` puis `titles:apply` | noms de séries alignés sur la BnF |
| `npm run publishers:fetch` puis `publishers:apply` | éditeurs depuis la BnF |
| `npm run relations:fetch` puis `relations:apply` | séries liées depuis AniList |
| `npm run db:migrate` | applique les migrations à Neon sur le 443 |

**Toujours relire le manifeste entre le `fetch` et le `apply`** — c'est la raison d'être du
découpage en deux temps, et l'oublier a déjà coûté une relecture après coup.

Le blocage du port 5432 décrit en §7 est propre au poste professionnel. Sur un réseau ordinaire,
`prisma migrate dev` attaque Neon directement et le détour par `npx prisma dev` devient inutile —
`npm run db:migrate` reste valable partout.

### Décisions encore ouvertes

- **Clé d'API Google Books : devenue sans objet.** §5 la voulait pour l'ISBN et la date de
  parution par tome ; le planning manga-news donne les deux, en meilleure qualité et sans clé.
  À rouvrir seulement si une source de couvertures de tome manque un jour.
- **Contradiction dans le handoff** : l'option retenue y est nommée `2b` en tête et `1b` en pied.
  Cosmétique, la description est la même.
- **`Edition.slugMangaNews` est nul sur les 113 éditions.** Le Sheet ne le portait pas, et le
  lien sortant de la page Édition ne s'affiche donc jamais. Le planning ne porte pas les slugs
  non plus — il faudrait les déduire des titres, ou les saisir.
- **Les 29 éditions dont la BnF n'a rendu aucun numéro** gardent le `tomesParus` du Sheet. Elles
  peuvent être périmées sans qu'on le sache ; le planning en couvre une partie, pas toutes.
- **Mise au point de la caméra du scanner.** Le scan décode, mais l'autofocus ne converge pas
  quand le tome est tenu trop près : l'appareil principal d'un téléphone ne fait pas le point
  sous une dizaine de centimètres. Contournement : éloigner à 20-25 cm, la détection travaillant
  sur les frames natives en 1920 × 1080 et non sur l'aperçu à 240 px. Pistes non essayées —
  agrandir l'aperçu pour juger la netteté, choisir explicitement la caméra plutôt que de laisser
  `facingMode: "environment"` attraper l'ultra grand-angle, et une contrainte de zoom.
  **Rien n'est vérifiable depuis le poste** ; la saisie manuelle de l'ISBN, elle, est testée.
- ~~**Sortir Blob du chemin des couvertures**~~ — **tranché le 1er septembre 2026 : Cloudflare
  R2.** La piste `public/` du dépôt est écartée : zéro opération Blob, mais 38 Mo dans git et
  autant retenu par déploiement dans *Deployment Storage*. Voir « Tranché — Cloudflare R2 »
  ci-dessus ; la migration est passée dans « Reste à faire ». **Un second store Blob ne sert à
  rien** : la documentation est explicite, le quota est au compte, pas au store.

---

## 13. Trajectoire V2 — V3

Décisions d'architecture prises en amont, pour ne pas les découvrir en chemin.
Ce qui est ici est **tranché**. Ce qui est encore ouvert vit dans `IDEES.md`, jamais ici.

---

### 13.1 À faire maintenant, pendant qu'il n'y a qu'un utilisateur

Deux modifications de schéma. Elles déplacent des colonnes existantes, donc leur coût
double à chaque compte créé. Tout le reste de cette section peut attendre sans pénalité.

#### La séparation catalogue / suivi

Quatre colonnes de `Edition` sont des données **personnelles** rangées dans une table de
**catalogue**. Tant qu'il y a un utilisateur, personne ne s'en aperçoit. Au second compte,
un ami qui marque Servamp « en cours » écrase le « abandonnée » du premier : il n'y a
qu'une ligne `Edition`.

Les rôles ne règlent pas ça. Ils disent *qui a le droit d'écrire*, pas *dans quelle ligne*.

**Catalogue — partagé, écriture réservée**

| Table | Champs |
|---|---|
| `Serie` | tout, plus `alias` (voir 13.1.2) |
| `Edition` | `nom`, `editeur`, `tomesParus`, `editionTerminee`, `slugMangaNews`, `couvertureUrl`, `prixDefautCentimes`, `creeePar` |
| `Volume` | tout |

Des faits objectifs, identiques pour tout le monde.

**Suivi — une ligne par utilisateur**

```
SuiviEdition (id, utilisateurId, editionId,
              statut, termineeForcee, raisonCompletion, aVerifier)
Possession   (id, utilisateurId, volumeId, possede, dateAchat,
              prixPayeCentimes, etat, lu, note, varianteId)
```

`statut`, `termineeForcee`, `raisonCompletion` et `aVerifier` **quittent `Edition`**.

La wishlist (§ Reste à faire) est une donnée de suivi, pas de catalogue : une série
convoitée par l'un et possédée par l'autre est la même `Edition` avec deux `SuiviEdition`.
**La construire avant la séparation reviendrait à la coder deux fois.**

En V1, `SuiviEdition` existe avec un `utilisateurId` en dur. Aucun écran ne bouge.

#### `Serie.alias`

Liste de chaînes indexée : titre VF, titre VO, romanisations, abréviations connues.
Amorcée avec `titreVo`, déjà renseigné sur 104 séries.

Coût nul aujourd'hui. C'est la brique sur laquelle repose toute la recherche V3 — sans elle,
« JJK » ou « aot » ne trouvent rien, et **aucune distance de chaînes ne rattrape ça**.

---

### 13.2 V2 — les autres utilisateurs

#### L'identité, en premier

Le système actuel distingue des **rôles**, pas des **personnes** : un seul mot de passe,
deux jetons HMAC du même secret. Les comparaisons entre utilisateurs, prévues plus loin en
V2, supposent que les utilisateurs existent — donc l'identité ouvre la V2, elle ne la clôt pas.

Lien magique par email ou OAuth Google, tous deux gratuits à cette échelle. `utilisateurId`
sort du jeton.

Ça referme au passage le trou assumé du 30 août : aujourd'hui quiconque connaît l'URL
consulte la collection, prix et valeur totale compris.

#### Les trois rôles

| | Invité | Utilisateur | Propriétaire |
|---|---|---|---|
| Consulter | oui | oui | oui |
| Cocher ses tomes, changer son statut | non | oui | oui |
| Ajouter une série au catalogue | non | oui, marquée | oui |
| Modifier nom, éditeur, tomes parus, parution | non | non | oui |
| Importer le planning, lancer les scripts | non | non | oui |
| Relire les ajouts marqués | non | non | oui |

Le motif existe déjà et il est prouvé : `roleDuJeton`, `exigerAcces` pour lire,
`exigerProprietaire` pour écrire. Ajouter un rôle est une extension, pas une refonte.

**La frontière reste dans les Server Actions**, jamais dans l'interface — vérifié le
30 août en appelant `definirParution` avec un cookie invité : 500 et aucune écriture.
L'interface qui masque les contrôles est un confort, pas la protection.

#### La règle d'ajout : libre, mais marqué

Un utilisateur peut créer une série. C'est une écriture dans le catalogue partagé —
`creerSerieAvecEdition` crée `Serie`, `Edition` et les `Volume`.

L'ajout est **libre et immédiatement visible de tous**, avec `creeePar` renseigné et
`aVerifier` levé jusqu'à relecture par le propriétaire.

Écarté : l'ajout privé jusqu'à validation (deux visibilités, donc une condition dans
toutes les requêtes du catalogue) et l'ajout libre sans garde-fou (dégradation silencieuse).

`aVerifier` sert déjà exactement à ça depuis la migration. L'écran de relecture donne au
rôle propriétaire un contenu concret.

**Limite connue** : un utilisateur ne peut pas encore ajouter une seconde édition à une
série existante (§ Reste à faire — `creerSerieAvecEdition` crée toujours une `Serie` neuve).
Ce défaut devient plus visible à plusieurs. La porte d'entrée est l'ISBN, pas AniList.

#### Le catalogue ne s'amorce pas par accumulation

Erreur de raisonnement à éviter : attendre que les utilisateurs remplissent la base.
C'est le modèle de l'application de référence, et il lui a pris vingt ans.

**Les archives de planning manga-news donnent le catalogue d'un coup.** Format validé le
30 août : 267 titres sur 307 parsés, EAN sur 306 lignes sur 307, deux correspondances
exactes trouvées dans la collection existante. Le script existe déjà.

À raison d'environ 300 sorties mensuelles, dix ans d'archives font de l'ordre de
36 000 lignes, soit quelques milliers de séries — le catalogue du manga français. Chaque
ligne porte son EAN, donc chaque tome est enrichissable à la BnF.

Deux difficultés, connues :

- **La déduplication.** « Berserk », « Berserk - Édition Prestige » et « Berserk Glénat »
  sortiront comme des séries distinctes si le parsing hésite. Importer tout, marquer tout,
  relire les cas ambigus au fil de l'eau. **Résolue par la forme de la table (2 septembre)** :
  `ParutionCatalogue` garde les lignes brutes et le catalogue de séries est une requête
  d'agrégation, donc la consolidation n'a lieu qu'à l'entrée d'une série dans une collection.
- **Les couvertures.** Ne pas enrichir les ~59 000 tomes d'avance : à 23,4 Ko la couverture cela
  ferait **1,4 Go**, plus que le Go de Vercel Blob, pour des images que personne ne regarde.
  **Récupérer la couverture quand une série entre dans une collection.** Le stockage reste
  proportionnel à l'usage réel.

Conséquence : les ajouts libres ne portent plus le catalogue, ils comblent ses trous — les
titres épuisés, les éditions confidentielles, ce que le planning n'a pas indexé.

**Question tranchée le 2 septembre 2026** : les archives remontent à **septembre 2000**, format
et EAN-13 inclus, et le rendement ne se dégrade pas avec l'ancienneté. Voir « Établi — les
archives de planning » (§12) pour les mesures et le plancher recommandé. Un ordre de grandeur
à corriger au passage : le marché faisait 31 sorties par mois en 2000 contre 292 aujourd'hui,
et l'interpolation sur les cinq points mesurés (31 · 142 · 168 · 201 · 292) donne **~59 000
lignes pour 26 ans**, pas 36 000 pour dix ans.

#### Les variantes de tome

Un tome collector n'est pas « le même avec une autre couverture » : c'est un objet
physique distinct, avec son ISBN, son prix et sa date. C'est le problème des éditions,
un cran plus bas.

```
VarianteVolume (id, volumeId, nom, isbn, couvertureUrl, prixCentimes)
Possession.varianteId → nullable
```

Écarté : un simple `Volume.couverturePersoUrl`. Une demi-heure de travail, mais une impasse —
personne d'autre n'en profite et **on ne peut jamais savoir qu'une variante existe**.

L'angle collection recherché n'est pas « ma couverture s'affiche », c'est *« il existe une
jaquette alternative du tome 5 et je ne l'ai pas »*. Le manque est le moteur ; le
remplacement d'image ne l'exprime pas.

Contrairement à 13.1, **cette table peut arriver plus tard sans douleur** : c'est un ajout,
pas un déplacement de colonnes.

#### Cloudflare R2

Non pas une optimisation, mais **le seul chemin vers la V3**. Vercel Blob accorde 2 000
opérations avancées par mois sur Hobby ; retraiter les 1 674 couvertures actuelles coûte
déjà presque un mois de quota. Avec dix fois plus de séries, Blob est disqualifié.

Palier gratuit R2, mensuel et permanent : 10 Go, 1 million d'écritures (Class A), 10 millions
de lectures (Class B), **egress toujours gratuit**. Compatible S3 — le changement se limite au
client et aux variables d'environnement.

**La carte est exigée, le débit ne survient qu'au dépassement. Tranché le 1er septembre 2026 :
on y va**, §7 amendé en conséquence. Les marges mesurées et les trois garde-fous sont dans
« Tranché — Cloudflare R2 » (§12).

#### Filtres : genres seulement

Les genres viennent de la liste fermée d'AniList depuis le 30 août — normalisés, filtrables.
Les **thèmes ne sont pas filtrables** : 99 valeurs françaises avec les coupures d'import
documentées (`Post` + `apo`, `Super` + `héros`, `Combats` / `Combat`).

Un filtre « apo » exposé à un utilisateur tiers est indéfendable. Le nettoyage des thèmes
attend un écran qui les affiche.

---

### 13.3 V3 — la recherche et l'ouverture

#### La recherche : des données, pas un algorithme

Trois échecs d'appariement par similarité sont déjà documentés : le seuil AniList rejette
les bonnes réponses dès que le titre VF s'éloigne, une série mère battait son propre
spin-off, et `RECHERCHES_MANUELLES` est le motif qui marche.

L'application de référence n'a pas un meilleur algorithme, **elle a de meilleures données** :
vingt ans de saisie communautaire.

Avec un catalogue pré-construit (13.2), le problème change de nature : l'utilisateur ne
cherche plus « dehors » mais **dans la base**. Par ordre de rendement :

1. **`Serie.alias`** — posé en 13.1, c'est ce qui rapporte le plus
2. **Recherche plein texte PostgreSQL** — normalisation des accents, trigrammes, natif sur Neon
3. **L'ISBN comme chemin privilégié** — le scan court-circuite entièrement la recherche ;
   chaque scan est un appariement exact
4. **Les alias appris** — « JJK » suivi de l'ouverture de Jujutsu Kaisen enregistre
   l'association. C'est ainsi que se constituent les vingt ans de l'autre.

L'appariement difficile ne subsiste qu'à l'import du catalogue : **une fois, hors ligne,
sous supervision**, jamais pendant qu'un utilisateur attend.

#### Diffusion Android

Bubblewrap, déjà exploré (§ Reste à faire) : `/.well-known/` est ouvert côté garde, restent
le keystore et `assetlinks.json`. Pas de store obligatoire pour une poignée de personnes —
la PWA s'installe depuis le navigateur.

#### Monétisation

Principe : **le hub de collection reste entièrement fonctionnel gratuitement.** Le paiement
ne débride que le communautaire, la gamification et le confort.

Suggestion retenue : paiement **unique**, de l'ordre de 5 €, porté par une colonne sur
`Utilisateur`. Un abonnement — expiration, relances, échecs de prélèvement, remboursements —
est disproportionné à ce montant.

Prévoir l'état de paiement **dès la création de la table `Utilisateur` en V2**. Une colonne
de plus coûte zéro ; l'ajouter après coup demande une migration sur des comptes existants.

**Le planning reste gratuit.** C'est la fonctionnalité qui rend l'application utile en
librairie, donc celle qui donne envie de payer pour le reste. Derrière le mur : stats
partagées, comparaison, suivi d'autres utilisateurs, badges.

---

### 13.4 Les trois échéances externes

Elles ne dépendent pas du code et ont le **même déclencheur : le premier euro encaissé**.
Tout ce qui précède est réversible ; à partir de là, non.

**Vercel Hobby devient interdit.** Le plan gratuit ne peut pas servir un projet générant du
revenu, et Vercel l'applique. Pro à 20 $/mois, soit environ 50 utilisateurs payants pour
l'équilibre. Effet de bord positif : `Vercel Authentication` en portée *All Deployments*
redevient disponible, ce que §7 croyait à tort inclus sur Hobby.

**La clause d'exclusivité du contrat de travail.** L'article L1222-5 la rend inopposable
**un an** à compter de la déclaration de début d'activité, même en présence de stipulation
contraire. C'est un sursis, pas une sortie : passé l'année elle redevient applicable, sous
peine de licenciement pour faute grave. La vraie sortie est un **accord écrit de
l'employeur**, à obtenir avant de créer la structure. Dossier favorable : projet personnel,
sans rapport avec l'activité de l'employeur, hors temps de travail.
*Ceci n'est pas un avis juridique — faire valider la rédaction exacte de la clause.*

**Les droits sur les couvertures.** Les stocker pour un usage personnel ne pose pas de
problème pratique. Les rediffuser sur un service payant change la nature de la situation :
les jaquettes appartiennent aux éditeurs et aux auteurs. Relire les conditions de
réutilisation de la BnF **avant** d'ouvrir le paiement.

---

### 13.5 Ce que ce document n'est pas

`IDEES.md` porte les envies non tranchées. Une idée n'entre ici **qu'une fois arbitrée**,
avec ce qui a été écarté et pourquoi.

Mélanger les deux donnerait à une intuition le même poids qu'à une décision, et une session
future ne saurait plus ce qui fait foi.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
