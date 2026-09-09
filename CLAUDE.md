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

Quatre niveaux de **catalogue**, deux tables de **suivi**. Une ligne par tome physique — c'est
ce qui résout le problème ci-dessus.

```
Serie        (id, slug, titre, titreVo, auteur, genres[], themes[], alias[], cible,
              couvertureUrl)
Edition      (id, serieId, slug, nom, editeur, tomesParus, editionTerminee,
              prixDefautCentimes, slugMangaNews, couvertureUrl, creeeParId)
Volume       (id, editionId, numero, isbn, dateSortie, prixCentimes, couvertureUrl)

Utilisateur  (id, email, nom, role, aPaye, creeLe)
SuiviEdition (id, utilisateurId, editionId, statut, suivie, ajouteeLe)
Possession   (id, utilisateurId, volumeId, possede, dateAchat, prixPayeCentimes,
              etat, lu, note)
```

**La séparation catalogue / suivi est faite depuis le 9 septembre 2026** — voir §13.1 et
`JOURNAL.md`. Le catalogue porte des faits objectifs, identiques pour tout le monde ; le suivi
porte une ligne par utilisateur. Il n'y a qu'un compte, le propriétaire, et l'invité est résolu
vers lui en lecture seule.

**« Ma collection » = ce pour quoi j'ai une ligne `SuiviEdition`**, plus « toutes les
`Edition` ». Toute requête d'écran part donc de `SuiviEdition` et joint `Edition`, jamais
l'inverse — sans quoi la séparation serait cosmétique et chacun verrait le catalogue entier.

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
- `creeeParId` — qui a créé la fiche. **`null` veut dire « venu de l'import »**, et c'est la
  seule raison pour laquelle cette colonne existait dès le premier jour du multi-compte :
  ajoutée plus tard, `null` n'aurait plus rien distingué.

Une édition ne porte **plus** `statut`, `termineeForcee`, `raisonCompletion`, `aVerifier` ni
`ajouteeLe` : c'étaient des données personnelles rangées dans une table de catalogue, et la
migration du 9 septembre 2026 les a sorties. `statut` et `ajouteeLe` vivent dans `SuiviEdition`,
`termineeForcee` y vit inversé sous le nom `suivie`, `raisonCompletion` et `aVerifier` sont
supprimés — voir §13.1.

### SuiviEdition
Le rapport **personnel** à une édition. Une ligne par utilisateur et par édition.

- `statut` — `EN_COURS` | `ABANDONNEE` | `EN_PAUSE` | `VENDUE`. Le rapport personnel à la
  série, pas l'état de publication. Pilote le libellé et la désaturation.
- `suivie` — **est-ce que je veux être rappelé de ce qui manque ?** `@default(true)` : une série
  qu'on ajoute est une série qu'on suit. C'est le **seul** filtre de Manquants et du Planning, et
  il ne prétend rien sur l'état de la collection — voir §3.
- `ajouteeLe` — ajoutée à **ma** collection, pas au catalogue. Sert au tri « Ajout récent ».

### Utilisateur
Un seul compte aujourd'hui, le propriétaire, créé par la migration avec un `email` nul — le
dépôt est public. `role` distingue `PROPRIETAIRE` de `UTILISATEUR` ; `aPaye` est posé d'avance
pour §13.4. **L'invité n'est pas une ligne `Utilisateur`** : c'est un rôle de jeton, résolu vers
l'id du propriétaire en lecture seule par `lib/utilisateur.ts`.

### Volume
Un tome de l'édition. Généré de 1 à `tomesParus`. Enrichi progressivement (ISBN, date,
couverture, `sourceCouverture`).

### Possession
Le lien avec la collection réelle, **par utilisateur**. En V1 seul `possede` est écrit ; les
autres champs existent et attendent la V2.

**Une ligne signifie « j'ai dit quelque chose sur ce tome ».** L'absence de ligne et
`possede=false` sont deux écritures du même fait, et la lecture doit les traiter à l'identique —
c'est le rôle du helper unique de `lib/possession.ts`. Rien ne pré-crée de lignes : le cron et
les scripts de catalogue créent des `Volume` sans `Possession`. `possede=false` reste nécessaire
pour dire `lu=true, possede=false`, le cas des tomes lus ailleurs.

---

## 3. Règles métier

### Complétion
**Deux axes indépendants, et il faut les deux.** « J'ai tous les tomes parus » n'est pas
« la série est finie » :

| Condition | Libellé |
|---|---|
| `possédés == tomesParus` et `editionTerminee` vrai | **Complète** |
| `possédés == tomesParus`, édition non terminée ou inconnue | **À jour** |

`suivie = false` force « Terminée par choix » quel que soit le compte, sur une édition
`EN_COURS`. Une édition non suivie **garde sa barre réelle** (11/13 reste affiché) et ses tomes
manquants **ne remontent pas** dans l'écran Manquants.

**`suivie` est le seul filtre de Manquants et du Planning, sur les deux écrans.** Il remplace à
lui seul les trois mécanismes qui cachaient des choses de Manquants — `termineeForcee`,
`statut = VENDUE`, et la section repliée « Abandonnées et en pause », qui a disparu avec lui.
Une édition abandonnée dont on veut quand même les trous se remet à `suivie = true` d'un tap,
et ses sorties reviennent au Planning dans le même geste : c'est un paquet, pas deux réglages.

| Possédés | `suivie` | Manquants | Planning | Où la série vit |
|---|---|---|---|---|
| ≥ 1 | oui | les trous | les sorties | Collection |
| ≥ 1 | non | rien | rien | Collection |
| 0 et `statut = VENDUE` | non | rien | rien | Collection, section « Vendues » |
| 0 | oui | **rien** | **rien** | **Wish list** |
| 0, non suivie, non vendue | non | rien | rien | **Collection**, à `0 / N` |

La dernière ligne manquait au tableau d'origine et a été trouvée à l'usage le 9 septembre 2026 :
une édition abandonnée dont on décoche tous les tomes n'est **pas** une envie d'achat, donc elle
reste en Collection. C'est cohérent avec la règle « une série reste en Collection tant qu'elle a
des tomes possédés **ou en a eu** » — la wish list demande `suivie`, c'est-à-dire une intention.

**Une entrée de wish list ne remonte ni dans Manquants ni dans le Planning**, et les deux écrans
l'excluent par la même condition — *au moins un tome possédé*. Sans elle, mettre une série de
40 tomes en wish list ajouterait 40 lignes à la liste de courses : Manquants sert à combler les
trous d'une édition qu'on a, pas à acheter une série entière.

2 éditions non suivies en `EN_COURS` : JUDGE (5/6) et NOZOKIANA (11/13). Motif : tomes lus
ailleurs, volontairement non rachetés. **AIR GEAR (32/37) est suivie**, et c'est l'intention
d'origine : on considère la série finie *et* on veut retrouver ses 5 trous dans Manquants — ce
que `termineeForcee` ne savait pas exprimer.

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
- Tri : alphabétique, tomes possédés, % de complétion, ajout récent.
  Sens inversable, choix mémorisé.
- Bas de liste : section « Vendues », repliée par défaut

### Édition — page de détail
Fusion des pages Série et Édition de la référence : un seul niveau, pas deux.
La page Édition **ne coche aucun tome** : elle donne à voir, la sélection se fait dans sa
sous-page.

1. En-tête : couverture, titre, `Nom d'édition · Éditeur`, `X / Y`, barre à trois zones
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
a tranché pour 2, confirmé le 31 août sur couvertures réelles — voir `JOURNAL.md`,
« Tranché — 2 colonnes et largeur maximale ».

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
**Ne montre que les éditions `suivie` dont on possède au moins un tome** — le même couple de
conditions que le Planning. Pas de section repliée : ce qu'on ne veut pas voir, on ne le suit pas.

### Wish list
Les séries qu'on compte acheter et dont on ne possède encore aucun tome. **Cinquième onglet de
la barre du bas**, entre Planning et Ajouter.

**L'appartenance est déduite, jamais stockée** : `possédés = 0 ET suivie ET statut ≠ VENDUE`.
Aucun champ à maintenir, aucun état à désynchroniser — cocher un tome fait basculer en
Collection, décocher le dernier ramène ici. Une ligne porte la couverture du tome 1, le titre,
`Nom d'édition · Éditeur` et `0 / Y` ; pas de barre de progression, elle serait toujours vide.

Ces séries **ne comptent ni dans les compteurs d'en-tête de la Collection ni dans la valeur** —
comme les vendues, et pour la même raison : on ne les possède pas.

### Rechercher — l'écran d'ajout

> **Arbitré le 9 septembre 2026, pas encore construit.** L'écran s'appelle aujourd'hui
> « Ajouter » et passe par AniList seule. Ce qui suit est la cible, décidée après mesure du
> catalogue et des sources — voir `JOURNAL.md`. La route reste `/ajouter` : la changer casserait
> les raccourcis de la PWA installée pour rien.

**Le nom change parce que le geste a changé.** On ne vient plus « ajouter » un objet qu'on
décrit soi-même : on **cherche** dans un catalogue de 11 315 séries, et ce qu'on trouve, on
l'ajoute ou on le suit.

#### Une barre, deux formes de saisie

Texte ou **EAN-13**, discriminés par `isbnValide()` — 13 chiffres, préfixe 978/979, clé de
contrôle juste. Pas de choix à faire, pas deux écrans à maintenir. Le scanner reste un bouton
qui remplit la même barre.

**Résolution par EAN, dans cet ordre** — le premier qui répond gagne :

| Rang | Test | Résultat |
|---|---|---|
| 1 | `Volume.isbn` en base | tome déjà connu → fiche de l'édition |
| 2 | `Sortie.isbn` | sortie annoncée → bouton « Je l'ai » |
| 3 | `ParutionCatalogue.ean` | **la ligne la plus récente**, jamais la première |
| 4 | BnF par ISBN | notice seule → candidat manuel |
| 5 | rien | saisie manuelle |

**Résolution par texte** : le local d'abord, par index sur `Serie.slug`, `Serie.titre` et
`Serie.alias` — un résultat local est un **lien** vers la fiche, jamais une création. Puis le
catalogue, classé par correspondance exacte, préfixe, puis similarité trigramme.
**Aucun seuil ne sélectionne** : l'algorithme classe, l'utilisateur choisit. C'est la leçon des
cinq échecs d'appariement automatique, et ici elle est gratuite — il y a un humain devant.

#### Une ligne de résultat par édition, pas par série

**Un résultat = un groupe `(serieNormalise, marqueurEdition)`**, affiché avec son nombre de
tomes et son éditeur. Il y a **12 619 groupes pour 11 315 séries**, et **863 séries sont
multi-édition**.

C'est GANTZ qui l'impose : le catalogue en connaît quatre — édition simple à **37 tomes** chez
Tonkam, **Perfect Edition à 18 tomes** chez Delcourt/Tonkam, et deux coffrets. Sans le nombre
de tomes sur la ligne de résultat, impossible de savoir laquelle on ajoute. C'est aussi ce qui
rend enfin soluble l'ajout d'une **seconde édition à une série existante** : le marqueur
distingue ce que `creerSerieAvecEdition` confondait.

#### Deux actions, un seul état

**« Ajouter » et « Suivre » écrivent exactement les mêmes lignes** — `Serie`, `Edition`,
`SuiviEdition`, les `Volume`, et **aucune `Possession`**. La série atterrit donc en wish list
dans les deux cas et n'entre en Collection qu'au premier tome coché : c'est l'appartenance
déduite de §3, qui ne stocke rien et ne peut pas se désynchroniser.

La seule différence est ce qui suit : **« Ajouter » emmène dans « Mes tomes »** pour cocher,
**« Suivre » reste sur la recherche**. Se tromper de bouton n'a donc aucune conséquence.

**Le cochage reste manuel**, un tome à la fois ou d'un coup avec `Tout` : pas de champ
« j'ai les tomes 1 à N » à la création.

#### Ce que le candidat porte, et d'où ça vient

| Champ | Règle | Ce qui la justifie |
|---|---|---|
| `titre` | `serieTitre` de la ligne la plus récente | 57 groupes sur 12 619 ont un titre variable, et les écarts sont cosmétiques |
| `nom` | `marqueurEdition`, sinon « Édition simple » | — |
| `editeur` | **BnF par ISBN**, le catalogue en repli | le catalogue nomme le **label**, la BnF l'éditeur légal : 9 éditions de la collection disent « Bamboo Édition » là où le catalogue dit « Doki Doki », son label manga — et c'est la BnF qui a rempli les 113 lignes existantes |
| `tomesParus` | `max(numero)` **sur les lignes de date passée** | 722 groupes seraient gonflés sans ce filtre, 944 lignes étant datées du futur |
| `tomesParus` sans aucun numéro | **1** | 5 361 groupes n'ont aucun `Vol.N` — one-shots, coffrets, artbooks |
| `volumes` | `numero` → EAN + date ; **les trous restent vides** | Détective Conan : `max = 107` pour 87 numéros distincts |
| `auteur` | BnF `700`/`701` filtrés sur le code de fonction `070` | les `702` sont traducteurs et illustrateurs ; Ajin rend bien ses deux auteurs |
| `prixDefaut` | BnF `010$d` sur l'EAN du dernier tome paru | mesuré : Beastars 690, Ajin 760, Smoking 795 |
| `editionTerminee` | **pré-cochée** si aucune sortie depuis `MOIS_SANS_SORTIE_POUR_TERMINEE` (24) | sinon une série finie en 2010 afficherait le hachuré « à paraître » et trois cases fantômes |
| `genres` · `themes` | **vides** | AniList est coupée, et le catalogue n'en porte pas |
| couvertures | **aucune à la création** | la BnF plafonne à 150 px ; la tâche quotidienne les ramassera |

**Le titre ne vient jamais de la BnF.** Pour l'ISBN de Bleach tome 22, son `200$a` rend
« Conquistadores » — le sous-titre du tome. Le catalogue porte le nom de série, la BnF l'auteur
et le prix : chacune sur ce qu'elle sait.

**`editionTerminee` pré-cochée est une déduction, et c'est assumé** : elle est visible dans le
formulaire et se décoche d'un tap. Le seuil de 24 mois est prudent — les séries longues
s'interrompent souvent 12 à 18 mois.

#### L'écriture

- Série déjà en base, appariée par `slug` ou `alias` → on ne crée **que** l'`Edition`, son
  `SuiviEdition` et ses `Volume`.
- Sinon → `Serie` avec `alias` amorcé des variantes de titre, puis le reste.
- Les `Volume` portent **`isbn` et `dateSortie`** là où le catalogue les connaît. C'est la
  nouveauté qui débloque le reste : couverture et prix s'obtiennent par ISBN.
- `creeeParId` renseigné.
- **Les sorties futures du groupe deviennent des `Sortie`** dans le même geste, dans la fenêtre
  M-1 → M+6 de §13.1. Une série ajoutée ou suivie annonce donc ses tomes à venir
  immédiatement, sans attendre un import — c'est la fin du défaut « le planning est une
  photographie, pas un flux ».
- **Aucune `Possession`**, sauf par `/scanner` : le tome scanné est marqué possédé, et la série
  entre alors directement en Collection.

#### Deux préalables techniques

- **`CREATE EXTENSION pg_trgm`** — disponible sur Neon, pas installée (vérifié le 9 septembre),
  plus un index GIN trigramme sur `ParutionCatalogue.serieNormalise`.
- **L'anti-doublon et `resoudreIsbn` doivent passer par un index.** Aujourd'hui le premier
  charge *tous* les titres de série et le second *toutes* les éditions ; §13.2 l'avait relevé,
  et à 11 315 séries de catalogue ça ne tient plus.

**Les magazines ne sont pas filtrés**, décidé le 9 septembre. Animeland (257 « tomes »), Les
Inrocks, Made in Japan et Dream Team sortent donc dans les résultats. Aucune règle automatique
n'est fiable — l'éditeur ne suffit pas, Glénat en publie, et le nombre de tomes non plus,
Détective Conan en a 107. Une liste noire écrite à la main, dans l'esprit de
`RECHERCHES_MANUELLES`, viendra plus tard.

---

## 5. Données externes

### Règle absolue
Les API externes sont appelées **à l'import et au rafraîchissement de fond**. Jamais à
l'ouverture d'un écran. Tout écran lit la base locale.

### Sources
| Source | Usage | État mesuré |
|---|---|---|
| AniList (GraphQL) | Métadonnées série, couverture série, pont vers les titres romaji | 12/12 · sans clé, sans quota gênant — **mais l'API est coupée depuis leur côté, voir ci-dessous** |
| BnF (SRU) | Éditeur, ISBN, date de parution VF, **prix en UNIMARC `010$d`** | **éditeur : 106/113 · sans clé**, les 7 derniers saisis à la main |
| BnF (Service Couvertures) | **Couvertures VF par ISBN/EAN** | sans clé · réutilisation documentée · URL en bêta |
| MangaDex | Couvertures de tome, **dernier recours** | **93 % en `ja` · en attente d'autorisation** |
| Google Books | Tomes VF par ISBN, date de parution, couverture tome | **bloqué sans clé d'API, couverture jamais mesurée** |
| Open Library | Complément ISBN, couverture par ISBN | 0/11 sur des ISBN français |
| manga-news | Planning des sorties VF | **Export mensuel offert aux visiteurs, archives qualifiées jusqu'à 2000** · l'usage *programmatique* reste en attente d'autorisation |

> **AniList est coupée par ses propres exploitants — constaté le 9 septembre 2026.** Toute
> requête rend `403` avec « The AniList API has been temporarily disabled due to severe
> stability issues. » Ce n'est ni le réseau du poste ni une clé manquante : la réponse vient
> d'AniList. Conséquences immédiates : **`/ajouter` ne propose plus que la collection locale**
> (l'écran dégrade proprement, « La recherche externe est indisponible »), et
> `anilist:fetch` comme `relations:fetch` ne rendront rien. La sonde du 28 août reste vraie de
> ce que l'API donnait ; elle ne dit rien de sa disponibilité. **Argument de plus pour brancher
> `/ajouter` sur `ParutionCatalogue`** — voir « Reste à faire » : le catalogue porte le nom FR,
> l'éditeur, la date et l'EAN sans dépendre de personne.

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
recopie dans Cloudflare R2 nous en rend indépendants une fois faite.

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
Cloudflare R2 et servies telles quelles.
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
| Couvertures | Cloudflare R2 | Free — 10 Go, 1 M écritures/mois, egress gratuit, ~39 Mo nécessaires |
| Accès privé | Garde applicative : mot de passe pour écrire, bouton invité pour consulter | Hobby ne sait pas protéger la production |
| Mobile | PWA installable | — |

Alternative écartée : FastAPI + React séparés. Deux déploiements, une couche API à écrire et
à maintenir, aucun hébergeur gratuit crédible pour la partie Python sans mise en veille longue.

Le script d'import est en Python et **ne dépend d'aucun de ces choix** : il produit un JSON
neutre. Changer de stack ne le remet pas en cause.

### Conséquences du gratuit, à ne pas découvrir plus tard

- **Pas de système de fichiers persistant.** §5 dit « stockées et servies par le serveur » :
  en pratique, servies depuis Cloudflare R2. Aucune écriture disque ne survit.
- **La base s'endort au bout de 5 minutes d'inactivité.** Premier écran après une pause :
  ~1 s de réveil. Prévoir un état de chargement, jamais un écran figé.
- **Le domaine de production est public, et Hobby ne sait pas le fermer.** Vérifié dans la
  documentation Vercel le 30 août 2026 : la méthode *Vercel Authentication* existe sur tous les
  plans, mais la portée **All Deployments** — la seule qui couvre la production — est réservée
  aux plans **Pro et Enterprise**, et *Password Protection* est Enterprise ou un module à
  **150 $/mois** sur Pro. Sur Hobby, *Standard Protection* protège les prévisualisations et les
  URL générées, jamais le domaine de production. **La garde est donc dans l'application** — voir
  `JOURNAL.md`, « Fait — la garde d'accès ». Activer quand même *Standard Protection* : elle
  ferme les prévisualisations pour rien.
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

> **Le drapeau n'existe plus (9 septembre 2026).** Les 37 éditions marquées sont descendues à 12
> par relectures successives, puis les 12 dernières ont été relues et le drapeau supprimé avec sa
> colonne — voir §13.1. Il aura donc servi exactement à ce pour quoi il avait été créé, et à
> rien d'autre : **c'était un artefact de cet import, pas un concept du modèle.** Cette section
> décrit le point zéro de la migration, elle ne décrit plus la base.

### Normalisations appliquées
- Statuts : espaces de fin supprimés (`EN COURS ` et `EN COURS` étaient deux valeurs distinctes)
- `FINI` → `statut = EN_COURS` + complétion calculée. Si l'édition est incomplète,
  `termineeForcee = true` — devenu `suivie = false` depuis. Le statut du Sheet mélangeait
  rapport personnel et complétion.
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

- Interface et **modèle métier** en français — `tomesParus`, `possede`, `suivie` : c'est la
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

Dernière mise à jour : 9 septembre 2026.

**La production est sur `https://manga-collection-wcj8.vercel.app`.** L'URL n'était écrite
nulle part avant le 9 septembre, ni ici ni dans `JOURNAL.md` : impossible de vérifier un
déploiement sans la demander. Elle est publique — la garde est applicative, et la page `/acces`
répond 200 à tout le monde ; c'est le trou assumé de §7, pas une fuite.

Ce document est la mémoire du projet. Il est versionné : une session ouverte sur un autre
poste le retrouve intact. Rien d'utile ne doit vivre ailleurs.

**Le journal détaillé vit dans `JOURNAL.md`** — 48 entrées datées, de l'import du Sheet au
déploiement : ce qui a été construit, les chiffres qui l'établissent, les défauts trouvés et
leur cause. Il a été sorti d'ici le 7 septembre 2026 parce qu'il pesait les deux tiers de ce
document et que ses rectifications successives finissaient par se contredire d'un bout à
l'autre du fichier.

> **Le lire avant de conclure qu'une chose n'existe pas.** Une session de septembre a relu
> cette section et déduit à tort que rien n'était déployé, faute d'une ligne. L'absence d'une
> fonctionnalité *ici* ne prouve rien : `JOURNAL.md` fait foi sur ce qui est fait.

Ce qui suit regarde vers l'avant : l'état chiffré, les pièges qui se répètent, le travail
restant, la reprise sur un poste neuf, les décisions encore ouvertes.

### L'état chiffré — lu en base le 9 septembre 2026, après la migration

| | |
|---|---|
| Séries | **109** |
| Éditions | **113** |
| Suivis (`SuiviEdition`) | **113**, tous sur le propriétaire — `EN_COURS` 86, `ABANDONNEE` 18, `EN_PAUSE` 5, `VENDUE` 4 |
| `suivie = true` | **84**, et aucune sur un `statut` ≠ `EN_COURS` |
| Utilisateurs | **1**, `PROPRIETAIRE`, `email` nul |
| Tomes (`Volume`) | **1 714** |
| Possessions | **1 714**, dont **1 155** possédées et 559 à `possede=false` |
| Couvertures | **1 676 / 1 714**, servies depuis Cloudflare R2 |
| ISBN et dates de sortie | **1 491 / 1 714**, soit 87 % |
| Éditeur · `titreVo` · `alias` | **113 / 113** · **105 / 109** · **105 / 109** |
| Sorties annoncées (`Sortie`) | **14**, dont **10** sur une édition suivie — l'écran n'affiche que ces 10 |
| Liens entre séries (`LienSerie`) | **18** sur 16 séries |
| `Edition.creeeParId` | **nul sur les 113** — c'est-à-dire « venu de l'import » |
| `Edition.slugMangaNews` | **0 / 113** — le lien sortant de la page Édition ne s'affiche donc jamais |
| Éditions à zéro tome possédé | **4**, et ce sont exactement les 4 `VENDUE` |
| Possessions portant `dateAchat` ou `prixPayeCentimes` | **0 / 1 714** — la V1 ne les écrit pas |
| `ParutionCatalogue` | **50 232** parutions, **11 315 séries**, janvier 2000 → décembre 2026, dont **48 222 avec EAN** — l'archive complète, hors les deux trous connus |

Les cinq premiers compteurs de §8 ont bougé depuis l'import, et c'est normal : le planning a
élargi des dénominateurs, et la promotion des sorties échues (`app/api/cron/route.ts`) crée des
tomes. **La sauvegarde se relance avant de s'appuyer sur ses chiffres** — elle a menti de deux
tomes le 7 septembre pour avoir été prise le 3.

`data/backup.json` est **dans la nouvelle forme** depuis le 9 septembre : il porte les
utilisateurs, les suivis et les possessions par compte, et ses compteurs sont passés de 8 à 7 —
`aVerifier` a disparu, `forcees` est devenu `suivies`, qui s'inverse. **Une sauvegarde d'avant
la migration ne se relit qu'avec l'ancien script**, et l'actuel le dit en clair en renvoyant au
tag `avant-multi-compte`. Ce tag est le chemin de retour : il porte le `backup.json` d'avant
**et** le `backup-db.ts` qui sait le lire.

### Pièges établis

Extraits du journal parce qu'ils se sont répétés et qu'ils coûtent cher à redécouvrir. Le
détail et les cas réels sont dans `JOURNAL.md`.

- **Seule une vérification fonctionnelle prouve quelque chose — cinq fois.** Les sondes ont
  menti à chaque fois : la présence de `__reactFiber$*` n'atteste pas l'hydratation, un
  événement `input` fabriqué ne déclenche pas `onChange`, l'action `type` du pilote ne remplit
  pas toujours un champ, un curl qui rend 400 n'a jamais atteint l'application, et **cliquer une
  case hors écran ne déclenche rien sans que rien ne le signale**. Cliquer pour de vrai, sur un
  élément visible, puis regarder l'écran **et** la base.
- **Un seuil de similarité ne remplace pas une table écrite à la main — cinq fois.** Sur
  AniList la bonne réponse marque 0,000 (`BLUE EYES SWORD` → *Hinowa ga Yuku!*), tronquer un
  titre produit des faux appariements confiants, et sur le planning quatre candidats sur cinq
  au-dessus de 0,80 étaient faux. Le motif qui marche est `RECHERCHES_MANUELLES` /
  `TITRES_MANUELS`, **chaque entrée confirmée à l'exemplaire** — jamais injectée en masse.
- **Le filtre qui suffit sur une fenêtre courte échoue en silence sur une archive longue —
  quatre fois.** Collision de titres à quinze ans d'écart (LEVIATHAN), marqueurs d'édition,
  rééditions dont le planning décrit un *autre objet physique*, purge de `Sortie` par un import
  qui ne les couvre pas. Corollaire : **le silence d'un import ne vaut pas suppression** — toute
  purge se borne à la fenêtre que le manifeste couvre réellement.
- **Tout script qui parle de la collection lit `data/backup.json`, jamais
  `data/collection.json` — trois fois.** `collection.json` est figé au point zéro de l'import :
  il ignore les titres corrigés et les séries ajoutées depuis l'application. Donc
  `npm run db:backup` précède `covers:fetch`, `publishers:fetch` et `titles:fetch`.
- **Le découpage `*:fetch` puis `*:apply` existe pour une relecture humaine.** Ne jamais
  enchaîner les deux : l'oubli a déjà coûté une relecture après coup. Relire aussi
  `data/planning-divergences.json`, où partent les lignes écartées.
- **Une frontière client qui importe un module tirant Prisma casse le build** — le bundle
  navigateur réclame `node:module`. Les types et les règles pures vivent dans `lib/domain.ts`,
  les requêtes dans `lib/editions.ts`.
- **`LOCAL_DATABASE_URL` ne doit jamais entrer dans `.env` — elle se passe en préfixe de
  commande.** Trois programmes s'en servent pour choisir leur cible : `backup-db.ts`,
  `apply-migrations.ts` et **`lib/prisma.ts`**, donc l'application elle-même. Laissée dans
  `.env`, une sauvegarde irait silencieusement lire le banc et écraserait `data/backup.json`
  avec son état.
- **`npx prisma dev` rend une URL sur `template1`.** Toute base créée ensuite en hérite, schéma
  **et** `_prisma_migrations` : un banc qu'on croit vierge ne l'est pas. Le banc tourne en
  PostgreSQL 17.5 (wasm) là où Neon est en 18.6.
- **Un clic d'automatisation ne prouve rien — sixième fois.** Aux coordonnées d'une capture
  périmée il tombe hors de l'écran ; par référence d'élément juste après une navigation il
  précède l'hydratation. Dans les deux cas : aucune erreur, aucun log, l'écran inchangé.
  Recapturer juste avant de cliquer, et **ne conclure que sur la base**.
- **Le cache des couvertures est immuable un an.** Corriger une image ne suffit pas : un
  appareil qui a vu la mauvaise la garde. Et **supprimer un fichier ne nettoie pas la base** —
  toute suppression remet `couvertureUrl` à `null` dans le même geste.
- **Après un `git pull` touchant au schéma, `npx prisma generate`** — `lib/generated/` est
  ignoré par git. Après un déplacement de route, purger `.next`, et le redémarrer si un serveur
  de développement tournait.
- **`next-env.d.ts` est généré et bascule tout seul.** `next build` y écrit
  `./.next/types/…`, `next dev` y écrit `./.next/dev/types/…` : le fichier apparaît donc modifié
  après chaque build, et le commiter le fait rebasculer au prochain `npm run dev`. Le laisser
  hors des commits, sauf si c'est le seul objet du changement.

### Reste à faire

- ~~**Le Planning ne filtre sur aucun statut**~~ — **corrigé le 9 septembre 2026** par la
  migration, comme prévu. `chargerPlanning` filtre sur `suivie` et l'écran est passé de 14 à
  **10 sorties** : `one-puch-man`, `les-legendaires-saga`, `why-nobody-remember-my-world` et
  `blue-exorcist` ont disparu.
- **Un chemin de la Phase 2 reste non vérifié fonctionnellement : `creerSerieAvecEdition`** —
  créer le `SuiviEdition`, renseigner `creeeParId`, ne plus créer de possessions. Il n'a pas pu
  tourner : le formulaire de confirmation n'est rendu que depuis un résultat distant, et
  **AniList a coupé son API** (voir §5). À reprendre dès qu'AniList revient, ou quand
  `/ajouter` sera branché sur `ParutionCatalogue` — ce qui rend ce branchement plus urgent
  qu'avant. Le mode invité, lui, **a été vérifié en production le 9 septembre** : le bouton
  « Entrer en invité » rend bien la collection du propriétaire en lecture seule, sans bouton
  « Je l'ai » ni actions de masse.
- **Trancher le vocabulaire de « Terminée par choix ».** L'écran État dit désormais
  « Suivie / Non suivie », mais la Collection et la page Édition disent toujours « Terminée par
  choix » pour la même édition. Le rendu n'a pas bougé volontairement — la formule de backfill
  rend les mêmes lignes qu'avant — mais les deux mots désignent un seul drapeau, et l'un des deux
  doit céder.
- ~~**La wish list peut maintenant se construire**~~ — **faite le 9 septembre 2026**, voir §4 et
  `JOURNAL.md`. Conséquence mécanique à connaître : **une série créée par `/ajouter` atterrit en
  wish list** et non plus en Collection à `0 / N`, puisqu'elle naît à zéro tome possédé. Par
  `/scanner` elle entre directement en Collection, le tome scanné étant marqué possédé.
- **`SuiviEdition.aDejaPossede` reste à trancher, et son backfill n'est exact qu'aujourd'hui.**
  « Une série reste en Collection tant qu'elle a des tomes possédés **ou en a eu** », et « en a
  eu » n'est enregistré nulle part : les 559 lignes à `possede=false` ne distinguent pas « jamais
  eu » de « revendu », et aucune possession ne porte `dateAchat`. Ça ne gêne pas tant que les
  **4 seules éditions à zéro tome possédé sont exactement les 4 `VENDUE`** ; le jour où une
  édition tombe à zéro sans être vendue, rien ne la sépare d'une entrée de wish list. Le backfill
  `possédés ≥ 1 OR statut = VENDUE` est juste maintenant et se dégradera.
- **Brancher un domaine personnalisé sur le bucket R2.** La base publique est aujourd'hui
  l'URL `r2.dev`, que Cloudflare **limite en débit et ne met pas en cache** — vérifié dans leur
  documentation le 3 septembre, c'est plus restrictif que ce que supposait le journal. Le basculement
  est **gratuit et sans réenvoi** : les objets ne bougent pas, `covers:migrate` liste le bucket,
  ne trouve rien à envoyer et se contente de réécrire les 1 688 URL. Le frein est §7 — un
  domaine est une dépense **certaine et récurrente** (~10 $/an chez Cloudflare Registrar), pas
  un palier hors d'atteinte, donc l'amendement du 1er septembre ne le couvre pas.
- **Supprimer le store Vercel Blob**, gardé quelques jours par prudence (décidé le 3 septembre).
  `del()` est gratuit ; **ne pas ouvrir le navigateur de blobs**, qui consomme le quota.
- **`CRON_SECRET` : posé dans Vercel, à ne pas re-poser — et invérifiable depuis ce poste.**
  Ce point était écrit « à faire » jusqu'au 9 septembre 2026 alors qu'il avait été posé le
  3 septembre ; le propriétaire l'a confirmé. Sans elle, `/api/cron` répondrait 401 à tout et la
  promotion automatique des sorties échues ne tournerait jamais — échec fermé volontaire, ce
  chemin étant hors de la garde d'accès.

  **Deux pièges à connaître avant d'y toucher.** D'abord, **l'endpoint ne peut pas dire si le
  secret est posé** : `autorise()` (`app/api/cron/route.ts:11`) rend `false` aussi bien quand le
  secret est absent que quand l'en-tête est faux, donc la production répond `401` dans les deux
  cas — sonder `/api/cron` ne prouve rien, seul le tableau de bord Vercel tranche. Ensuite, **la
  valeur jumelle est dans le `.env` de l'autre poste**, pas dans celui-ci : le `CRON_SECRET`
  local ne vaut probablement pas celui de Vercel, donc **un appel local réussi ne dit rien de la
  production**, et un appel local en échec ne dit rien non plus. C'est la même dispersion sur
  deux machines que les CSV de planning.
- **Compléter le rafraîchissement de fond de §5.** `app/api/cron/route.ts` existe depuis le
  3 septembre et ne fait qu'une chose : promouvoir les sorties dont le mois est clos. Restent
  les nouveaux tomes parus, la mise à jour d'`editionTerminee` et les couvertures manquantes.
- ~~**Écran « Wish list »**~~ (demandé le 30 août) — **fait le 9 septembre 2026.** Cinquième
  onglet, appartenance déduite, et ces séries **ne comptent ni dans les compteurs d'en-tête ni
  dans la valeur**, comme les vendues. **Elle restera vide en pratique tant qu'`/ajouter` ne
  fonctionne pas** : la seule autre porte est de décocher tous les tomes d'une édition suivie.
- **Ajouter une seconde édition à une série existante** n'est pas couvert : `creerSerieAvecEdition`
  (`lib/creation.ts:33`) crée toujours une `Serie` neuve, et les résultats locaux de `/ajouter`
  sont de simples liens vers la fiche existante. Créer une Perfect Edition depuis le résultat
  AniList produirait une série fantôme `berserk-2` : bloc « Autres éditions » vide des deux
  côtés, et `sousTitreLigne` (`lib/domain.ts:165`) reperdrait le nom d'édition puisqu'il teste
  `editionsDeLaSerie > 1`. **La porte d'entrée est l'ISBN, pas AniList** — voir `JOURNAL.md`,
  « Établi — l'ISBN est la clé des éditions françaises » (30 août).
- **Couvertures** : 1 676 sur 1 714, déposées dans Cloudflare R2. Restent 38 tomes parus —
  `ippo-s4-la-loi-du-ring` 25, `les-legendaires-saga` 11 et
  `blackrock-shooter-innocent-soul` 2 et 3 — et deux annonces, `radiant` 20 et
  `les-legendaires-saga` 13. **Les deux tomes de Black Rock Shooter viennent de la promotion
  d'une sortie annoncée** : `promouvoir()` crée le `Volume` en reprenant la couverture de la
  `Sortie`, et celle-ci était nulle — un tome promu sans couverture reste donc sans couverture
  jusqu'au prochain remplissage manuel. Le remplissage reste
  **manuel et local** : `npm run db:backup`, puis `covers:fetch`, puis `covers:upload`.
  §5 prévoit un rafraîchissement de fond qui ramasserait les couvertures manquantes ; la tâche
  quotidienne existe depuis le 3 septembre mais ne fait encore que promouvoir les sorties
  échues. Y porter les couvertures demande de réécrire en TypeScript le sélecteur MangaDex de
  `fetch_covers.py`, celui qui pénalise les fiches satellites : sans lui, un appariement naïf
  fait repartir Bleach avec 1 tome sur 74 (`JOURNAL.md`, « Fait — les couvertures », 29 août).
- **PWA** : le manifeste et les icônes sont faits, **le service worker non**. Rien n'est mis
  en cache — mais l'installation, elle, n'attend que le HTTPS, pas le service worker.
- **APK autonome par Bubblewrap** : décidé possible, pas fait. `/.well-known/` est déjà ouvert
  côté garde ; restent le keystore et `assetlinks.json`.
- ~~**Appliquer l'archive de planning**~~ — **fait le 3 septembre 2026**, voir `JOURNAL.md`.
- ~~**Alimenter `ParutionCatalogue`**~~ — **fait, et complet depuis le 9 septembre 2026** :
  **50 232 parutions, 11 315 séries, janvier 2000 → décembre 2026**, dont 48 222 avec EAN. Les
  288 fichiers anciens n'étaient pas sur une autre machine mais dans `~/Documents/planning_manga`.
  Voir `JOURNAL.md`. Restent les deux trous connus, `2000-09` et février → juillet 2024.
- **Brancher `/ajouter` et `/scanner` sur `ParutionCatalogue`** — **l'algorithme est arbitré,
  voir §4 « Rechercher — l'écran d'ajout ».** C'est le chantier suivant, et le seul qui reste
  entre la collection et une version stable de l'ajout. Aujourd'hui l'ajout passe par AniList
  seul : `tomesParus` pré-rempli
  avec le **compte japonais**, aucune couverture, aucun ISBN, aucune date, aucun thème, et
  l'éditeur comme le prix arrivent plus tard par des scripts — `goodnight-punpun`, seule série
  jamais ajoutée depuis l'application, est encore la seule sans prix, ce qui suffit à faire
  afficher `≥` devant la valeur de la collection. Le catalogue donne le nom FR, le marqueur
  d'édition, l'éditeur, la date et l'EAN, et l'EAN donne ensuite le prix par la BnF.
  **Deux règles de requête établies le 8 septembre** : une résolution par EAN rend la ligne **la
  plus récente** et non la première (5 EAN sont portés par plusieurs lignes), et tout classement
  par `numero` doit écarter les `NULL` ou demander `NULLS LAST`, 4 646 lignes de l'archive
  ancienne n'ayant pas de numéro en plus des 809 récentes.
  **La migration et le suivi étant faits, c'est le chantier suivant**, et le catalogue complété
  le 9 septembre le rend praticable : **100 % de nos ISBN y résolvent, 99 % des EAN d'une série
  possédée y sont mobilisables, et 6 023 séries y ont un tome 1 avec EAN** — voir `JOURNAL.md`,
  « Fait — l'archive de catalogue complétée jusqu'à 2000 ».
- **Dériver les `Sortie` depuis `ParutionCatalogue`** au lieu de les écrire depuis le manifeste
  de planning — le circuit visé par le plan de §13.1. Ça règle le défaut du 30 août, « le
  planning est une photographie, pas un flux » : ajouter une série calculerait ses sorties
  sur-le-champ. Demande le filtre `suivie`, donc M2 d'abord.
- **Deux trous dans l'archive, et ils sont plus petits qu'annoncé** (corrigé le 8 septembre) :
  `2000-09` (31 lignes, le plus petit mois) et **février → juillet 2024, 6 mois**. Le chiffre de
  33 mois du 3 septembre supposait le premier lot perdu ; il a été retrouvé et étendu — 29
  fichiers d'`2024-08` à `2026-12`, 8 298 lignes, mois du nom concordant avec le contenu sur les
  29, 98,8 % d'EAN livre. Sans urgence : `tomesParus` n'est jamais abaissé, les lots s'importent
  dans n'importe quel ordre, et la borne de fenêtre protège les sorties annoncées d'un import qui
  ne les couvre pas.
- **Où sont les CSV de planning** (corrigé le 9 septembre 2026). Ils ne sont pas dans le dépôt et
  ne le seront pas. **Tout est sur cette machine** : `~/Documents/planning_manga` porte les 288
  fichiers datés de janvier 2000 à janvier 2024, en `planning_YYYY-MM.csv`. Les trois dossiers
  voisins `2000-2008`, `2008-2017` et `2017-2024` sont les **téléchargements bruts** du
  2 septembre, nommés `PlanningManga_02-09-2026 (N).csv` — 291 fichiers dont `planning_manga` est
  la version renommée ; ils ne servent qu'à refaire ce renommage. Le 8 septembre les croyait sur
  un autre poste, ce qui a fait conclure à tort que le catalogue ne pouvait pas être complété
  **La casse du nom de fichier varie** — `Planning_2026-11.csv` contre `planning_2024-08.csv` :
  tout parcours du dossier doit être insensible à la casse, ce que `glob` ne garantit pas selon
  la plateforme.
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

   Les autres sont facultatives : les cinq variables `R2_*` pour déposer des couvertures — voir
   `.env.example`, et **recopier `R2_ENDPOINT` tel qu'affiché, ne pas le reconstruire** — et
   `LOCAL_DATABASE_URL` pour travailler sur un Postgres local — **elle se passe en préfixe de
   commande, jamais dans `.env`**, voir « Pièges établis » : `lib/prisma.ts` la lit aussi, donc
   elle détourne l'application entière en plus des scripts. **Aucune
   variable `R2_*` n'est à renseigner dans Vercel** : l'application ne fait que lire les URL
   absolues stockées en base. **Aucun secret n'est dans le dépôt et n'y sera jamais.**
4. `npm run dev`. **Ne pas relancer le seed** : la base Neon est remplie et fait foi, pas
   `data/collection.json` qui est figé au point zéro de l'import.

**Ce qui n'est pas dans le dépôt et qu'un poste neuf n'aura pas :**

- **Les couvertures** (`public/covers/`, ignoré). Sans objet pour l'affichage : elles sont dans
  Cloudflare R2 et la base porte leurs URL absolues. Ne les récupérer que pour en acquérir de
  nouvelles.
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
| `npm run catalogue:import <dossier>` | lit les mêmes CSV pour le **catalogue entier**, sans aucun filtre de collection — **relire `data/catalogue-controles.json`** |
| `npm run catalogue:apply` | écrit `ParutionCatalogue`. `-- --dry-run` d'abord ; `-- --recalculer` réécrit les champs dérivés depuis `titreBrut` sans retélécharger un CSV |
| `npm run covers:fetch` | acquiert les couvertures manquantes depuis MangaDex |
| `npm run covers:manuelles <dossier>` | convertit un lot fourni à la main |
| `npm run covers:upload` | dépose dans R2 et écrit `couvertureUrl`. `-- --force <slug>[:<numero>]` pour corriger, `-- --max <n>` pour relever le plafond de 150 envois |
| `npm run covers:migrate` | rebascule toutes les `couvertureUrl` vers `R2_PUBLIC_BASE`. `-- --dry-run` d'abord. Sert au jour du domaine personnalisé : sans rien à envoyer, il ne fait que réécrire |
| `npm run anilist:fetch` puis `anilist:apply` | genres et titres VO |
| `npm run publication:fetch` puis `publication:apply` | tomes parus BnF et état de parution |
| `npm run titles:fetch` puis `titles:apply` | noms de séries alignés sur la BnF |
| `npm run publishers:fetch` puis `publishers:apply` | éditeurs depuis la BnF |
| `npm run relations:fetch` puis `relations:apply` | séries liées depuis AniList |
| `npm run editions:audit` | **lecture seule** — apparie les 113 éditions au catalogue par les EAN de leurs tomes et liste les écarts de nom, d'éditeur et de tomes parus dans `data/audit-editions.json`. Aveugle sur les 23 éditions sans ISBN |
| `npm run db:migrate` | applique les migrations à Neon sur le 443. `LOCAL_DATABASE_URL` la détourne vers un Postgres local, `MIGRATIONS_DIR` vers un autre dossier — les deux servent à répéter une migration avant de la livrer |

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
- **Mise au point de la caméra du scanner — les trois pistes sont écrites, aucune n'est
  vérifiée** (9 septembre 2026). Le scan décode, mais l'autofocus ne converge pas quand le tome
  est tenu trop près : l'appareil principal d'un téléphone ne fait pas le point sous une dizaine
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
  Chrome de bureau, et il n'y a pas de caméra utile. Ce qui est vérifié, c'est la dégradation —
  sans caméra l'écran affiche sa mention, masque l'aperçu, ne montre aucun sélecteur et garde le
  champ ISBN, qui reste le chemin testé. **Le reste attend ton téléphone**, et si la netteté ne
  s'améliore pas, la question suivante est la torche : un rayon de librairie est sombre, et
  `torch` est une contrainte largement supportée sur Android.
- ~~**Sortir Blob du chemin des couvertures**~~ — **tranché le 1er septembre 2026 : Cloudflare
  R2.** La piste `public/` du dépôt est écartée : zéro opération Blob, mais 38 Mo dans git et
  autant retenu par déploiement dans *Deployment Storage*. Voir `JOURNAL.md`,
  « Tranché — Cloudflare R2 » ; la migration est faite depuis le 3 septembre. **Un second store
  Blob ne sert à rien** : la documentation est explicite, le quota est au compte, pas au store.

---

## 13. Trajectoire V2 — V3

Décisions d'architecture prises en amont, pour ne pas les découvrir en chemin.
Ce qui est ici est **tranché**. Ce qui est encore ouvert vit dans `IDEES.md`, jamais ici.

---

### 13.1 La séparation catalogue / suivi — **faite le 9 septembre 2026**

> **Ce chantier est terminé.** Les trois migrations sont appliquées à Neon, le code part de
> `SuiviEdition`, et les écrans sont vérifiés sur la production. Le détail de ce qui a tourné,
> avec les chiffres, est dans `JOURNAL.md` — « Fait — la Phase 0 », « Fait — les trois migrations
> répétées sur le banc », « Fait — la Phase 2 éprouvée sur le banc ».
>
> **Ce qui suit reste écrit au futur, et c'est volontaire.** C'est le raisonnement qui a produit
> le chantier : ce qui a été écarté, pourquoi `aVerifier` a été supprimé plutôt que déménagé,
> pourquoi `suivie` remplace `termineeForcee` et non l'inverse, quelle formule de backfill a été
> retenue et laquelle a été rejetée. Le réécrire au passé le rendrait plus court et beaucoup
> moins utile : une session qui rouvrira ces choix a besoin des motifs, pas du résultat, qui est
> déjà lisible dans le schéma. **Ne pas s'y fier pour l'état de la base** — §12 fait foi.
>
> Ce qui a été livré, en une ligne : `Utilisateur`, `SuiviEdition`, `Serie.alias` avec son index
> GIN, `Edition.creeeParId`, `Possession` par compte avec `@@unique([utilisateurId, volumeId])`,
> et cinq colonnes personnelles sorties d'`Edition`. Le critère de fin de §13.1 est atteint :
> **plus rien de ce qui déplace des lignes existantes ne reste à faire.**

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
              statut, suivie, ajouteeLe)
Possession   (id, utilisateurId, volumeId, possede, dateAchat,
              prixPayeCentimes, etat, lu, note, varianteId)
```

`statut` et `ajouteeLe` **quittent `Edition`**, et `termineeForcee` la quitte aussi mais sous un
autre nom et en sens inverse : il devient **`suivie`** — voir « `suivie` remplace
`termineeForcee` » ci-dessous. `aVerifier` et `raisonCompletion` n'entrent dans la table ni sous
leur nom ni sous un autre : ils sont **supprimés**, pas déménagés. `ajouteeLe` ne figurait dans
aucune des deux listes ; c'est un oubli, corrigé ici.

La wishlist (§ Reste à faire) est une donnée de suivi, pas de catalogue : une série
convoitée par l'un et possédée par l'autre est la même `Edition` avec deux `SuiviEdition`.
**La construire avant la séparation reviendrait à la coder deux fois.**

En V1, `SuiviEdition` existe avec un `utilisateurId` en dur. Aucun écran ne bouge.

#### `Serie.alias`

Liste de chaînes indexée : titre VF, titre VO, romanisations, abréviations connues.
Amorcée avec `titreVo`, déjà renseigné sur 104 séries.

Coût nul aujourd'hui. C'est la brique sur laquelle repose toute la recherche V3 — sans elle,
« JJK » ou « aot » ne trouvent rien, et **aucune distance de chaînes ne rattrape ça**.

#### Le plan d'exécution, arrêté le 4 septembre 2026

Rédigé sur un poste où **les migrations ne seront pas jouées** : elles le seront ailleurs. Ce
qui suit est donc écrit pour être exécuté par une session qui n'aura pas assisté à la
discussion. Les chiffres sont mesurés sur la base réelle le 4 septembre, pas repris du document.

**`aVerifier` ne déménage pas : il disparaît.** §13.1 le rangeait dans `SuiviEdition`, §13.2
s'en servait comme drapeau de catalogue — les deux ne pouvaient pas être la même colonne.
L'arbitrage supprime la question : le drapeau est un **artefact de l'import du Sheet de 2026**,
qui attribuait les N premiers tomes faute de savoir lesquels étaient possédés. Un nouvel
utilisateur saisit ses séries à la main par l'écran Ajouter et coche ses propres tomes : il n'a
aucune répartition devinée. Le concept n'a donc pas à exister pour tout le monde.

Conséquences à tenir :
- **`SuiviEdition` ne porte pas de `aVerifier`** ni d'équivalent renommé.
- ~~**Les 12 éditions encore marquées sont un reliquat du propriétaire**, à relire avant la
  migration~~ — **relues le 9 septembre 2026**, `aVerifier` est à 0 et la colonne peut mourir
  sans rien emporter. Le bouton « Répartition vérifiée » de la sous-page « Mes tomes » a servi à
  ça, et il a été **supprimé** avec la colonne.
- ~~**Le critère de tri « À vérifier en premier » disparaît**~~ — **supprimé le 9 septembre**,
  ainsi que le badge de la page Édition et l'icône de la Collection et des Manquants. C'était
  bien le seul effet visible du côté `aVerifier` ; celui de `suivie` est la disparition de la
  section repliée des Manquants.
- Le besoin de §13.2 — relire une fiche ajoutée par un tiers — survit, mais sous un autre nom
  et sur `Edition`, adossé à `creeePar`. **Ne pas le rappeler `aVerifier`** : c'est ce nom
  unique pour deux sens qui a produit la contradiction.

##### `suivie` remplace `termineeForcee` — arbitré le 8 septembre 2026

Proposé le 4 septembre dans `IDEES.md`, tranché ici — la section y a donc été retirée, seule sa
trace de sortie y reste. Les chiffres sont mesurés sur la base réelle le 8 septembre.

**Le reproche fait à `termineeForcee` est qu'il mélange deux choses** : c'est un *jugement sur
la collection* — « je considère cette série finie » — dont l'effet est de *masquer une liste de
courses*. Or on peut vouloir les deux séparément. AIR GEAR est le cas : le drapeau a été retiré
volontairement pour retrouver ses 5 tomes manquants dans Manquants, au prix du libellé
« Terminée par choix ». Le modèle ne savait pas dire « je considère la série finie **et** je veux
ces tomes », il a fallu le détourner. D.Gray-man est l'autre face : 25/29, trous aux tomes 9, 10,
13 et 18, parution en cours — suivi de près côté nouveautés, troué au milieu.

**`suivie` ne répond qu'à une question : est-ce que je veux être rappelé de ce qui manque ?** Il
ne prétend rien sur l'état de la collection, et c'est ce qui le rend lisible. Il ne remplace pas
`statut`, qui reste le rapport personnel et continue de piloter le libellé et la désaturation.

| Possédés | `suivie` | Manquants | Planning | Où la série vit |
|---|---|---|---|---|
| ≥ 1 | oui | les trous | les sorties | Collection |
| ≥ 1 | non | rien | rien | Collection |
| 0 et `statut = VENDUE` | non | rien | rien | Collection, section « Vendues » |
| 0 | oui | **rien** | **rien** | **Wish list** |

**Une série possédée est suivie par défaut**, donc `@default(true)` : c'est l'état d'une série
qu'on vient d'ajouter, et ajouter une série veut dire qu'on la suit. **Une série reste dans la
Collection tant qu'elle a des tomes possédés ou en a eu** — la troisième ligne du tableau est
cette règle, et `statut = VENDUE` en est aujourd'hui le seul porteur.

**Résidu connu, laissé ouvert** : « en a eu » n'est enregistré nulle part. Mesuré le 8 septembre,
**aucune des 1 714 possessions ne porte `dateAchat` ni `prixPayeCentimes`**, et les 559 lignes à
`possede=false` ne distinguent pas « jamais eu » de « revendu ». Ça ne gêne pas aujourd'hui — les
**4 seules éditions à zéro tome possédé sont exactement les 4 `VENDUE`** — mais le jour où une
édition tombe à zéro sans être marquée vendue, rien ne la sépare d'une entrée de wish list, et la
trace ne se reconstitue pas après coup. Une colonne `aDejaPossede` sur `SuiviEdition` la
capturerait, backfillée `possédés ≥ 1 OR statut = VENDUE` ; c'est un **ajout**, donc sans
pénalité plus tard au sens du critère de fin de §13.1 — mais son backfill n'est exact
qu'aujourd'hui.

**L'appartenance à la wish list est déduite, jamais stockée** :
`possédés = 0 ET suivie ET statut ≠ VENDUE`. Cocher un tome fait basculer en Collection,
décocher le dernier ramène en wish list. Aucun champ à maintenir, aucun état à désynchroniser.
Conséquence mécanique à connaître : **une série créée par `/ajouter` atterrit en wish list**,
puisqu'elle naît à zéro tome possédé, et n'entre en Collection qu'au premier tome coché. Par
`/scanner` elle entre directement en Collection, le tome scanné étant marqué possédé.

**Backfill : `suivie = (statut = 'EN_COURS' AND termineeForcee = false)`.**

| | |
|---|---|
| `EN_COURS` non forcée → suivie | **84** |
| `EN_COURS` forcée — `judge`, `nozokiana` → non suivie | 2 |
| `ABANDONNEE` → non suivie | 18 |
| `EN_PAUSE` → non suivie | 5 |
| `VENDUE` → non suivie | 4 |

Cette formule a la propriété qu'on cherche : **elle ne change rien à Manquants**, dont la liste
principale correspond déjà à « `EN_COURS` non forcée ». Le seul changement visible est le
**Planning qui perd ses 4 sorties fantômes** — `one-puch-man`, `les-legendaires-saga`,
`why-nobody-remember-my-world`, `blue-exorcist` — c'est-à-dire la correction du défaut relevé le
4 septembre. Une reprise qui ne casse rien, ajustable ensuite d'un tap. Et AIR GEAR devient
`suivie = true`, ce qui est exactement l'intention d'origine, obtenue sans détourner un drapeau.

**Écartée : `suivie = true` sur les 109 éditions non vendues.** C'est la lecture littérale de
« une série possédée est suivie », mais appliquée au backfill elle remet 19 éditions et 320 tomes
dans Manquants — l'état que le 4 septembre a jugé mauvais, où 72 % de l'écran était des séries
qu'on a arrêté d'acheter — et imposerait 23 dé-suivis à la main.

**Ce que ça unifie.** Trois mécanismes cachent aujourd'hui des choses de Manquants —
`termineeForcee`, `statut = VENDUE`, et la section repliée « Abandonnées et en pause » — et aucun
ne touche le Planning. Un seul filtre les remplace, **sur les deux écrans**. La section repliée
disparaît : si on ne veut pas les voir, on ne les suit pas. Ça retire `Manquants.arretees` du
domaine et libère le motif `CollapsibleSection` sur cet écran.

**`raisonCompletion` meurt avec `termineeForcee`.** Elle n'entre pas dans `SuiviEdition`. Mesuré
le 8 septembre : **3 éditions la portent — `judge`, `nozokiana`, `air-gear` — avec le même texte
d'import** (« Reprise du Google Sheet : marquee FINI malgre des tomes manquants »), aucun écran
ne l'affiche, et celle d'AIR GEAR est périmée depuis que son drapeau a été retiré. Un champ
libre « pourquoi j'ai arrêté de suivre » reste possible plus tard ; ce serait une colonne neuve,
pas celle-là. Le texte survit dans `data/backup.json` et le commit tagué de la Phase 0.

**`ajouteeLe` est une cinquième colonne personnelle**, absente des deux listes de §13.1. Le tri
« Ajout récent » veut dire *ajoutée à ma collection*, pas *entrée au catalogue*. Elle part dans
`SuiviEdition`.

**`SuiviEdition` est la table d'appartenance, pas un sac de colonnes.** Aujourd'hui « ma
collection » = les 113 `Edition`, parce qu'il n'y en a qu'une. Après, `Edition` est un catalogue
partagé et ma collection est **ce pour quoi j'ai une ligne `SuiviEdition`**. Sans ça,
`chargerCollection` rend le catalogue entier à tout le monde et la séparation est cosmétique.
Donc `chargerCollection` et `chargerManquants` s'inversent : on part de `SuiviEdition` et on
joint `Edition`. La wishlist en découle gratuitement — un `SuiviEdition` sans possession — et
c'est pourquoi **elle se construit après, jamais avant**.

**L'invité n'a pas de compte**, donc pas de `SuiviEdition` : sans décision son écran serait
vide. `utilisateurCourant()` doit le résoudre vers **l'id du propriétaire, en lecture seule**.
Une ligne, mais l'oublier casse l'écran invité en silence.

**`Possession` : la contrainte `volumeId @unique` est l'hypothèse mono-utilisateur rendue
physique.** Elle saute pour `@@unique([utilisateurId, volumeId])`, et `Volume.possession` (1-1)
devient `Volume.possessions` (1-N) — **19 sites de lecture** dans `lib/editions.ts`,
`lib/actions.ts`, `lib/creation.ts`, `lib/promotion.ts`. C'est là qu'est le risque, pas dans le
SQL.

**Les lignes deviennent creuses.** Aujourd'hui 1 712 possessions pour 1 712 volumes, dont 559 à
`possede=false` : du remplissage. Les pré-créer par compte ferait 1 712 lignes par utilisateur et
obligerait `apply-planning.ts` et `apply-publication.ts` à ventiler chaque nouveau tome sur tous
les comptes. Une ligne signifiera « j'ai dit quelque chose sur ce tome ».
**Piège à tenir : absence et `possede=false` deviennent deux écritures du même fait.** On garde
`possede` — il faut pouvoir dire `lu=true, possede=false`, ce qui est exactement le cas AIR GEAR /
JUDGE / NOZOKIANA — mais la lecture doit traiter les deux à l'identique, par un seul helper.
**Ne pas supprimer les 559 lignes existantes** : la lecture doit gérer l'absence de toute façon
pour les nouveaux comptes, donc les effacer n'achète rien et ajoute une étape destructive.

**`Utilisateur` se crée maintenant, pas en V2.** §13.4 dit déjà « prévoir l'état de paiement dès
la création de la table ; une colonne de plus coûte zéro ». Le même raisonnement vaut un cran
plus haut : la créer plus tard obligerait à réécrire 1 712 `utilisateurId` et 113 `SuiviEdition`
d'une chaîne magique vers une vraie clé étrangère — précisément le coût que §13.1 veut éviter.
L'authentification, elle, ne bouge pas : mot de passe partagé, jetons HMAC inchangés.
**L'invité n'est pas une ligne `Utilisateur`** : il reste un rôle de jeton.

##### Le schéma cible

```prisma
enum RoleUtilisateur { PROPRIETAIRE  UTILISATEUR }

model Utilisateur {
  id     String   @id @default(uuid())
  email  String?  @unique          // nullable : voir plus bas, le depot est public
  nom    String?
  role   RoleUtilisateur @default(UTILISATEUR)
  aPaye  Boolean  @default(false)  // §13.4
  creeLe DateTime @default(now())
}

model SuiviEdition {
  id            String   @id @default(uuid())
  utilisateurId String   // FK Utilisateur, onDelete: Cascade
  editionId     String   // FK Edition,     onDelete: Cascade
  statut        StatutEdition
  suivie        Boolean  @default(true)
  ajouteeLe     DateTime @default(now())

  @@unique([utilisateurId, editionId])
  @@index([utilisateurId])
  @@index([utilisateurId, suivie])
}
```

L'index `[utilisateurId, suivie]` par le même raisonnement que `[utilisateurId, possede]` sur
`Possession` : Manquants et Planning filtrent tous deux sur `suivie`, et ils partent désormais de
`SuiviEdition`.

`Edition` **perd** `statut`, `termineeForcee`, `raisonCompletion`, `aVerifier`, `ajouteeLe`, et
**gagne** `creeeParId String?` (`onDelete: SetNull`, null = venu de l'import).
`Possession` **gagne** `utilisateurId`, **perd** `volumeId @unique`, **gagne**
`@@unique([utilisateurId, volumeId])` et `@@index([utilisateurId, possede])` — l'index sur
`possede` seul ne sert plus à rien.
`Serie` **gagne** `alias String[] @default([])`, amorcé depuis `titreVo` (**105** séries, pas 104).

##### Les trois migrations

Écrites **à la main** : le port 5432 est toujours bloqué sur le poste professionnel (vérifié le
4 septembre, le 443 passe), donc `prisma migrate dev` ne peut pas atteindre Neon. Sur un poste
au réseau ordinaire la contrainte tombe — mais `apply-migrations.ts` reste valable partout, et
il joue **chaque fichier dans une transaction** : backfill et `DROP COLUMN` sont donc atomiques
ensemble, ce qui évite toute fenêtre où les deux emplacements coexistent.

L'id du propriétaire est **un UUID littéral figé dans le SQL**, généré une fois : c'est une
migration ponctuelle, elle doit être déterministe. `gen_random_uuid()` est natif (Neon est en
PostgreSQL 18.6), aucune extension à activer.

**Ne pas écrire l'email dans la migration.** Le dépôt est public (§7) ; la ligne `Utilisateur`
se crée avec `email` nul, la vraie adresse arrive avec l'identité en V2 et n'entre jamais dans
le dépôt.

1. `..._utilisateurs_et_alias` — `Utilisateur`, l'enum, la ligne du propriétaire, `Serie.alias`
   + son index GIN en SQL brut. **Purement additive, l'application n'y touche pas.**
2. `..._suivi_edition` — création, backfill depuis `Edition`, puis `DROP` des 5 colonnes.
   **Le backfill inverse `termineeForcee` en `suivie`** — `statut = 'EN_COURS' AND
   termineeForcee = false`, arbitré le 8 septembre, voir ci-dessus. C'est le seul instant où les
   deux colonnes coexistent, d'où l'obligation de le faire ici : après le `DROP`, il faudrait une
   seconde migration sur la même colonne. `raisonCompletion` et `aVerifier` ne sont pas reprises.
3. `..._possession_par_compte` — `utilisateurId` ajouté, rempli, passé `NOT NULL`, échange des
   index (`Possession_volumeId_key` → `Possession_utilisateurId_volumeId_key`), FK posée.

**Trois migrations séparées, un seul déploiement.** Chacune s'écrit et s'éprouve isolément ; les
trois partent ensemble avec le code. Sinon la production lit des colonnes disparues entre deux
poussées.

**Piège de dépôt** : `npm run build` enchaîne `db:migrate`. Des fichiers déposés dans
`prisma/migrations/` sont appliqués **au prochain déploiement Vercel**, sans le code
correspondant. Tant que le code n'est pas prêt, les garder hors de ce dossier.

##### L'ordre d'exécution

**Phase 0 — prérequis, avant toute migration**
1. ~~Corriger l'effacement d'`aVerifier`~~ — **fait le 4 septembre**, voir `JOURNAL.md`.
2. ~~Trancher AIR GEAR~~ — **il n'y a rien à trancher (4 septembre)**. La base dit
   `termineeForcee=false` là où §3 le compte parmi les 3 forcées, et j'ai d'abord cru à une
   écriture accidentelle pendant le test de `/etat` fin août. **C'est volontaire** : le drapeau
   a été retiré pour retrouver les 5 tomes manquants dans Manquants. La donnée est juste, c'est
   le modèle qui ne sait pas exprimer « je considère la série finie **et** je veux ces tomes ».
   Seule sa `raisonCompletion` est périmée, et elle n'est affichée par aucun écran.
   **Ce constat a ouvert le remplacement de `termineeForcee` par `suivie`, arbitré le
   8 septembre — voir « `suivie` remplace `termineeForcee` » ci-dessus.**
3. ~~`npm run db:backup`, commit, et taguer ce commit~~ — **fait le 9 septembre 2026**, tag
   **`avant-multi-compte`** sur le commit « Rafraichir la sauvegarde avant la migration
   multi-compte ». C'est le seul chemin de retour, et il porte l'ancien `backup-db.ts`, seul
   capable de relire ce `backup.json` — la Phase 2 fait passer ses compteurs de 8 à 7.
4. ~~Relire les 12 éditions encore marquées `aVerifier`~~ — **fait le 9 septembre 2026**,
   `aVerifier` est à **0** sur les 113 éditions et aucune répartition n'a eu besoin d'être
   corrigée : 1 155 possédés avant comme après. La colonne meurt avec la migration 2 et la
   répartition devinée ne se rattrape pas après coup, d'où l'insistance. Voir `JOURNAL.md`,
   « Fait — la Phase 0 du passage au multi-compte ».

**Phase 1 — la répétition sur données réelles.** ~~Le banc existe depuis le 30 août~~ —
**répétition faite le 9 septembre 2026, les trois migrations passent et les contrôles ci-dessous
tombent tous juste.** Voir `JOURNAL.md`, « Fait — les trois migrations répétées sur le banc ».

Le SQL vit dans **`prisma/pending-migrations/`**, volontairement **hors de
`prisma/migrations/`** : `npm run build` enchaîne `db:migrate`, donc un fichier déposé dans le
dossier normal partirait au prochain déploiement Vercel sans le code de la Phase 2. Le
déplacement des trois dossiers est le dernier geste du chantier, pas le premier.

Le banc se remonte ainsi : `npx prisma dev -d -n manga` rend une URL, puis
`LOCAL_DATABASE_URL` la porte pour `npm run db:migrate` (les 5 migrations existantes),
`db:backup -- --restore --reset` (la copie fidèle) et enfin `MIGRATIONS_DIR=prisma/pending-migrations
npm run db:migrate` (les trois nouvelles). **Ne pas mettre `LOCAL_DATABASE_URL` dans `.env`** —
`backup-db.ts` s'en sert pour choisir sa cible, et une sauvegarde suivante irait silencieusement
frapper le banc au lieu de Neon. La passer en préfixe de commande.

Deux propriétés du banc à connaître : **`prisma dev` rend une URL sur `template1`**, donc toute
base créée ensuite hérite du schéma et du `_prisma_migrations` d'un banc précédent — la
répétition du 9 septembre n'a rejoué que 4 des 5 migrations existantes pour cette raison, sans
conséquence. Et il tourne en **PostgreSQL 17.5 (wasm)** là où Neon est en 18.6.

Contrôles à l'arrivée :

| Attendu après migration |
|---|
| `SuiviEdition` = 113, toutes sur l'id propriétaire |
| statuts préservés : `EN_COURS=86 ABANDONNEE=18 EN_PAUSE=5 VENDUE=4` |
| `suivie=true` = **84**, et aucune sur un `statut` ≠ `EN_COURS` |
| `SuiviEdition` sans colonne `raisonCompletion` ni `aVerifier` |
| `Possession` = **1 714**, toutes sur l'id propriétaire, **1 155** à `possede=true` |
| `Serie.alias` renseigné sur 105 · `Edition` sans les 5 colonnes |

**Les deux compteurs de `Possession` bougent tout seuls** — la promotion des sorties échues crée
des tomes, donc des possessions. Ceux ci-dessus sont relevés le 9 septembre 2026 ; le contrôle se
fait contre le `compteurs` de `data/backup.json` fraîchement écrit, pas contre ce tableau, sinon
il échoue à faux. Les cinq autres lignes, elles, sont stables : rien n'ajoute ni ne retire une
édition sans intervention.

**Trois contrôles ajoutés le 9 septembre, parce qu'un compteur juste ne prouve pas une
contrainte.** Ils sont passés sur le banc, dans une transaction annulée ensuite :

| Attendu, éprouvé par écriture réelle |
|---|
| deux comptes possèdent le **même** `volumeId` — l'ancien `volumeId @unique` est bien mort |
| un second `(utilisateurId, volumeId)` identique est **refusé** par la nouvelle contrainte |
| supprimer un compte emporte ses `Possession` et ses `SuiviEdition`, et **laisse les 1 714 du propriétaire intactes** |

Et le contrôle qui vaut pour l'écran : **4 sorties portent sur des éditions non suivies**, et ce
sont exactement `blue-exorcist`, `les-legendaires-saga`, `one-puch-man` et
`why-nobody-remember-my-world` — les quatre fantômes du Planning relevés le 4 septembre. La
formule de backfill fait donc bien ce que §13.1 avait prédit.

**Phase 2 — le code**, ~~dans cet ordre~~ — **faite le 9 septembre 2026, avec un changement
d'ordre.** Le point 4, `backup-db.ts`, a été traité **en deuxième** et non en quatrième : le
filet doit exister avant qu'on touche aux écrans, pas après. La liste ci-dessous est celle qui
avait été prévue.
1. `lib/utilisateur.ts` — `utilisateurCourant()`, **invité résolu vers le propriétaire en
   lecture**. Posé seul d'abord, sans changer un écran.
2. `lib/editions.ts` — l'inversion `Edition` → `SuiviEdition`, et `possession` → `possessions[0]`
   derrière un helper unique.
3. `lib/actions.ts`, `lib/creation.ts`, `lib/promotion.ts` — `upsert` sur
   `utilisateurId_volumeId` ; `creerSerieAvecEdition` crée aussi le `SuiviEdition`.
4. `scripts/backup-db.ts` — **le filet doit couvrir la nouvelle forme avant qu'on en ait
   besoin.** L'export ne peut plus nicher la possession sous le volume, et `compter()` lit
   `aVerifier` et `forcees` sur `Edition`. **Les compteurs passent de 8 à 7** : `aVerifier`
   disparaît et `forcees` devient `suivies`, qui s'inverse — donc l'ancien `backup.json` ne se
   relit **qu'avec l'ancien script**, ce que la Phase 0 prévoit en taguant son commit. Le
   contrôle de restauration échoue sur toute divergence de compteur : le mettre à jour dans le
   même geste, sinon plus aucune restauration ne passe.
5. `prisma/seed.ts` et les `apply-*.ts` — les scripts de catalogue cessent de créer des
   possessions.

**Phase 3 — vérification fonctionnelle**, pas seulement des compteurs. Le document en a la
leçon quatre fois : cliquer pour de vrai, puis regarder l'écran **et** la base.

**Faite le 9 septembre 2026, en deux temps.** D'abord sur le banc — `lib/prisma.ts` sait viser
un Postgres local quand `LOCAL_DATABASE_URL` est présente, ce qui permet d'éprouver les écrans
**sans toucher à Neon** ; quatre écritures réelles, chacune recontrôlée en base. Puis sur la
production après migration. Le filet a été éprouvé **dans les deux sens** : sauvegarde de Neon,
restauration complète sur le banc, sept compteurs concordants. Deux chemins restent non
vérifiés, `creerSerieAvecEdition` et le mode invité — voir « Reste à faire ».

##### Le Planning et les sorties — arrêté le 4 septembre 2026

Manquait au premier jet de ce plan, relevé à la relecture : `chargerPlanning()`
(`lib/editions.ts`) fait un `prisma.sortie.findMany()` **sans aucun filtre**. Ça tenait parce
qu'il n'y a qu'une collection ; à plusieurs, chacun verrait les sorties des séries des autres.
Il subit donc la même inversion que la Collection et les Manquants : les sorties **des éditions
pour lesquelles j'ai un `SuiviEdition`**.

**Deux tables, deux rôles, aucune redondance.**

| | `ParutionCatalogue` | `Sortie` |
|---|---|---|
| Contenu | toute l'archive manga-news, 2000 → aujourd'hui | les annonces d'une édition qui existe |
| Clé étrangère | aucune | `editionId` |
| Rétention | **jamais purgée** | **glissante, M-1 → M+6** |
| Porte | EAN, titre brut, éditeur, date | + la couverture, + la promotion en tome |
| Volumétrie visée | ~59 000 lignes, ~25 Mo | quelques centaines |

**L'import cesse de se limiter aux séries possédées** — révision de la décision du 30 août,
voir §13.2. Le circuit devient : CSV → `ParutionCatalogue` en entier → **dérivation** des
`Sortie` pour les éditions qui existent, dans la fenêtre.

**La fenêtre de 7 mois porte sur `Sortie`, jamais sur `ParutionCatalogue`.** Purger l'archive
supprimerait la résolution ISBN → série, c'est-à-dire ce qui a fait passer le scanner de 9,2 %
à 87 % le 3 septembre. L'archive garde tout ; c'est la fenêtre de travail qui glisse. Le chiffre
de 6 mois d'avance est un point de départ, à relever si les annonces lointaines se révèlent
fiables.

**Conséquence sur le cron, à assumer.** Il promeut aujourd'hui dès que le mois est clos ; garder
un mois de retard veut dire qu'un tome sorti le mois dernier reste au Planning au lieu de
basculer dans Manquants. C'est le bon compromis : il y est avec son bouton « Je l'ai », et le
motif du 30 août le justifie — « les dates manga-news glissent, un tome annoncé le 3 peut
arriver le 12 ». Le mois de grâce sert exactement à ça.

**Ce que la dérivation débloque** : quand quelqu'un ajoute une série, ses `Sortie` se calculent
**sur-le-champ** depuis `ParutionCatalogue`, sans attendre le prochain import. C'est ce qui
règle le défaut noté le 30 août — « le planning est une photographie, pas un flux ».

**« Je l'ai » est à cheval sur les deux mondes, et l'autorisation vient de la date, pas du
rôle.** `promouvoir()` crée le `Volume`, incrémente `tomesParus` et supprime la `Sortie` — du
catalogue, visible de tous — puis pose *ma* possession. §13.2 réserve pourtant « modifier les
tomes parus » au propriétaire. La contradiction se lève en voyant que **ce n'est pas une
modification éditoriale mais l'enregistrement d'un fait** : le tome est paru. `promouvoirSortie`
refuse déjà une date future côté serveur, et le cron fait la même chose sans personne derrière.
Effet assumé : quand l'un clique, la sortie quitte le Planning de l'autre et le tome entre dans
ses Manquants — ce qui est correct, le tome est bien sorti.

##### Une décision d'écran que le schéma force

Une page `/edition/<slug>` **hors de ma collection** devient possible — le cas n'existe pas
aujourd'hui. 404, ou affichage catalogue avec un bouton « Ajouter à ma collection » ? Le second
est la porte d'entrée dont §13.2 a besoin, mais rien ne presse tant qu'il y a un compte.

##### Hors périmètre de ce chantier

L'identité réelle (lien magique, OAuth) reste l'ouverture de la V2 : ce plan pose seulement la
table pour qu'elle arrive sans migration de données. `VarianteVolume` est un ajout, pas un
déplacement de colonnes, donc sans pénalité plus tard. Le rôle `UTILISATEUR` est porté par la
table mais `exigerProprietaire` ne change pas tant qu'il n'y a qu'un compte.

##### Le critère : anticiper ce qui déplace, jamais ce qui ajoute

Question posée le 4 septembre — faut-il faire entrer les prochaines fonctionnalités dans ce
rework, ou l'ajout au fil de l'eau suffit-il ? Le critère est déjà en tête de §13.1 et il est le
bon : **ce qui déplace ou réinterprète des lignes existantes coûte de plus en plus cher ; ce qui
ajoute une table ou une colonne coûte pareil aujourd'hui et dans un an.**

Entre donc dans ce chantier, et rien d'autre :

| | Pourquoi maintenant |
|---|---|
| `SuiviEdition`, `Possession.utilisateurId` | déplacent des colonnes et une contrainte d'unicité |
| La table `Utilisateur` | créée plus tard, elle obligerait à réécrire 1 712 + 113 clés étrangères depuis une chaîne magique |
| `Utilisateur.aPaye` | §13.4 : une colonne de plus coûte zéro, une migration sur des comptes existants non |
| `Edition.creeeParId` | ajoutée plus tard, `null` ne voudrait plus dire « venu de l'import » — on ne saurait plus distinguer l'import d'un ajout antérieur à la colonne |
| `Serie.alias` | amorcé depuis `titreVo`, qui est renseigné maintenant |

Attend, sans pénalité : `VarianteVolume`, la wishlist, l'identité réelle, le drapeau de
relecture de catalogue de §13.2, les statistiques, le nettoyage des thèmes.

**La wishlist mérite une nuance** : elle est *cheap* en schéma mais §13.1 dit de la construire
**après** la séparation, sinon elle se code deux fois. Ce n'est pas une exception au critère,
c'est le même critère vu du code.

**Piège concret sur les enums, à connaître avant d'y toucher.** Si la wishlist passe par une
valeur `SOUHAITEE` de `StatutEdition`, `apply-migrations.ts` enveloppe chaque fichier dans une
transaction, or PostgreSQL interdit d'**utiliser** une valeur d'enum dans la transaction qui
l'ajoute. Une migration qui ferait `ALTER TYPE … ADD VALUE` puis un `UPDATE` s'en servant
échouerait. Il faut deux migrations, ou une colonne booléenne.

**Et le vrai coût de ce chantier n'est pas le schéma, ce sont les 19 sites de lecture.** Une fois
`possessions` passé en 1-N et les écrans partis de `SuiviEdition`, ajouter une fonctionnalité
redevient bon marché. C'est précisément ce rework qui rend l'ajout au fil de l'eau viable —
raison de plus pour ne pas y empiler ce qui peut attendre.

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

L'ajout est **libre et immédiatement visible de tous**, avec `creeePar` renseigné et un drapeau
de relecture levé jusqu'à validation par le propriétaire.

Écarté : l'ajout privé jusqu'à validation (deux visibilités, donc une condition dans
toutes les requêtes du catalogue) et l'ajout libre sans garde-fou (dégradation silencieuse).

**Ce drapeau n'est pas `aVerifier` et ne doit pas en reprendre le nom** (arbitré le 4 septembre,
voir §13.1). `aVerifier` disait « la répartition de mes tomes a été devinée » — une donnée
personnelle, issue de l'import du Sheet, dont la source est morte le 8 septembre avec la décision
qu'il n'y aura plus d'import de collection. Le drapeau dont §13.2 a besoin dit « cette fiche de
**catalogue** n'a pas été relue » : il est partagé, il vit sur `Edition` aux côtés de `creeePar`,
et c'est un champ **neuf**. C'est ce nom unique pour deux sens qui avait produit la contradiction.

**Et il est moins nécessaire qu'il n'y paraît.** La qualité d'une fiche se joue à la saisie, pas
à la relecture : la porte d'ajout est `/ajouter` et `/scanner`, adossés à `ParutionCatalogue`, qui
portent le vrai nom FR, le marqueur d'édition, l'éditeur et l'EAN. Améliorer la porte vaut mieux
que marquer ce qui passe. À rouvrir quand il y aura un second compte, pas avant.

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
et EAN-13 inclus, et le rendement ne se dégrade pas avec l'ancienneté. Voir `JOURNAL.md`,
« Établi — les archives de planning », pour les mesures et le plancher recommandé. Un ordre de grandeur
à corriger au passage : le marché faisait 31 sorties par mois en 2000 contre 292 aujourd'hui,
et l'interpolation sur les cinq points mesurés (31 · 142 · 168 · 201 · 292) donne **~59 000
lignes pour 26 ans**, pas 36 000 pour dix ans.

##### Confirmé le 4 septembre 2026 : le catalogue reste dans `ParutionCatalogue`

Deux décisions prises ce jour-là, l'une révisant le 30 août.

**L'import ne se limite plus aux séries possédées.** Le 30 août avait tranché l'inverse —
« `import_planning.py` n'en retient que celles qui s'apparient à une édition possédée…
l'application suit une collection, pas un catalogue ». À plusieurs comptes, « la collection »
n'existe plus au singulier : un ami ajoute une série et son planning resterait vide jusqu'au
prochain import manuel. L'import garde donc **toute** ligne de l'archive, et c'est l'écran qui
filtre sur la collection de celui qui regarde.

**« Toutes les séries en base » veut dire `ParutionCatalogue`, pas 5 892 `Serie`.** La question
s'est reposée le 4 septembre ; la décision du 2 septembre tient, et pour des raisons mesurées,
pas de principe.

Le stockage ne départage pas : la base fait **9,7 Mo** et une ligne `Volume` coûte **459 octets**
index compris (mesuré le 4 septembre). Consolider les 5 892 séries pèserait ~29 Mo, les garder
en parutions ~25 Mo — les deux tiennent dans le demi-Go, avec la même marge. Ce qui départage
est ailleurs, et il y a un obstacle bloquant :

- **`Serie.auteur` est `NOT NULL` et le CSV manga-news ne porte pas d'auteur** — seulement
  `Titre, Éditeur, EAN, Date`. Créer 5 892 séries demanderait un auteur factice sur chacune, ou
  de rendre la colonne nullable, ce qui casserait le garde-fou par auteur dont dépendent
  `fetch_publishers.py` et `fetch_titles.py`.
- **L'enrichissement ne suit pas.** AniList plafonne à 28 requêtes/minute, soit ~3 h 30 pour
  5 892 séries — mais surtout, sur 108 séries il a fallu **22 entrées manuelles** dans
  `RECHERCHES_MANUELLES` plus 4 abandons. Au prorata, de l'ordre de **1 200 corrections à la
  main**. Ce n'est pas faisable.
- **La déduplication se paierait d'avance et mal**, alors que la forme de la table permet
  justement de ne la payer qu'à l'adoption d'une série, un cas à la fois.

Ce n'est pas un renoncement : `ParutionCatalogue` **est** « toutes les séries en base » —
interrogeables, avec leur EAN, leur nom FR et leur marqueur d'édition. La consolidation en
`Serie` / `Edition` / `Volume` reste possible plus tard, l'archive étant une copie fidèle
recalculable.

**Ce que ça impose au chantier multi-compte.** Trois requêtes tiennent aujourd'hui parce que la
base est petite et ne tiendraient plus face à un vrai catalogue :
`chargerCollection` (`findMany` sur toutes les éditions avec tous leurs volumes),
l'anti-doublon de `rechercherSeries` (charge tous les titres de série),
et `resoudreIsbn` (charge toutes les éditions pour apparier un titre).
L'inversion par `SuiviEdition` borne la première quoi qu'il arrive ; **les deux autres doivent
passer par un index** et ne peuvent pas rester en l'état.

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
`JOURNAL.md`, « Tranché — Cloudflare R2 ». **La migration est faite depuis le 3 septembre 2026.**

#### Filtres : genres seulement

Les genres viennent de la liste fermée d'AniList depuis le 30 août — normalisés, filtrables.
Les **thèmes ne sont pas filtrables** : 99 valeurs françaises avec les coupures d'import
documentées (`Post` + `apo`, `Super` + `héros`, `Combats` / `Combat`).

Un filtre « apo » exposé à un utilisateur tiers est indéfendable. Le nettoyage des thèmes
attend un écran qui les affiche.

**La table de correspondance d'affichage se pose avant le filtre, pas après.** Les 19 genres
sont stockés en anglais — c'est la clé, elle ne se traduit pas en base — mais l'interface est en
français : un filtre livré tel quel afficherait « Slice of Life » et « Supernatural » au milieu
d'un écran français. Le sens de la correspondance est donc **stockage anglais → libellé
français à l'affichage**, comme `.titre-serie` rend les capitales sans les écrire en base
(§ « Fait — les titres alignés sur leur nom français » dans `JOURNAL.md`). Relevé en revue
d'architecture le 31 août 2026, encore à faire.

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

Trois fichiers, trois statuts. Les confondre donnerait à une intuition le même poids qu'à une
décision, et une session future ne saurait plus ce qui fait foi.

| Fichier | Ce qu'il porte |
|---|---|
| **`CLAUDE.md`** | la spécification, les décisions **tranchées**, le travail restant. Fait foi |
| **`JOURNAL.md`** | ce qui est **déjà fait**, daté, avec les chiffres et les causes. Fait foi sur l'état |
| **`IDEES.md`** | les envies **non tranchées**. Ne fait foi sur rien |

Une idée n'entre en §13 **qu'une fois arbitrée**, avec ce qui a été écarté et pourquoi. Une
entrée n'entre dans `JOURNAL.md` **qu'une fois vérifiée fonctionnellement** — le document a
quatre fois la preuve qu'une sonde ne prouve rien.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
