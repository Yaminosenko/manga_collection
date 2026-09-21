# Zenkan — spécification

Application personnelle de suivi de collection de mangas, mono-utilisateur.
Ce document est la source de vérité du projet. Le lire en entier au début de chaque session.

**Il ne porte que la spécification et les décisions tranchées.** Trois fichiers l'entourent, et
les confondre donnerait à une intuition le même poids qu'à une décision — voir §13.5 :
`JOURNAL.md` fait foi sur ce qui est **fait**, `TODO.md` porte ce qui **reste**, `IDEES.md` les
envies **non tranchées**. `README.md` porte l'installation et les commandes. **Ce découpage date
du 18 septembre 2026** : ce document pesait 184 700 caractères, soit 4,6 fois le seuil au-delà
duquel une session le relit en entier pour un coût qui dilue le reste.

**L'application s'appelle Zenkan depuis le 17 septembre 2026** — 全巻, « tous les volumes ».
Le nom vit dans `NOM_APPLICATION` et `NOM_APPLICATION_COURT` (`lib/constants.ts`), d'où le
manifeste et les balises de `app/layout.tsx` le tirent ; aucun écran ne l'écrit en dur. **Le
dépôt, le dossier de travail et le projet Vercel gardent leur nom `manga_collection`** : les
renommer casserait les chemins de tous les postes et l'URL de production pour un affichage.
**Aucun domaine n'a été acheté** : l'idée d'un `zenkanapp.com` est posée et non tranchée, elle
vit dans `IDEES.md`.

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

Utilisateur  (id, email, nom, role, aPaye, visible, creeLe)
SuiviEdition (id, utilisateurId, editionId, statut, suivie, ajouteeLe)
Possession   (id, utilisateurId, volumeId, possede, dateAchat, prixPayeCentimes,
              etat, lu, note)
```

**La séparation catalogue / suivi est faite depuis le 9 septembre 2026** — voir §13.1 et
`JOURNAL.md`. Le catalogue porte des faits objectifs, identiques pour tout le monde ; le suivi
porte une ligne par utilisateur. **Depuis le 11 septembre 2026 chaque compte se connecte avec
son propre identifiant** et l'inscription est libre — voir §13.6.

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
Le propriétaire a été créé par la migration du 9 septembre avec un `email` nul — le dépôt est
public. `role` distingue `PROPRIETAIRE` de `UTILISATEUR` ; `aPaye` est posé d'avance pour §13.4.

`identifiant` est le **pseudo** de connexion, stocké normalisé et unique ; `motDePasseHash` est
un `scrypt` ; `versionJeton` invalide toutes les sessions d'un compte quand son mot de passe
change. Les trois sont nullables : la ligne du propriétaire les a nuls jusqu'au passage de
`npm run compte`. **`email` est obligatoire à l'inscription mais reste non vérifié** — aucun
envoyeur n'existe avant le lot 2 de §13.6.

**Il n'y a plus de rôle invité** : chacun se connecte avec son compte. Montrer sa collection se
fait depuis le 17 septembre 2026 par l'écran **Communauté**, qui est la forme retenue de la
visibilité entre comptes — **publique par défaut entre comptes connectés**, voir §13.7.

`visible` est le retrait de cette publication. **`@default(true)`** : un compte est visible tant
qu'il ne dit pas le contraire, ce qui est la lecture littérale de « publique par défaut » et ce
qui évite un backfill. Il se change depuis `/compte`, et **il porte sur les deux chemins** — le
classement *et* l'ouverture d'une collection par son adresse directe. Ne le filtrer que dans le
classement en ferait un réglage cosmétique : l'adresse d'un compte est son identifiant, donc
devinable.

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
**Ce qui manquait à cette ligne est la sortie** : une édition qu'on n'a jamais eue y restait
faute de pouvoir la retirer. C'est le retrait du 21 septembre 2026, décrit en §4 « État ».

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

### L'espace collection — trois panneaux sous un bandeau

> **Construit les 10 et 17 septembre 2026.** La Collection, les Manquants et la Wish list
> étaient trois écrans et trois onglets ; ce sont **trois panneaux d'un même écran**, derrière
> une bande de pastilles. Le détail et les chiffres sont dans `JOURNAL.md`.

**Une seule lecture nourrit les trois.** `chargerEspaceCollection` remplace `chargerCollection`,
`chargerManquants` et `chargerWishList` : un seul parcours de `SuiviEdition` produit les trois
panneaux, là où visiter les trois onglets faisait trois requêtes dont deux sur tous les volumes.
Changer de panneau ne coûte donc **aucune navigation**.

**Le bandeau est ancré, et il le montre.** Il porte, de gauche à droite et de haut en bas : la
pastille ronde du compte, le champ de recherche, le bouton de tri, puis la bande des trois
pastilles de panneau. Il vit sur son propre fond — `--color-header`, entre le fond de page et la
surface — parce que sans cette teinte rien ne disait ce qui allait rester en place. La barre du
bas porte la même, de sorte que les deux bords fixes se répondent.

- **La bande de pastilles remplace le titre « Collection »** : la pastille active *est* le titre
  de l'écran, ce qui évite une rangée d'en-tête de plus à 430 px.
- **Le bandeau s'escamote vers le haut quand on descend** et revient dès qu'on remonte. Quatre
  gardes le protègent des faux déclenchements — voir `lib/use-header-visibility.ts` et
  `JOURNAL.md`. Ce qui reste collé en haut fait **105 px**, contre 44 quand seules les pastilles
  l'étaient : c'est le prix d'avoir la recherche toujours sous la main.
- **La recherche est un champ unique** qui filtre le panneau visible, et son terme survit au
  changement de panneau.
- **Le bouton de tri est sur les trois panneaux, et chacun a son propre menu.** Il ne s'efface
  plus — le bandeau gardait sinon deux géométries et le champ de recherche sautait de 46 px au
  milieu d'un glissement. Mais « un tri qui ne trie rien est un mensonge » tient toujours, donc
  **un panneau ne propose que les critères qui le discriminent** : Manquants trie par **tomes
  manquants** là où la Collection trie par tomes possédés, et la Wish list, dont toutes les
  lignes sont à zéro tome, n'offre que l'alphabétique et l'ajout récent. **La préférence est
  mémorisée par panneau**, sous trois clés : un tri par tomes manquants n'a rien à faire sur la
  Collection. Les trois listes sont triées chacune avec la sienne, de sorte qu'aucun panneau ne
  se réordonne sous les yeux pendant un glissement.
- **Le sens n'a pas de ligne à lui : on retape le critère.** Un premier tap le sélectionne avec
  son sens par défaut, les suivants l'inversent, et **une flèche haut ou bas remplace la coche**
  sur le critère actif — le sens se lit donc là où il s'applique, au lieu d'une rangée
  « Ordre croissant / décroissant » en pied de menu qui portait un état sans dire de quoi.
  Conséquence : **le menu ne se ferme plus sur une sélection**, sans quoi on ne pourrait pas
  retaper ; il se ferme d'un tap en dehors. **Et l'icône du bouton du bandeau ne bouge plus** —
  elle pivotait de 180° selon le sens, ce qui faisait tressaillir un bandeau ancré pour une
  information que la flèche du menu porte déjà, et mieux.
- **Les chiffres ne sont pas dans le bandeau** : ils sont en tête du contenu et défilent avec
  lui, chaque panneau parlant du sien — tomes, éditions et valeur pour la Collection, tomes et
  éditions pour les Manquants, séries pour la Wish list. Le nombre est en 17 px sur son mot en
  12 px ; la valeur est à droite en 30 px, interlignée à la hauteur exacte des deux lignes de
  gauche.
- **`/manquants` et `/wishlist` survivent en liens profonds**, chacune ouvrant l'espace sur son
  panneau. Ça préserve les signets et les `revalidatePath` déjà posés. **Et l'URL suit le
  panneau** : atteindre un panneau la réécrit par l'History API, que Next synchronise avec
  `usePathname` — donc aucune navigation, aucune requête, et la barre du bas garde son onglet
  Collection actif sur les trois routes.
- **La barre du bas est à quatre onglets** — Collection, Planning, Rechercher, Communauté.
  Elle en a porté trois du 17 septembre 2026 au même jour : Communauté s'y est ajoutée avec
  §13.7, faute d'un meilleur endroit — la ranger derrière la pastille du compte l'aurait rendue
  invisible, et une quatrième pastille de bandeau aurait mélangé ma collection et celle des
  autres dans un même écran. À 430 px, quatre onglets font ~107 px chacun, très au-dessus des
  44 px de cible tactile. Le compte, lui, a quitté la barre pour la pastille du bandeau :
  **il n'est donc plus accessible depuis le Planning, Rechercher ni Communauté**, ce qui est
  assumé.
- **Et depuis le 21 septembre 2026 elle est sur toutes les pages de l'application**, pas
  seulement sur les quatre onglets : la page Édition, « Mes tomes », État, le scanner et les
  deux sous-pages de compte la portent aussi. Elle n'y est pas conditionnelle — **c'est
  l'arborescence qui la pose** : ces routes vivent sous le groupe `app/(tabs)/`, qui ne fait pas
  partie de l'URL, donc rien de ce qui pointe vers elles ne change. **Seuls `/acces` et
  `/inscription` restent dehors** : sans session, les quatre onglets ne mènent qu'à une
  redirection vers l'écran qu'on regarde. Conséquence à connaître : une page ainsi accueillie ne
  peut plus réclamer `min-h-dvh` — elle est dans un `flex-1` sous la barre, et 100 dvh la
  pousserait hors du pli. **Et aucun onglet ne s'allume** sur ces pages, faute de savoir d'où
  l'on vient.
- **Chaque panneau garde sa position de défilement**, sous une clé par panneau — et il la garde
  désormais **de lui-même**, chacun étant son propre conteneur défilant.

**Les trois panneaux sont montés côte à côte dans une piste horizontale**, en `scroll-snap`
natif : le geste, son inertie, son élastique et le verrou d'axe sont ceux du navigateur, sans
dépendance et sans un seul gestionnaire de `touch` écrit à la main. Une pastille **fait défiler
la piste** au lieu de changer un état, et c'est la position de la piste qui dit quel panneau est
actif : une seule source de vérité, donc la pastille ne peut pas mentir sur ce qu'on voit.

**Un geste ne fait jamais qu'un panneau** — `scroll-snap-stop: always`. Sans lui, l'inertie d'un
geste franc emporte jusqu'au dernier panneau, et viser les Manquants en glissant trop fort fait
atterrir sur la Wish list. Aller de la Collection à la Wish list demande donc **deux gestes**,
et c'est le prix assumé de ne jamais se tromper de panneau. **Le tap sur une pastille, lui, saute
directement** : la règle ne s'applique qu'au geste, pas au défilement programmé — vérifié.

**Ça coûte le défilement du document, et c'est la vraie décision.** Une piste ne peut pas
laisser la fenêtre porter le défilement vertical — sa hauteur serait celle du plus grand
panneau, et on défilerait dans le vide depuis la Wish list. L'espace collection est donc une
colonne à hauteur de fenêtre : le bandeau passe en **surimpression** et s'escamote sans
relayouter la liste, la barre du bas n'a plus besoin d'être `sticky`, et chaque panneau défile
pour son compte. **Les autres onglets gardent le défilement du document** — la règle ne s'arme
que sur les pages qui se déclarent plein écran. Conséquence connue : hors application installée,
la barre d'adresse mobile ne se rétracte plus. Le manifeste étant en `standalone`, la cible ne
la voit pas.

**Les panneaux hors écran ne sont pas `inert`, et c'est une décision.** Un `inert` piloté par
l'état client **est déjà dans le HTML du serveur** : tant que React n'a pas repris la main, deux
panneaux sur trois sont morts — ni défilables, ni tapables. Le 17 septembre 2026 ça a rendu
l'application inutilisable sur téléphone et transformé une gêne — la tabulation qui entre dans un
panneau hors écran — en panne. **S'il faut y revenir, ce sera un `inert` posé après le montage,
jamais rendu par le serveur.** Le récit est dans `JOURNAL.md`.

**Le `loading="lazy"` ne protège pas horizontalement** : les panneaux voisins chargent bien leurs
images à l'ouverture, mesuré 15/15 pour Manquants et 2/2 pour la Wish list. Le volume reste petit
et les URL recoupent celles de la Collection.

### Collection — le panneau par défaut
Liste des éditions. Une ligne par édition.

- Couverture du **dernier tome possédé**
- Titre, puis `Nom d'édition · Éditeur`
- `X / Y tomes · <état>` où Y = `tomesParus`
- Barre à trois zones
- Terminée : badge de complétion, pas de hachuré
- Abandonnée / en pause : icône dédiée + désaturation
- En tête du panneau : tomes possédés, éditions, valeur
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

### État — la sous-page de réglage
Trois réglages personnels et un retrait, atteints par « Modifier l'état » depuis la page
Édition : **où j'en suis** (le statut), **la parution** (réservée au propriétaire, c'est une
donnée de catalogue) et **le suivi**. Puis, depuis le 21 septembre 2026, **le retrait**.

**Retirer, c'est supprimer mon `SuiviEdition` et mes `Possession` sur les tomes de cette
édition — rien d'autre.** L'`Edition`, ses `Volume` et ses `Sortie` sont du catalogue partagé :
les effacer retirerait la série aux autres comptes. Mesuré sur le banc en retirant une édition
suivie par deux comptes — les 22 possessions de l'autre compte et les 135 éditions sont
intactes, seules les 22 lignes du compte qui retire sont parties.

**Ce geste manquait, et son absence était une impasse.** `suivie = false` ne retire pas une
édition, il la fait taire : une série ajoutée par curiosité puis dépossédée restait en
Collection à `0 / N` pour toujours — c'est la dernière ligne du tableau de §3, qui dit qu'une
édition non suivie à zéro tome n'est pas une envie d'achat. Rien ne permettait de dire « je ne
l'ai pas ». **Le trou date du premier jour** : l'écran Rechercher sait ajouter en un tap depuis
le 9 septembre 2026, et rien n'a jamais su défaire ce tap.

**Deux taps, pas un.** C'est la seule action destructrice de l'application, et le cochage d'un
tome — enregistrement au fil de l'eau, sans confirmation — ne fait pas jurisprudence ici : il
se défait d'un tap, le retrait non. Le premier tap arme, le second confirme, et la mention sous
le bouton change pour dire ce que le second va détruire. Écartée : une couleur de danger.
**Nocturne n'a pas de rampe rouge** (§7) et la dériver est un travail de design à part entière ;
le bouton armé prend donc l'accent plein, qui ne sert nulle part ailleurs sur cet écran.

**Ce que ça laisse** : une `Edition` que plus personne ne suit reste au catalogue. Elle n'est
orpheline que du point de vue des comptes — la recherche la retrouve par les EAN de ses tomes,
et un tap la ré-adopte **sans créer de doublon**, en ne posant que le `SuiviEdition`. Vérifié :
l'édition reprise porte le même identifiant, le compte des éditions ne bouge pas, et la
collection repart à zéro tome dessus, donc en wish list.

### Manquants
Tous les tomes non possédés et déjà parus, groupés par édition.
**Ne montre que les éditions `suivie` dont on possède au moins un tome** — le même couple de
conditions que le Planning. Pas de section repliée : ce qu'on ne veut pas voir, on ne le suit pas.

### Wish list
Les séries qu'on compte acheter et dont on ne possède encore aucun tome. **Troisième panneau de
l'espace collection**, après Manquants.

**L'appartenance est déduite, jamais stockée** : `possédés = 0 ET suivie ET statut ≠ VENDUE`.
Aucun champ à maintenir, aucun état à désynchroniser — cocher un tome fait basculer en
Collection, décocher le dernier ramène ici. Une ligne porte la couverture du tome 1, le titre,
`Nom d'édition · Éditeur` et `0 / Y` ; pas de barre de progression, elle serait toujours vide.

Ces séries **ne comptent ni dans les compteurs d'en-tête de la Collection ni dans la valeur** —
comme les vendues, et pour la même raison : on ne les possède pas.

### Rechercher — l'écran d'ajout

> **Arbitré le 9 septembre 2026, construit les 9 et 10.** Ce qui suit décrit l'écran tel qu'il
> est, sauf mention contraire. **La route reste `/ajouter`** : la changer casserait les
> raccourcis de la PWA installée pour rien.

**Le nom change parce que le geste a changé.** On ne vient plus « ajouter » un objet qu'on
décrit soi-même : on **cherche** dans un catalogue de **12 880 groupes**, et ce qu'on trouve,
on l'ajoute ou on le suit.

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
| 5 | rien | l'écran le dit et s'arrête — **pas de saisie manuelle**, voir ci-dessous |

**Les cinq rangs cherchent dans le catalogue entier, et les deux premiers portent donc
`dansMaCollection`** — c'est la distinction décrite plus bas, appliquée au scan le
17 septembre 2026. Une édition trouvée mais non suivie n'ouvre pas sa fiche et ne coche pas un
tome : elle propose de l'**adopter**, ce qui crée le `SuiviEdition` avant d'écrire quoi que ce
soit. Sans ça le rang 1 écrivait une `Possession` que les six écrans ignorent, et le rang 2
supprimait du catalogue partagé une `Sortie` au profit de personne — voir `JOURNAL.md`.

**Pas de saisie manuelle, tranché le 9 septembre 2026.** Un tome que ni le catalogue ni la BnF
ne connaissent ne s'ajoute pas : l'écran le dit et s'arrête. `creerEdition`,
`creerSerieAvecEdition` et la recherche de prix par titre ont été **supprimés**, pas laissés en
dormance. Le motif est net : un formulaire vide fabrique des fiches sans ISBN, sans date et
sans couverture — exactement les 23 éditions que l'audit ne peut pas juger, et exactement ce
que le catalogue vient de rendre inutile. **L'effort va à l'amélioration du chemin
automatique**, pas à une porte de secours qui dégrade la base.

**Résolution par texte** : le local d'abord, par index sur `Serie.slug`, `Serie.titre` et
`Serie.alias` — un résultat local est un **lien** vers la fiche, jamais une création. Puis le
catalogue, classé par correspondance exacte, préfixe, puis similarité trigramme.
**Aucun seuil ne sélectionne** : l'algorithme classe, l'utilisateur choisit. C'est la leçon des
cinq échecs d'appariement automatique, et ici elle est gratuite — il y a un humain devant.

#### Chaque ligne de résultat porte une vignette

Une ligne de texte seule ne dit pas ce qu'on regarde. Chaque résultat porte donc une couverture
à gauche du titre — **56×80** en recherche, **70×100** sur la carte du scanner, où elle sert de
confirmation qu'on a scanné le bon tome.

**Aucun appel externe pendant une recherche.** La vignette est jointe en base, en une requête :
`ParutionCatalogue` joint `VignetteCatalogue` sur l'EAN, et le groupe retient la première image
disponible par numéro croissant. Une recherche reste une lecture locale, comme §5 l'exige.

**Une vignette absente n'est pas un blanc cassé** : `Cover` retombe sur son placeholder, muet sur
une ligne de catalogue puisqu'on ne sait pas quel tome l'image aurait montré.

**Une édition possédée n'apparaît qu'une fois.** Les deux sections se recoupent — le local
apparie par titre et alias, le catalogue par EAN — donc une série qu'on possède sortait dans les
deux. Un candidat dont le `slugEnCollection` est **déjà listé dans « Déjà dans la collection »**
est retiré du catalogue. Les autres y restent : un candidat reconnu comme possédé que la
recherche locale n'a pas trouvé est une information, pas un doublon — c'est le cas d'`ippo-s4`,
dont le catalogue dit « Saison 4 » là où le titre local dit « S4 ».

**Et un candidat reconnu comme possédé emprunte la couverture de son édition.** La jointure qui
pose `slugEnCollection` ramène au passage le premier tome illustré de cette édition : la vignette
est donc la même que dans la Collection, sans dépendre de `VignetteCatalogue`.

#### Deux règles de couverture, nommées

Le mécanisme est le même partout, mais **les écrans ne veulent pas la même image**, et les
confondre casserait l'anatomie de la Collection. `lib/vignettes.ts` porte deux fonctions nommées :

| Règle | Ce qu'elle rend | Où |
|---|---|---|
| `couvertureDeProgression` | **le dernier tome possédé** | Collection, Manquants, « Autres éditions », « Séries liées » — elle raconte où j'en suis |
| `couvertureDIdentification` | **le premier des 4 premiers tomes qui a une image**, sinon la `VignetteCatalogue` d'un de leurs ISBN | Recherche, scanner, wish list — il n'y a rien à raconter, il faut reconnaître |

L'identification sert aussi de **dernier recours** là où la progression ne rend rien : une édition
à zéro tome possédé, dont la ligne serait sinon vide. Puis, en tout dernier,
`Edition.couvertureUrl` et `Serie.couvertureUrl` — c'est le seul usage de ce dernier champ,
qu'aucun écran ne lisait.

**`Edition.couvertureUrl` ne passe jamais avant la progression**, contrairement à ce que le code
faisait jusqu'au 10 septembre : §4 prescrit « couverture du dernier tome possédé », et ce champ
étant nul sur les 116 éditions, personne ne s'en était aperçu.

#### Une ligne de résultat par édition, pas par série

**Un résultat = un groupe `(serieNormalise, marqueurEdition)`**, affiché avec son nombre de
tomes, son éditeur et sa vignette. Il y a **12 880 groupes pour 11 530 séries**, et **863
séries sont multi-édition**.

C'est GANTZ qui l'impose : le catalogue en connaît quatre — édition simple à **37 tomes** chez
Tonkam, **Perfect Edition à 18 tomes** chez Delcourt/Tonkam, et deux coffrets. Sans le nombre
de tomes sur la ligne de résultat, impossible de savoir laquelle on ajoute. C'est aussi ce qui
rend enfin soluble l'ajout d'une **seconde édition à une série existante** : le marqueur
distingue ce que `creerSerieAvecEdition` confondait.

#### Un tap ajoute, et ouvre la page de la série

**Révisé le 9 septembre 2026, après essai sur téléphone.** La version précédente ouvrait un
formulaire de confirmation avec deux boutons « Ajouter » et « Suivre ». Le propriétaire l'a
écartée : *« c'est bien pour une appli manuelle, mais là on vise de l'automatisme »*.

**Un tap sur un résultat de catalogue crée l'édition et ouvre sa page.** Rien à remplir, rien à
confirmer. La page d'édition est déjà celle qu'il faut : elle porte le bouton `X / Y TOMES` qui
mène à la grille de cochage, et « Modifier l'état » qui règle le statut, la parution et le
**suivi**, et qui **retire l'édition** depuis le 21 septembre 2026. Les deux gestes que
l'ancien formulaire prétendait anticiper y sont, au bon endroit — et le tap se défait.

Ce que ça écrit reste ce que §4 décrivait : `Serie`, `Edition`, `SuiviEdition`, les `Volume`
avec leur ISBN et leur date, les `Sortie` à venir, et **aucune `Possession`** — donc la série
atterrit en wish list jusqu'au premier tome coché. Par `/scanner`, le tome scanné est coché et
elle entre directement en Collection.

**Taper une édition déjà présente n'en crée pas une seconde**, et le multi-compte oblige à
distinguer **deux questions que le code confondait** (corrigé le 11 septembre 2026) :

| Question | Champ | Ce qu'elle pilote |
|---|---|---|
| cette édition existe-t-elle **au catalogue** ? | `slugEdition` | ne pas créer de doublon |
| est-elle dans **ma** collection ? | `dansMaCollection` | le libellé « Déjà dans la collection », et le dédoublonnage des deux sections |

`slugEdition` se calcule **globalement**, par la jointure `ParutionCatalogue.ean → Volume.isbn`.
Trois cas, donc : elle est à moi, on ouvre la fiche ; elle existe mais n'est pas à moi, **on
crée seulement le `SuiviEdition`** et on ouvre la fiche ; elle n'existe pas, on la crée.

Le cas du milieu est celui qui manquait : avec un seul champ global, un second compte voyait
« Déjà dans la collection » sur les éditions d'un autre — et le tap le renvoyait vers une fiche
que ses requêtes, parties de `SuiviEdition`, lui refusaient : **« cette édition n'existe pas »**.

**Conséquence à connaître** : `nom` et `tomesParus` n'ont plus d'endroit où se corriger dans
l'application. Le formulaire était le seul, et l'écran État ne propose que statut, parution et
suivi. Le catalogue est juste dans 99 % des cas mesurés et l'audit rattrape le reste, mais si
le besoin se présente, c'est à l'écran État que ces deux champs iront — **pas** à la création.
#### Ce que le candidat porte, et d'où ça vient

| Champ | Règle | Ce qui la justifie |
|---|---|---|
| `titre` | `serieTitre` de la ligne la plus récente | 57 groupes sur 12 619 ont un titre variable, et les écarts sont cosmétiques |
| `nom` | `marqueurEdition`, sinon « Édition simple » | — |
| `editeur` | **BnF par ISBN**, le catalogue en repli | le catalogue nomme le **label**, la BnF l'éditeur légal : 9 éditions de la collection disent « Bamboo Édition » là où le catalogue dit « Doki Doki », son label manga — et c'est la BnF qui a rempli les 113 lignes existantes |
| `tomesParus` | `max(numero)` **sur les lignes de date passée** | 722 groupes seraient gonflés sans ce filtre, 944 lignes étant datées du futur |
| `tomesParus` sans aucun numéro | **1** | 5 361 groupes n'ont aucun `Vol.N` — one-shots, coffrets, artbooks |
| `volumes` | `numero` → EAN + date ; **les trous restent vides** | Détective Conan : `max = 107` pour 87 numéros distincts |
| `auteur` | BnF `700`/`701` code `070`, interrogée sur **les tomes les plus anciens autant que les plus récents** | une notice récente est souvent incomplète : sur l'Édition grimoire de L'Atelier des sorciers, les tomes 4 et 5 rendent `auteurs=[]` et les tomes 1 et 2 rendent « Kamome Shirahama » |
| `prixDefaut` | BnF `010$d`, **le tome le plus récent d'abord** — le prix monte avec le temps, l'auteur ne change pas | mesuré : 19,95 € pour l'Édition grimoire contre 7,70 € pour l'édition simple, sur la même série |
| `editionTerminee` | **pré-cochée** si aucune sortie depuis `MOIS_SANS_SORTIE_POUR_TERMINEE` (24) | sinon une série finie en 2010 afficherait le hachuré « à paraître » et trois cases fantômes |
| `genres` · `themes` · `cible` · `titreVo` · `alias` | **MangaBaka, si un de ses titres est exactement le titre du candidat** | le catalogue n'en porte pas, et l'égalité exacte est la seule règle d'appariement automatique que ce document n'ait pas vue échouer. Rien trouvé ⇒ champs vides, comme avant : jamais une donnée devinée |
| couvertures | **aucune à la création** | rattrapable : la BnF rend du 256×360 par EAN — voir la rectification de §5 |

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
  entre alors directement en Collection. Le candidat déjà résolu par le scan est porté à la
  confirmation **par l'URL** — `?serie=…&marqueur=…&isbn=…` — pour ne pas faire retaper le
  titre ; l'ISBN voyage en champ caché et le tome correspondant est coché après création.

#### Deux choses connues et non réglées

`CREATE EXTENSION pg_trgm` et l'index GIN trigramme sur `ParutionCatalogue.serieNormalise` sont
posés depuis la migration `20260909170000_recherche_catalogue`. **Reste l'anti-doublon et
`resoudreIsbn`, qui doivent passer par un index** — voir §13.2 et `TODO.md`.

**Les magazines ne sont pas filtrés**, décidé le 9 septembre : Animeland (257 « tomes »), Les
Inrocks, Made in Japan et Dream Team sortent dans les résultats. Aucune règle automatique n'est
fiable — l'éditeur ne suffit pas, Glénat en publie, et le nombre de tomes non plus, Détective
Conan en a 107. Une liste noire écrite à la main viendra plus tard.

### Communauté — consulter la collection d'un autre

> **Arbitré et construit le 17 septembre 2026.** C'est la forme retenue de la visibilité entre
> comptes, restée ouverte dans `IDEES.md` depuis le 11 septembre — le motif, les deux formes
> écartées et ce que ça coûte sont en §13.7.

**Quatrième onglet de la barre du bas.** L'écran liste les **dix plus grosses collections**, un
compte par ligne : son nom visible, puis `N tomes · N éditions`. C'est l'état au repos, sans
saisie. **Les comptes à `visible = false` n'y sont pas**, ni au classement, ni à la recherche, ni
par leur adresse directe — voir §2 et l'écran de compte ci-dessous.

**Une barre de recherche, sur le motif de Rechercher** — `bg-surface`, 38 px, action serveur,
debounce de `DELAI_RECHERCHE_MS`, deux caractères minimum. Elle cherche **tous les comptes**, pas
seulement les dix affichés : un compte à 4 tomes se trouve par son nom alors qu'il n'entre jamais
au classement. Vider le champ **ne rappelle pas le serveur** — le classement initial est déjà là.
Le terme est normalisé comme un identifiant (`normaliserIdentifiant`), donc la casse est
indifférente, et **les jokers SQL sont échappés** : taper `%` ne liste pas tout le monde.

**Les deux compteurs sont ceux que le compte visité voit chez lui**, et c'est une contrainte, pas
une coïncidence : ils reproduisent la règle de `chargerEspaceCollection` — hors vendues, hors
wish list. Les écrire autrement ferait mentir la ligne. Une requête unique les calcule pour tout
le monde ; le contrôle est de comparer les deux chemins, et il fait partie de la vérification.

#### La visite — `/communaute/<identifiant>`

**La liste de ses éditions, et rien d'autre.** Couverture de progression, titre,
`Nom d'édition · Éditeur`, `X / Y` et la barre à trois zones : c'est la même anatomie de ligne
que la Collection, par le même composant.

- **Aucune ligne ne mène nulle part.** `CollectionRow` prend une prop `inerte` qui remplace le
  `<Link>` par un `<div>`. Sans elle, chaque ligne pointerait `/edition/<slug>`, où
  `chargerEdition` rendrait « cette édition n'existe pas » — le visiteur n'a pas de
  `SuiviEdition` dessus. Un cul-de-sac, pas une fuite, mais un cul-de-sac quand même.
- **Ni valeur totale, ni prix.** `PanelStats` reçoit `prix={null}` : le montant **n'est pas
  calculé côté vue et n'atteint jamais le navigateur**, il n'est pas masqué en CSS. C'est le seul
  endroit où la visite montre moins que la Collection, et c'est le prix de la forme « publique
  par défaut » — §7 assume un dépôt public, pas la publication de la valeur d'une collection à
  tout compte inscrit.
- **La section « Vendues » n'est pas rendue.** Une vendue est un réglage personnel ; celle d'un
  autre n'apprend rien.
- **Ni Manquants ni Wish list.** Ce sont une liste de courses et des envies d'achat — montrer ce
  qu'on possède n'oblige pas à montrer ce qu'on convoite. À rouvrir si le besoin se présente.
- Compte inconnu ⇒ la page « introuvable », par `notFound()`. **Le statut reste 200 en
  développement**, exactement comme `/edition/<slug inexistant>` : le rendu en flux a déjà envoyé
  les en-têtes quand `notFound()` est levé. C'est le comportement de toute l'application, pas une
  particularité de cet écran.

**Aucune écriture n'est ajoutée nulle part**, et c'est ce qui rend la lecture seule vraie plutôt
qu'affichée : toutes les actions de `lib/actions.ts` écrivent sur `idUtilisateurCourant()` et
**aucune n'accepte un identifiant de compte en paramètre**. Il n'existe donc pas de chemin par
lequel une visite écrirait chez l'hôte.

#### Se retirer — l'interrupteur de `/compte`

Une section « Visibilité » sur la page de compte, et un interrupteur de 44 px qui porte le seul
libellé « Visible dans Communauté ».

**Il a porté sous lui une phrase qui changeait avec l'état, retirée le 18 septembre 2026 par
décision du propriétaire** — avec les deux mentions de l'écran Identité et dans le même geste :
l'application explique moins et affirme davantage.

**Ce que ça coûte est écrit ici parce que plus rien ne le porte à l'écran** : le libellé ne dit
ni que la valeur et les prix restent cachés au visiteur, ni que couper l'interrupteur ferme
**aussi** l'adresse directe et pas seulement le classement. Cette seconde conséquence est la
moins devinable des deux — c'est celle que §2 insiste à faire porter sur les deux chemins. Si le
réglage se révèle mal compris à l'usage, le remède n'est pas de remettre le paragraphe mais
**d'allonger le libellé**, qui est lu.

`changerVisibilite` n'exige qu'`exigerAcces()` et écrit sur `idUtilisateurCourant()` — comme tout
le reste, elle ne sait pas viser un autre compte. Elle revalide `/compte` et `/communaute`.

**Un compte retiré ne se voit plus lui-même dans la liste**, et c'est délibéré : l'écran montre
alors exactement ce que les autres voient, ce qui est le meilleur retour possible sur un réglage
dont l'effet est ailleurs. L'interrupteur, lui, dit l'état.

---

## 5. Données externes

### Règle absolue
Les API externes sont appelées **à l'import et au rafraîchissement de fond**. Jamais à
l'ouverture d'un écran. Tout écran lit la base locale.

### Sources
| Source | Usage | État mesuré |
|---|---|---|
| **MangaBaka (HTTP)** | **Genres, thèmes, cible, titres alternatifs et abréviations, auteur, séries liées** | **22/25 sur les titres VF de la collection · sans clé · API publique documentée · CC BY-NC-SA 4.0** |
| AniList (GraphQL) | ~~Métadonnées série, couverture série, pont vers les titres romaji~~ | **coupée par ses exploitants, remplacée par MangaBaka le 10 septembre 2026 — voir ci-dessous** |
| BnF (SRU) | Éditeur, ISBN, date de parution VF, **prix en UNIMARC `010$d`** | **éditeur : 106/113 · sans clé**, les 7 derniers saisis à la main |
| BnF (Service Couvertures) | **Couvertures VF par ISBN/EAN** | sans clé · réutilisation documentée · URL en bêta |
| MangaDex | Couvertures de tome, **dernier recours** | **93 % en `ja` · en attente d'autorisation** |
| Google Books | Tomes VF par ISBN, date de parution, couverture tome | **bloqué sans clé d'API, couverture jamais mesurée** |
| Open Library | Complément ISBN, couverture par ISBN | 0/11 sur des ISBN français |
| manga-news | Planning des sorties VF | **Export mensuel offert aux visiteurs, archives qualifiées jusqu'à 2000** · l'usage *programmatique* reste en attente d'autorisation |

> **AniList est coupée par ses propres exploitants — constaté le 9 septembre 2026.** Toute
> requête rend `403` avec « The AniList API has been temporarily disabled due to severe
> stability issues. » Ce n'est ni le réseau du poste ni une clé manquante : la réponse vient
> d'AniList. La sonde du 28 août reste vraie de ce que l'API donnait ; elle ne dit rien de sa
> disponibilité. **Son code a été supprimé le 10 septembre 2026** — `lib/anilist.ts`,
> `fetch-anilist.ts`, `apply-anilist.ts` — et non laissé en dormance, comme la saisie manuelle
> la veille. `data/anilist.json` reste au dépôt : c'est la trace de ce que ses 26 recherches
> manuelles avaient résolu, et `RECHERCHES_MANUELLES` est repris tel quel dans
> `fetch-mangabaka.ts`.

### Ce que les sondes ont établi

Les mesures elles-mêmes — 28 et 29 août, 10 septembre 2026 — sont dans `JOURNAL.md`, annexe
« les trois sondes de sources externes ». Ce qui en reste opératoire :

- **MangaBaka couvre la couche série, et elle seule.** `https://api.mangabaka.org/v2/`,
  `series/search?q=…` et `series/{id}?schema=full`. 22 appariements sur 25 titres VF. Elle donne
  genres, thèmes, cible, titre VO, **alias et abréviations** (« JJK » y est, noté « Short
  title ») et les liens entre séries. **Rien au niveau du tome** : aucun ISBN, aucune couverture
  par tome, aucune date, et `final_volume` est le compte **japonais**, égal à notre `tomesParus`
  sur 11 séries sur 22 seulement. **`ParutionCatalogue` + BnF restent donc le seul chemin vers
  l'EAN, `tomesParus` et l'éditeur.** Plafonds annoncés : 30 requêtes/minute sur la recherche,
  180 sur le reste ; le code prend 24 et 120.
- **MangaDex couvre les tomes, mais en japonais** — 93 % en `ja`, 8 % en `fr`, et c'est 100 %
  ou 0 % par série. L'illustration japonaise est la même que la française, seul le logo-titre
  change ; le rendu est accepté depuis le 29 août 2026. **Le pont passe par le romaji** : les
  titres natifs et romaji de `data/mangabaka.json` le fournissent depuis la mort d'AniList.
  Deux pièges : **il faut paginer** — `api.mangadex.org/cover` plafonne à 100 et rend le compte
  réel dans `total`, Iruma-kun en a 216 — et **la métadonnée `locale` n'est pas fiable**, une
  couverture étiquetée `pt-br` s'est révélée espagnole avec un logo d'éditeur incrusté.
- **Les CGU de MangaDex interdisent la récupération systématique** pour constituer une base,
  sans autorisation écrite, alors que la documentation de son API décrit une API publique ouverte
  aux clients tiers et impose de recopier les images plutôt que de les lier. La contradiction est
  dans leurs textes, pas dans notre lecture. **Une demande d'autorisation est rédigée, à envoyer
  à `admin@mangadex.org`** — même posture que manga-news.

  > **Le cron quotidien y retombe depuis le 16 septembre 2026, par décision du propriétaire
  > prise en connaissance de ce paragraphe.** Elle est écrite ici plutôt que tue : la demande
  > reste non envoyée et non répondue. Ce que ça couvre est borné — la BnF passe d'abord,
  > MangaDex n'est essayé que sur les éditions **sans marqueur** dont la numérotation est
  > comparable, et le volume mesuré au premier passage est de **40 images**. Ce n'est pas la
  > récupération massive que les CGU visent, mais ce n'est pas non plus une autorisation.

  **MangaDex est instable comme source** : ~7 000 titres et ~25 % des chapitres retirés sur
  notifications DMCA en mai 2025. La recopie dans Cloudflare R2 nous en rend indépendants une
  fois faite.

- **BnF : l'éditeur est acquis, le numéro de tome ne l'est pas.** 106 éditeurs sur 113. Cinq
  formats de numérotation coexistent dans les notices et la moitié portent le sous-titre du tome
  à la place du numéro — Bleach remonte `Black`, `Friend`, `Howling`.
- **Écartées et pourquoi** : Open Library rend 0 sur 11 puis 0 sur 5 ISBN français ; Google
  Books exige une clé et répond 429 sans elle ; MangaLib est géobloqué et MangaHook est un
  scraper d'agrégateur pirate ; Nautiljon interdit explicitement la récupération.
- **Scrapers par éditeur : V3, conditionnel.** Un scraper s'écrit en une heure et se maintient
  éternellement. Trois règles si on y va : compter les tomes par éditeur et n'écrire que pour
  les trois ou quatre premiers, chaque scraper déclare ce qu'il attend et **échoue bruyamment**,
  un scraper cassé ne bloque jamais les autres. Demander d'abord aux éditeurs s'ils exposent un
  flux ONIX.

**Rendement mesuré le 10 septembre 2026** : BnF par EAN rend **68 %** sur les gros groupes du
catalogue, **53 %** sur un tirage aléatoire, **20 à 29 %** sur le début alphabétique — artbooks
et one-shots. MangaDex rend 6 sur 8, mais seules 108 séries sur 12 880 ont un identifiant. D'où
le tri par **taille de groupe décroissante** dans `vignettes:fetch` : un passage plafonné doit
servir d'abord ce qu'on cherche.

### Ordre des sources de couverture

Arrêté le 31 août, mesuré et révisé les 10 et 16 septembre 2026. Les mesures qui l'ont établi
sont dans `JOURNAL.md`, annexe « l'ordre des sources de couverture ».

**1. `VignetteCatalogue`, par EAN.** La table est **clé par EAN**, donc une vignette *est* la
couverture d'un tome précis. Le cron joint `Volume.isbn` à `VignetteCatalogue.ean` et **recopie
l'objet R2** plutôt que de redemander l'image à la BnF.

- **Le critère de réemploi est « l'image atteint notre cote sur au moins un côté »** —
  `largeur = 256` **ou** `hauteur = 360`, jamais au-dessus. Mesuré sur les 7 272 vignettes
  illustrées : aucune ne dépasse 256×360, la BnF redimensionnant côté serveur en respectant les
  proportions ; **515 n'atteignent la cote sur aucun côté** et sont écartées, le tome repartant
  au chemin normal.
- **La provenance recopiée est celle de la vignette, sa date comprise** — `couvertureRecupereeLe`
  prend `VignetteCatalogue.recupereeLe`, pas l'heure de la copie. C'est ce qu'exige la Licence
  ouverte : la date de récupération **auprès de la BnF**.
- **Ce qui n'est délibérément pas fait : se servir des échecs mémorisés pour sauter la BnF.** Une
  vignette à `couvertureUrl` nul dit « la BnF n'avait rien **ce jour-là** » ; une notice
  s'illustre plus tard, et `couvertureTenteeLe` rouvre déjà la question à 7, 30 puis 90 jours.

**2. La BnF, par EAN.** `openapi.bnf.fr/couverture/image/image/recupererImage`, interrogeable par
`EAN=`, `ISBN=` ou `idArk=`, sans passer par l'ARK.

| Ce qu'on demande | Ce qu'on obtient |
|---|---|
| `?EAN=<ean>&couverture=1` | la **miniature**, ~106×150, 7 Ko |
| `…&couverture=1&taille=originale` | la **taille d'origine**, jusqu'à 600×853 et plus, ~600 Ko |
| `…&taille=originale&largeur=256&hauteur=360` | **exactement notre cote**, redimensionnée côté serveur, ~22 Ko |

**`couverture` n'est pas une taille : `1` est la première de couverture, `4` la quatrième.** Le
paramètre de taille s'appelle `taille`, et cette confusion a coûté une journée — voir « Pièges
établis ».

- **Un code 500 signifie « aucune image sur cette notice »**, pas une panne. Mesuré : 0 / 15 des
  EAN sans miniature en ont une en taille d'origine.
- La présence d'une image est **connaissable à l'avance** : zone **950 en Intermarc**,
  `950$b = C1`, interrogeable par le SRU que `lib/bnf.ts` utilise déjà.
- **Licence ouverte de l'État**, à condition de mentionner **la provenance et la date de
  récupération** — d'où `sourceCouverture` **et** `couvertureRecupereeLe`. Elle **n'interdit pas
  l'usage commercial**, contrairement au `NC` de MangaBaka. Les URL restent **en bêta**.

**3. MangaDex**, `fr` puis `ja`, **et jamais une troisième langue**. Elle rend des images bien
plus grandes que la BnF (722×1024 à 1800×2560), donc **on la préfère quand elle a la série** ;
mais elle exige un identifiant que le catalogue n'a pas, et son usage programmatique reste en
attente d'autorisation.

**4. Le dépôt manuel.** **Open Library est écartée.**

**Le vrai verrou n'est pas la source, c'est l'ISBN.** Toutes les bonnes sources s'interrogent par
EAN ; MangaDex n'a été retenu que faute d'EAN, d'où le sélecteur d'appariement par titre et ses
ratés. Sur les 72 tomes encore sans couverture, **64 n'ont aucun ISBN en base** — rien à
interroger.

**Cette chaîne tourne dans le cron depuis le 16 septembre 2026.** Le report d'un essai raté est
porté par `couvertureTenteeLe` et `couvertureTentatives` — 7, 30 puis 90 jours — de sorte qu'un
tome neuf passe en tête de file et qu'un tome sans notice se fait oublier tout seul.

**Depuis le 21 septembre 2026, la même chaîne sert aussi les `Sortie`**, dans le même passage et
sous le même budget, et **avant les tomes** : elles sont peu nombreuses et bornées là où un afflux
de tomes neufs les affamerait. La table porte donc les deux mêmes colonnes de report.

**La BnF ne peut rien sur une annonce, et c'est structurel** : elle enregistre au **dépôt légal**,
donc *après* parution. Mesuré sur les 18 EAN à venir de la base — **18 réponses 500**, c'est-à-dire
« aucune image sur cette notice », et aucun n'est dans `VignetteCatalogue`, peuplée depuis la même
source. **Seule MangaDex illustre un tome à paraître**, parce qu'elle publie la jaquette japonaise
avant la sortie française : elle a rendu **15 des 21** annonces en une passe, la BnF zéro.

**Deux choses à savoir sur l'interrogation de MangaDex**, apprises le 21 septembre 2026 :

- **Son endpoint `/manga` applique par défaut `contentRating = safe, suggestive, erotica`**, donc
  une série classée `pornographic` chez eux est **invisible sans que rien ne le signale**. C'est ce
  qui a fait conclure trois fois que *Mato Seihei no Slave* n'existait pas, alors qu'elle est là
  avec 23 couvertures et « Demon Slave » parmi ses titres alternatifs. `CLASSIFICATIONS_MANGADEX`
  passe les quatre valeurs : la classification ne dit rien de « est-ce la bonne série », qui se
  tranche par égalité exacte de titre, et les fiches parasites sont déjà écartées par
  `MARQUEURS_SATELLITE`.
- **La recherche par titre japonais natif ne rend rien** — `魔都精兵のスレイブ` donne zéro résultat
  quelle que soit la classification. Seuls le titre latin et les titres alternatifs indexent, donc
  interroger `titreVo` est inutile quand il est en kanji, ce qui est le cas de la plupart de nos
  séries. Le romaji de MangaBaka est déjà en base et ferait un meilleur second terme.

**Le garde-fou de numérotation tolère l'avance japonaise depuis le 21 septembre 2026.** La règle
était `tomesMangaDex ≤ tomesParus × 2` ; sur une série jeune, un écart de 4 volumes suffit à la
franchir — RAI RAI RAI est à 3 tomes en France et 7 au Japon. Elle devient donc **« ratio ×2 ou
avance d'au plus 8 volumes »**. Ce garde-fou reste porteur et ne doit pas être retiré :
`ippo-s4-la-loi-du-ring` est **résolu** par son `titreVo` はじめの一歩, qui correspond exactement à
*Hajime no Ippo*, et c'est **la seule chose qui le bloque** — 145 volumes contre 27.

**Champ `sourceCouverture`** — sur `Volume` **et sur `Sortie`**, la seconde parce que
`promouvoir()` recopie la couverture de la sortie vers le tome. `null` veut dire **« indéterminé,
antérieur au champ »**, exactement comme `Edition.creeeParId` : les 1 680 images d'alors étaient
un sac indistinct de MangaDex et de dépôts manuels. **Ne pas les marquer en masse**, ce serait
inventer une provenance.

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
| Accès privé | Garde applicative : un compte par personne, pseudo et mot de passe, inscription libre | Hobby ne sait pas protéger la production |
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
- **Le zoom est bloqué, depuis le 18 septembre 2026 et par décision du propriétaire.** Deux
  verrous, parce qu'aucun ne couvre tout seul : `maximum-scale=1` et `user-scalable=no` par
  l'export `viewport` de `app/layout.tsx`, et **`touch-action: pan-x pan-y` sur `html`**, qui
  retire le pincement **et** le double-tap là où la balise seule ne suffit pas sur Chromium.
  **`manipulation` ne convient pas** — il ne retire que le double-tap et laisse pincer ; et
  `none` tuerait le glissement entre panneaux, d'où les deux axes nommés. **Jugé dans la PWA
  installée** ; ce qui reste non éprouvé est Safari iOS **en navigateur**, qui ignore
  `user-scalable=no` depuis iOS 10 — la cible étant le manifeste `standalone`, ça ne gêne pas.
  Effet de bord voulu : l'auto-zoom d'iOS au focus d'un champ disparaît, les cinq champs de
  saisie étant en 13 px, sous le seuil de 16 px qui le déclenche. **C'est une régression
  d'accessibilité assumée** — WCAG 1.4.4, plus de recours pour qui a besoin d'agrandir — et
  c'est la première ligne à rouvrir si l'application sort du cercle personnel.
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
- `design/zenkan/` — **l'icône de l'application**, ses SVG sources et son générateur. Seul
  dossier de `design/` dont quelque chose est **servi** : les PNG rendus sont recopiés dans
  `public/icons/`, `app/apple-icon.png` et `app/favicon.ico`. Lire son README avant d'y toucher.
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

`scripts/import_sheet.py` a converti l'export CSV du Google Sheet en `data/collection.json` :
112 lignes, 108 séries, 112 éditions, 1 148 tomes possédés. **C'est le point zéro, et il ne
décrit plus la base** — §12 fait foi.

Le Sheet ne disait pas **quels** tomes étaient possédés : le script attribuait les N premiers,
d'où le drapeau `aVerifier` sur les 37 éditions incomplètes. **Le drapeau n'existe plus** : les
37 sont descendues à 12 par relectures successives, les 12 dernières ont été relues le
9 septembre 2026, et la colonne est morte avec la migration. C'était un artefact de cet import,
pas un concept du modèle.

**`data/collection.json` est figé à ce point zéro.** Tout script qui parle de la collection lit
`data/backup.json` — voir « Pièges établis ». Ne jamais relancer le seed : la base Neon fait foi.

Le détail — les normalisations appliquées, la répartition des cibles, pourquoi la colonne
`LIEN NAUTILJON` est ignorée — est dans `JOURNAL.md`, annexe « §8, la migration du Google Sheet ».

## 9. Hors périmètre V1

Décidé, à ne pas réintroduire sans arbitrage :

- Page de détail d'un tome (résumé, prix marchand, boutons d'achat)
- Écriture hors ligne et synchronisation
- Suivi de lecture — le champ `Possession.lu` existe mais n'est pas exposé
- Écran « Sorties à venir » — dépend de l'autorisation manga-news
- Scan de code-barres — après les quatre écrans de base
- Statistiques détaillées
- Multi-utilisateur, partage, fonctions sociales — **sauf la consultation en lecture seule de la
  collection d'un autre compte, sortie de cette liste par l'arbitrage du 17 septembre 2026**
  (§4 « Communauté », §13.7). Le reste y demeure : comparaison, suivi d'autres utilisateurs,
  badges, stats partagées

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

Dernière mise à jour : 18 septembre 2026.

**La production est sur `https://manga-collection-wcj8.vercel.app`.** L'URL n'était écrite
nulle part avant le 9 septembre, ni ici ni dans `JOURNAL.md` : impossible de vérifier un
déploiement sans la demander. Elle est publique — la garde est applicative, et les pages
`/acces` et `/inscription` répondent 200 à tout le monde ; c'est le trou assumé de §7, pas une
fuite. **Depuis §13.6 l'inscription y est libre**, d'où le `noindex` sur l'application.

Ce document est la mémoire du projet. Il est versionné : une session ouverte sur un autre
poste le retrouve intact. Rien d'utile ne doit vivre ailleurs.

**Le journal détaillé vit dans `JOURNAL.md`** — 75 entrées datées, de l'import du Sheet au
déploiement : ce qui a été construit, les chiffres qui l'établissent, les défauts trouvés et
leur cause. Il a été sorti d'ici le 7 septembre 2026 parce qu'il pesait les deux tiers de ce
document et que ses rectifications successives finissaient par se contredire d'un bout à
l'autre du fichier.

> **Le lire avant de conclure qu'une chose n'existe pas.** Une session de septembre a relu
> cette section et déduit à tort que rien n'était déployé, faute d'une ligne. L'absence d'une
> fonctionnalité *ici* ne prouve rien : `JOURNAL.md` fait foi sur ce qui est fait.

Ce qui suit regarde vers l'avant : **l'état chiffré** et **les pièges qui se répètent**, qui
restent ici. Le travail restant et les décisions encore ouvertes sont dans `TODO.md`, la reprise
sur un poste neuf dans `README.md` — sortis d'ici le 18 septembre 2026 pour le même motif que le
journal l'avait été le 7.

### L'état chiffré — lu en base le 21 septembre 2026

**Un seul tableau, relu à chaque fois plutôt que rectifié par empilement.** Les compteurs de §8
ont bougé depuis l'import et c'est normal : le planning élargit des dénominateurs, la promotion
des sorties échues crée des tomes, et l'écran Rechercher ajoute des séries. **Le bond du
16 au 21 septembre vient d'ailleurs** — trois comptes se sont inscrits et ont ajouté 13 éditions,
dont Kingdom à 77 tomes et Fairy Tail à 63.

| | |
|---|---|
| Séries · Éditions | **130** · **135** |
| Suivis (`SuiviEdition`) | **139** — `EN_COURS` 111, `ABANDONNEE` 19, `EN_PAUSE` 5, `VENDUE` 4. Plus de suivis que d'éditions : les comptes en partagent |
| `suivie = true` | **100** |
| Utilisateurs | **5** : le `PROPRIETAIRE` et 4 `UTILISATEUR`, dont un compte d'essai et trois personnes réelles inscrites les 17 et 18 septembre |
| Tomes (`Volume`) | **2 415** |
| Possessions | **1 880**, dont **1 315** possédées |
| **Couvertures de tomes** | **2 343 / 2 415**, soit **97,0 %**, servies depuis Cloudflare R2 |
| **Couvertures de sorties** | **33 / 36** |
| `sourceCouverture` sur `Volume` | **515 à `bnf`**, **148 à `mangadex`**, **1 752 à `null`** = indéterminé, antérieur au champ |
| `sourceCouverture` sur `Sortie` | **18 à `mangadex`**, **1 à `bnf`**, **17 à `null`** — la BnF ne peut rien sur une annonce, voir §5 |
| ISBN | **2 135 / 2 415** |
| Sorties annoncées (`Sortie`) | **36** — dont 4 dont le tome existe déjà, la coexistence étant le modèle depuis §13.1 |
| Liens entre séries (`LienSerie`) | **28** sur 23 séries, dérivés de MangaBaka |
| `Serie.idMangaBaka` | **127 / 130** — les 3 sans sont `les-legendaires-saga`, `my-hero-academia-ultra-archive`, `pandora-heart-8-5`, absentes de leur catalogue |
| `Serie.idMangaDex` | **21**, contre 5 le 16 septembre. Écrit par le cron, **et seulement une fois les trois garde-fous tenus** — voir « Fait — les couvertures dans le cron » au journal |
| `Volume.couvertureTenteeLe` | **527** tomes essayés, **1** tentative au plus ; **plus aucun tome n'est « jamais essayé »** |
| Tomes sans image | **72**, dont **64 sans aucun ISBN** — 58 sur `fairy-tail-edition-collector`, 11 sur `ippo-s4`, 2 sur `les-legendaires-saga`, 1 sur le grimoire. Aucun n'est récupérable, voir §5 |
| `Serie.alias` · `aliasNormalises` | **1 307** libellés · **1 438** formes indexées, formes japonaises comprises |
| Genres · Thèmes · Cible | **22** valeurs · **187** valeurs · `Shonen` 92 · `Seinen` 30 · `Echi` 7 · `Shojo` 1 |
| `AliasRecherche` | **6 lignes**, écrites par les rebonds réels de la recherche |
| `VignetteCatalogue` | **12 382 EAN interrogés**, **7 272 avec une image (59 %)** — mesuré le 10 septembre, le catalogue est couvert |
| `Edition.creeeParId` | **22 / 135** renseignés. `null` veut dire « venu de l'import » ; ces 22 viennent de `/ajouter` |
| `Edition.slugMangaNews` | **0 / 135**, et **ce n'est pas ce qui construit le lien** : la page Édition pointe sur une **recherche** manga-news par titre, donc le lien s'affiche toujours |
| Éditions à zéro tome possédé | **8** |
| Possessions portant `dateAchat` ou `prixPayeCentimes` | **0** — la V1 ne les écrit pas |
| `ParutionCatalogue` | **52 238** parutions, **janvier 2000 → février 2027 sans un mois manquant** |

Les quatre lignes de catalogue — `AliasRecherche`, `VignetteCatalogue`, `ParutionCatalogue` et
les abréviations — sont celles du 10 septembre : `data/backup.json` ne porte pas ces tables,
volontairement, elles se redérivent des CSV manga-news.

**La sauvegarde se relance avant de s'appuyer sur ses chiffres** — elle a menti de deux tomes le
7 septembre pour avoir été prise le 3. Et `data/backup.json` est dans la forme multi-compte
depuis le 9 septembre : **une sauvegarde d'avant ne se relit qu'avec l'ancien script**, que porte
le tag `avant-multi-compte`, seul chemin de retour.

### Pièges établis

Extraits du journal parce qu'ils se sont répétés et qu'ils coûtent cher à redécouvrir. Le
détail et les cas réels sont dans `JOURNAL.md`.

**Ce qui ne prouve rien**

- **Seule une vérification fonctionnelle prouve quelque chose — cinq fois.** Les sondes ont menti
  à chaque fois : `__reactFiber$*` n'atteste pas l'hydratation, un événement `input` fabriqué ne
  déclenche pas `onChange`, l'action `type` du pilote ne remplit pas toujours un champ, un curl
  qui rend 400 n'a jamais atteint l'application, et **cliquer une case hors écran ne déclenche
  rien sans que rien ne le signale**. Cliquer pour de vrai, sur un élément visible, puis regarder
  l'écran **et** la base.
- **Un clic d'automatisation ne prouve rien — septième fois.** Aux coordonnées d'une capture
  périmée il tombe hors de l'écran ; par référence d'élément juste après une navigation il
  précède l'hydratation. Dans les deux cas : aucune erreur, aucun log, l'écran inchangé.
  Recapturer juste avant de cliquer, et **ne conclure que sur la base**. Le 21 septembre 2026,
  la mise en page a changé d'échelle **entre la capture et le clic** sans que rien ne bouge à
  l'écran : c'est le journal du serveur, muet de tout `POST`, qui l'a dit.
- **Un seuil de similarité ne remplace pas une table écrite à la main — cinq fois.** Sur AniList
  la bonne réponse marquait 0,000 (`BLUE EYES SWORD` → *Hinowa ga Yuku!*), tronquer un titre
  produit des faux appariements confiants, et sur le planning quatre candidats sur cinq au-dessus
  de 0,80 étaient faux. Le motif qui marche est `RECHERCHES_MANUELLES` / `TITRES_MANUELS`,
  **chaque entrée confirmée à l'exemplaire** — jamais injectée en masse.
- **Le filtre qui suffit sur une fenêtre courte échoue en silence sur une archive longue —
  quatre fois.** Collision de titres à quinze ans d'écart (LEVIATHAN), marqueurs d'édition,
  rééditions dont le planning décrit un *autre objet physique*, purge de `Sortie` par un import
  qui ne les couvre pas. Corollaire : **le silence d'un import ne vaut pas suppression** — toute
  purge se borne à la fenêtre que le manifeste couvre réellement.
- **Une absence mesurée n'est pas une absence — les filtres par défaut d'une API sont invisibles.**
  Le 21 septembre 2026, trois recherches MangaDex ont rendu zéro sur *Demon Slave* et la spec a
  failli enregistrer « absente, vraisemblablement retirée sur DMCA ». Les trois portaient le même
  `contentRating` implicite. **Trois requêtes qui partagent un défaut ne font qu'une mesure**, et
  la seule façon de le voir est de lire la documentation de l'endpoint — c'est la variante API du
  piège suivant.
- **Le banc isole la base, pas Cloudflare R2.** `lib/r2.ts` lit le même `.env` quelle que soit la
  cible de `LOCAL_DATABASE_URL`, donc **une passe d'essai dépose dans le bucket de production**.
  Sans conséquence quand elle réécrit les mêmes octets au même chemin, mais le cache des
  couvertures est immuable un an : une image d'essai différente y resterait.
- **Avant de conclure qu'une API ne sait pas faire quelque chose, chercher sa documentation.**
  « La BnF plafonne à 150 px » a vécu dans ce document du 31 août au 10 septembre, et une sonde
  l'a « confirmée » en devinant le nom du paramètre — `couverture=2`, `3`, `4` au lieu de
  `taille`. La page officielle donnait les trois dimensions. **Cinq essais de paramètres devinés
  ne valent pas une page lue**, et une affirmation héritée du dépôt se vérifie avant d'être
  reconduite, surtout quand elle sonne juste.

**Ce qui fait perdre des données, ou lit la mauvaise base**

- **Tout script qui parle de la collection lit `data/backup.json`, jamais
  `data/collection.json` — trois fois.** `collection.json` est figé au point zéro de l'import :
  il ignore les titres corrigés et les séries ajoutées depuis l'application. Donc
  `npm run db:backup` précède `covers:fetch`, `publishers:fetch` et `titles:fetch`.
- **`LOCAL_DATABASE_URL` ne doit jamais entrer dans `.env` — elle se passe en préfixe de
  commande.** Trois programmes s'en servent pour choisir leur cible : `backup-db.ts`,
  `apply-migrations.ts` et **`lib/prisma.ts`**, donc l'application elle-même. Laissée dans
  `.env`, une sauvegarde irait silencieusement lire le banc et écraserait `data/backup.json`.
- **Une colonne neuve qui n'entre pas dans `backup-db.ts` sort du filet en silence — deux
  fois.** Rien ne le signale et les sept compteurs ne bougent pas, ce qui rend le trou invisible.
  **La colonne et sa ligne d'export partent dans le même commit.**
- **Le cache des couvertures est immuable un an.** Corriger une image ne suffit pas : un appareil
  qui a vu la mauvaise la garde. Et **supprimer un fichier ne nettoie pas la base** — toute
  suppression remet `couvertureUrl` à `null` dans le même geste.
- **Un script qui déduit son état d'un dossier ignoré par git repartira de zéro sur un autre
  poste.** `fetch_covers.py` fondait son idempotence sur `public/covers/` : sur un poste neuf il
  considérait que les 1 680 couvertures manquaient et les retéléchargeait toutes. ~1 287 images
  reprises pour rien — exactement la récupération massive que §5 dit d'éviter. Corrigé : il
  consulte `couvertureUrl` dans `data/backup.json`, puis son manifeste, le fichier local en
  dernier.
- **Le découpage `*:fetch` puis `*:apply` existe pour une relecture humaine.** Ne jamais
  enchaîner les deux. Relire aussi `data/planning-divergences.json`, où partent les lignes
  écartées.

**Ce qui casse sans le dire**

- **Une frontière client qui importe un module tirant Prisma casse le build** — le bundle
  navigateur réclame `node:module`. Les types et les règles pures vivent dans `lib/domain.ts`,
  les requêtes dans `lib/editions.ts`.
- **Une utilité Tailwind gagne toujours sur une règle de `@layer components`, quelle que soit la
  spécificité** — `utilities` passe après `components` dans la cascade de couches. Une règle de
  `globals.css` qui contredit une classe posée sur le même élément est donc **morte sans que rien
  ne le dise** : c'est ce qui a neutralisé la soustraction du safe-area sur `.colonne-onglets`, où
  `min-h-dvh` écrasait un `height: calc(100dvh - env(safe-area-inset-top))` du 17 septembre au
  18 septembre 2026. Quand les deux doivent coexister, **les deux vont dans `components`**.
- **`proxy.ts` nomme les fichiers publics un par un, donc déplacer un actif le fait passer
  derrière la garde d'accès.** Ce qui se casse est invisible depuis une session connectée : les
  icônes du manifeste sont demandées **avant** la connexion, à l'invite d'installation. Toute
  vérification se fait donc **sans cookie**, et contrôle les deux sens — l'actif rend 200, une
  page d'application rend toujours 307.
- **Un téléphone qui atteint `next dev` par l'IP du poste reçoit le HTML sans le JavaScript**, si
  son sous-réseau n'est pas dans `allowedDevOrigins` (`next.config.ts`). La page s'affiche
  normalement, ce qui est en CSS pur marche, **et tout ce qui est React est muet**. Deux signes
  qui ne trompent pas : le log dit `Blocked cross-origin request to Next.js dev resource`, et
  **aucune requête `?_rsc=` n'apparaît**.
- **Trois scripts Python appelaient `main()` sans garde `if __name__ == "__main__"`** — **les
  importer suffisait à les exécuter en entier**, et c'est arrivé : un script de vérification qui
  importait `fetch_covers` a relancé la passe complète. La garde est posée sur les deux qui
  restent.
- **`api.mangabaka.org` se ferme au poste professionnel après un gros volume.** ~250 requêtes
  passent, puis la connexion est **fermée sans réponse TLS** — `curl` rend 000, pas un 429. Ce
  n'est pas un plafond franchi et ce n'est pas le réseau en général : c'est l'interception TLS du
  poste. **Tout script qui parle à MangaBaka doit donc être reprenable.**
- **`npx prisma dev` rend une URL sur `template1`.** Toute base créée ensuite en hérite, schéma
  **et** `_prisma_migrations` : un banc qu'on croit vierge ne l'est pas. Le banc tourne en
  PostgreSQL 17.5 (wasm) là où Neon est en 18.6.
- **Après un `git pull` touchant au schéma, `npx prisma generate`** — `lib/generated/` est ignoré
  par git. Après un déplacement de route, purger `.next`, et redémarrer le serveur de
  développement s'il tournait.
- **`next-env.d.ts` est généré et bascule tout seul.** `next build` y écrit `./.next/types/…`,
  `next dev` y écrit `./.next/dev/types/…` : le commiter le fait rebasculer au prochain
  `npm run dev`. Le laisser hors des commits, sauf si c'est le seul objet du changement.

### Reste à faire

**Le backlog vit dans `TODO.md`** depuis le 18 septembre 2026, avec les décisions encore
ouvertes. Il pesait 20 000 caractères ici, sur un document relu en entier à chaque session.
Cinq familles y sont classées par valeur décroissante : ce que le passage à MangaBaka laisse
ouvert, ce qui améliore le chemin automatique, ce qui manque à l'application, ce qui tourne en
arrière-plan ou pas, et les échéances d'environnement.

### Reprendre sur un poste neuf

**`README.md`** porte l'installation, les variables d'environnement indispensables, ce que le
dépôt ne contient pas, et **le tableau des commandes dans leur ordre d'emploi**.

Deux règles qui ne se déduisent d'aucune commande : **toujours relire le manifeste entre le
`fetch` et le `apply`** — c'est la raison d'être du découpage en deux temps, et l'oublier a déjà
coûté une relecture après coup — et **`npm run db:backup` précède tout script qui parle de la
collection**.

## 13. Trajectoire V2 — V3

Décisions d'architecture prises en amont, pour ne pas les découvrir en chemin.
Ce qui est ici est **tranché**. Ce qui est encore ouvert vit dans `IDEES.md`, jamais ici.

---

### 13.1 La séparation catalogue / suivi — **faite le 9 septembre 2026**

Le chantier est terminé, et **son raisonnement complet est dans `JOURNAL.md`**, annexe
« §13.1, la séparation catalogue / suivi » : ce qui a été écarté, pourquoi `aVerifier` a été
supprimé plutôt que déménagé, pourquoi `suivie` remplace `termineeForcee` et non l'inverse,
quelle formule de backfill a été retenue et laquelle a été rejetée, et le plan des trois
migrations. **Une session qui rouvre un de ces choix a besoin de ces motifs** — c'est pourquoi
le texte est archivé et non supprimé.

Ce qui a été livré, en une ligne : `Utilisateur`, `SuiviEdition`, `Serie.alias` avec son index
GIN, `Edition.creeeParId`, `Possession` par compte avec `@@unique([utilisateurId, volumeId])`,
et cinq colonnes personnelles sorties d'`Edition`. Le schéma est lisible dans
`prisma/schema.prisma`, l'état chiffré en §12, le modèle en §2.

**Ce qui en reste opératoire, et qui vaut pour tout chantier à venir :**

> **Le critère : anticiper ce qui déplace, jamais ce qui ajoute.** Ce qui déplace ou réinterprète
> des lignes existantes coûte de plus en plus cher à chaque compte créé ; ce qui ajoute une table
> ou une colonne coûte pareil aujourd'hui et dans un an. **Le critère de fin de §13.1 est
> atteint : plus rien de ce qui déplace des lignes existantes ne reste à faire.**

- **Le vrai coût d'un chantier n'est pas le schéma, ce sont les sites de lecture** — 19 pour
  §13.1, 10 actions gardées pour §13.6. C'est là qu'est le risque, pas dans le SQL.
- **« Ma collection » = ce pour quoi j'ai une ligne `SuiviEdition`.** Toute requête d'écran part
  de `SuiviEdition` et joint `Edition`, jamais l'inverse — voir §2. Le Planning et les Manquants
  subissent la même inversion : sans elle, chacun verrait les sorties des séries des autres.
- **`ParutionCatalogue` et `Sortie` : deux tables, deux rôles, aucune redondance.** La première
  est toute l'archive manga-news, 2000 → aujourd'hui, sans clé étrangère et **jamais purgée** ;
  la seconde porte les annonces d'une édition qui existe, avec `editionId`, sa couverture et sa
  promotion en tome, sous une **rétention glissante de M-1 à M+6**. **La fenêtre porte sur
  `Sortie`, jamais sur `ParutionCatalogue`** : purger l'archive supprimerait la résolution
  ISBN → série, c'est-à-dire ce qui a fait passer le scanner de 9,2 % à 87 %.
- **Un `Volume` et sa `Sortie` coexistent, et c'est le cœur du modèle** — arbitré le 21 septembre
  2026. Un tome paru devient un `Volume` **le jour de sa date**, donc il est cochable dans la
  grille et compte dans `tomesParus` : quelqu'un qui vient d'ajouter la série coche toute sa
  collection sans passer par le Planning. **Sa `Sortie` n'est pas supprimée pour autant** : elle
  ne dit plus « ce tome va paraître » mais **« ce tome vient de paraître »**, et c'est la seule
  information qu'elle porte encore. Les deux tables ne s'excluent plus.
- **La `Sortie` vit deux mois après la parution.** `MOIS_AU_PLANNING_APRES_PARUTION` (2) pilote
  `debutRetroactivitePlanning()` : le cron supprime une `Sortie` antérieure au premier jour du
  mois **précédent**, à condition que son tome existe. Un tome sorti en septembre quitte donc le
  Planning le 1er novembre. Le motif est qu'une parution **se voit mieux au Planning que dans
  Manquants** — elle y porte sa date, sa couverture et son bouton « Je l'ai », là où Manquants ne
  donne qu'une ligne parmi les trous. Conséquence à connaître : pendant ces deux mois le tome est
  **dans les deux écrans**, et c'est voulu.
- **La disparition par compte est une lecture, jamais une écriture.** `chargerPlanning` retire les
  annonces dont je possède déjà le tome ; la ligne `Sortie`, elle, ne bouge pas. **C'est ce qui
  corrige un défaut réel** : jusqu'au 21 septembre 2026, `promouvoirSortie` faisait
  `sortie.delete()`, donc **un compte cliquant « Je l'ai » retirait la sortie du Planning de tous
  les autres**. Personne ne l'avait vu parce qu'il n'y avait qu'un compte quand le bouton a été
  écrit. `Possession` était déjà par compte ; c'est `Sortie`, table de catalogue, qui ne pouvait
  pas l'être — et elle n'a pas besoin de l'être.
- **« Je l'ai » ne fait donc plus qu'une chose : poser ma possession** (en créant le `Volume` s'il
  manque encore, par exemple le jour même de la parution avant le passage du cron). C'est
  exactement ce que fait un tap dans « Mes tomes », et les deux gestes ont le même effet sur le
  Planning. L'autorisation vient toujours de la date, pas du rôle : `promouvoirSortie` exige un
  `SuiviEdition`, et **le cron refuse une sortie qui n'est pas le tome suivant**, la laisse au
  Planning et la nomme dans son bilan (`horsSequence`). « Je l'ai » comble l'intervalle comme
  avant : celui qui tient le tome 15 atteste que les 11 à 14 sont parus.
- **La constante est dupliquée entre `lib/constants.ts` et `import_planning.py`** — même nom, un
  `grep MOIS_AU_PLANNING_APRES_PARUTION` les trouve, elles doivent bouger ensemble. Côté script,
  une ligne de date passée entre dans `tomes` **et** dans `aParaitre` si elle est dans la fenêtre :
  elle fait grandir `tomesParus` et laisse une `Sortie` derrière elle.
- **Piège sur les enums** : `apply-migrations.ts` enveloppe chaque fichier dans une transaction,
  et PostgreSQL interdit d'**utiliser** une valeur d'enum dans la transaction qui l'ajoute. Une
  migration qui ferait `ALTER TYPE … ADD VALUE` puis un `UPDATE` s'en servant échouerait. Il faut
  deux migrations, ou une colonne booléenne.
- **Piège de dépôt** : `npm run build` enchaîne `db:migrate`. Des fichiers déposés dans
  `prisma/migrations/` sont appliqués **au prochain déploiement Vercel**, sans le code
  correspondant. Tant que le code n'est pas prêt, les garder dans `prisma/pending-migrations/`.
- **Une page `/edition/<slug>` hors de ma collection reste sans décision** : 404, ou affichage
  catalogue avec un bouton « Ajouter à ma collection » ? Le second est la porte d'entrée dont
  §13.2 a besoin. Rien ne presse — la visite d'une collection tierce passe par §4 « Communauté »,
  dont les lignes sont inertes pour exactement cette raison.

---

### 13.2 V2 — les autres utilisateurs

> **Trois morceaux de cette section sont faits et archivés** dans `JOURNAL.md`, annexe « trois
> morceaux de §13.2 que leur chantier a rattrapés » : l'identité, livrée par §13.6 ; l'amorçage
> du catalogue par les archives manga-news, avec les mesures et l'arbitrage du 4 septembre qui
> le laisse dans `ParutionCatalogue` plutôt que consolidé en `Serie` ; et le passage à
> Cloudflare R2, fait le 3 septembre 2026. Ce qui suit est encore devant.

#### Les deux rôles

> **Il y en avait trois jusqu'au 11 septembre 2026.** L'invité a été supprimé avec §13.6 : on
> consulte avec son propre compte, pas avec un rôle de jeton. La colonne est gardée ici parce
> qu'elle dit ce qu'il savait faire, et donc ce que §13.7 a eu à redonner.

| | ~~Invité~~ | Utilisateur | Propriétaire |
|---|---|---|---|
| Consulter | ~~oui~~ | oui | oui |
| Cocher ses tomes, changer son statut | ~~non~~ | oui | oui |
| Ajouter une série au catalogue | ~~non~~ | oui, marquée | oui |
| Modifier nom, éditeur, tomes parus, parution | ~~non~~ | non | oui |
| Importer le planning, lancer les scripts | ~~non~~ | non | oui |
| Relire les ajouts marqués | ~~non~~ | non | oui |

Le motif existe déjà et il est prouvé : `exigerAcces` pour toute écriture personnelle,
`exigerProprietaire` pour le catalogue. Ajouter un rôle est une extension, pas une refonte.

**La frontière reste dans les Server Actions**, jamais dans l'interface — vérifié le
30 août en appelant `definirParution` avec un cookie invité : 500 et aucune écriture.
L'interface qui masque les contrôles est un confort, pas la protection.

#### La règle d'ajout : libre, mais marqué

Un utilisateur peut créer une édition depuis le catalogue. C'est une écriture dans le catalogue
partagé. L'ajout est **libre et immédiatement visible de tous**, avec `creeeParId` renseigné et
un drapeau de relecture levé jusqu'à validation par le propriétaire.

Écarté : l'ajout privé jusqu'à validation — deux visibilités, donc une condition dans toutes
les requêtes du catalogue — et l'ajout libre sans garde-fou, qui dégrade en silence.

**Ce drapeau n'est pas `aVerifier` et ne doit pas en reprendre le nom** (arbitré le 4 septembre).
`aVerifier` disait « la répartition de mes tomes a été devinée » — une donnée personnelle, issue
de l'import du Sheet, dont la source est morte avec la décision qu'il n'y aura plus d'import de
collection. Le drapeau dont §13.2 a besoin dit « cette fiche de **catalogue** n'a pas été
relue » : il est partagé, il vit sur `Edition` aux côtés de `creeeParId`, et c'est un champ
**neuf**. C'est ce nom unique pour deux sens qui avait produit la contradiction.

**Et il est moins nécessaire qu'il n'y paraît.** La qualité d'une fiche se joue à la saisie, pas
à la relecture : la porte d'ajout est `/ajouter` et `/scanner`, adossés à `ParutionCatalogue`,
qui portent le vrai nom FR, le marqueur d'édition, l'éditeur et l'EAN. Améliorer la porte vaut
mieux que marquer ce qui passe. **À rouvrir quand il y aura un troisième compte, pas avant.**

#### Les variantes de tome

Un tome collector n'est pas « le même avec une autre couverture » : c'est un objet physique
distinct, avec son ISBN, son prix et sa date. C'est le problème des éditions, un cran plus bas.

```
VarianteVolume (id, volumeId, nom, isbn, couvertureUrl, prixCentimes)
Possession.varianteId → nullable
```

Écarté : un simple `Volume.couverturePersoUrl`. Une demi-heure de travail, mais une impasse —
personne d'autre n'en profite et **on ne peut jamais savoir qu'une variante existe**.

L'angle collection recherché n'est pas « ma couverture s'affiche », c'est *« il existe une
jaquette alternative du tome 5 et je ne l'ai pas »*. Le manque est le moteur ; le remplacement
d'image ne l'exprime pas.

Contrairement à 13.1, **cette table peut arriver plus tard sans douleur** : c'est un ajout,
pas un déplacement de colonnes.

#### Filtres : genres seulement

Les genres viennent d'une liste fermée — celle de MangaBaka depuis le 9 septembre : **22
valeurs**, normalisées, filtrables. Les **thèmes ne sont pas filtrables** : **143 valeurs en
deux langues**, les 99 françaises d'origine avec leurs coupures d'import (`Post` + `apo`,
`Super` + `héros`, `Combats` / `Combat`) et les anglaises venues de MangaBaka. Un filtre « apo »
exposé à un utilisateur tiers est indéfendable ; le nettoyage des thèmes attend un écran qui les
affiche.

**La table de correspondance d'affichage se pose avant le filtre, pas après.** Les genres sont
stockés en anglais — c'est la clé, elle ne se traduit pas en base — mais l'interface est en
français : un filtre livré tel quel afficherait « Slice of Life » et « Supernatural » au milieu
d'un écran français. Le sens de la correspondance est donc **stockage anglais → libellé français
à l'affichage**, comme `.titre-serie` rend les capitales sans les écrire en base.

#### Ce que le catalogue impose encore aux requêtes

**Deux requêtes tiennent aujourd'hui parce que la base est petite et ne tiendront plus face à un
vrai catalogue** : l'anti-doublon de la recherche, qui charge tous les titres de série, et
`resoudreIsbn`, qui charge toutes les éditions pour apparier un titre. **Les deux doivent passer
par un index** — à 11 530 séries de catalogue, ça ne tient plus. L'inversion par `SuiviEdition`
a borné la troisième, `chargerCollection`, quoi qu'il arrive.

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

1. ~~**`Serie.alias`**~~ — **fait le 10 septembre 2026.** `alias` porte les libellés affichables,
   **`aliasNormalises` porte la forme comparable** et son index GIN : la recherche locale fait un
   `has()` exact sur l'index au lieu d'un `contains` sensible à la casse, qui ne pouvait pas
   faire correspondre « jjk » à « JJK ». Les deux colonnes sont dérivées et se réécrivent
   entièrement à chaque `mangabaka:apply` — ne rien y saisir à la main sans le savoir.
2. **Recherche plein texte PostgreSQL** — normalisation des accents, trigrammes, natif sur Neon
3. **L'ISBN comme chemin privilégié** — le scan court-circuite entièrement la recherche ;
   chaque scan est un appariement exact
4. ~~**Les alias appris**~~ — **fait le 10 septembre 2026, mais pas comme prévu.** Le plan disait
   « JJK suivi de l'ouverture de Jujutsu Kaisen enregistre l'association », c'est-à-dire une
   observation du comportement. La donnée MangaBaka rend ça inutile pour l'essentiel : « JJK » y
   **est déjà**, comme titre alternatif noté « Short title ». Ce qui est enregistré n'est donc pas
   ce que l'utilisateur a cliqué mais **ce que MangaBaka a répondu** — le rebond de §5 écrit une
   ligne `AliasRecherche` (`normalise` → `titres`), et la fois suivante le terme est résolu sans
   sortir de la base. C'est plus sûr : un clic ne prouve pas qu'une association est juste, alors
   qu'ici l'association vient d'un catalogue.

   **La conséquence à connaître : la recherche fait un appel externe.** §5 dit « jamais à
   l'ouverture d'un écran », et c'est respecté — le rebond ne part que sur une frappe, et
   seulement quand le local **et** le catalogue ont rendu zéro résultat. Mais c'est bien un appel
   dans le chemin d'une interaction, la première fois pour un terme donné, et il dégrade en
   silence si MangaBaka ne répond pas : l'écran affiche « Aucun résultat », pas une panne.

L'appariement difficile ne subsiste qu'à l'import du catalogue : **une fois, hors ligne,
sous supervision**, jamais pendant qu'un utilisateur attend.

#### Diffusion Android

Bubblewrap, déjà exploré (`TODO.md`) : `/.well-known/` est ouvert côté garde, restent
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

### 13.4 Les quatre échéances externes

Elles ne dépendent pas du code et ont le **même déclencheur : le premier euro encaissé**.
Tout ce qui précède est réversible ; à partir de là, non.

**La licence de MangaBaka interdit le commercial** — CC BY-NC-SA 4.0, constaté le 10 septembre
2026, et c'est la quatrième, ajoutée le jour où la source est entrée dans le code. Le `NC`
interdit l'usage commercial des données originales de MangaBaka ; le `SA` imposerait de
repartager à l'identique ce qui en dérive. Les genres, thèmes, cible, alias et liens de séries
en viennent depuis cette date. Trois issues, à trancher **avant** d'ouvrir le paiement, pas
après : demander une licence commerciale à MangaBaka, se replier sur des sources sans clause
`NC`, ou renoncer au paiement. **Ne pas se rassurer en disant que ce ne sont que des métadonnées**
— c'est exactement ce que la licence couvre.

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

Quatre fichiers, quatre statuts. Les confondre donnerait à une intuition le même poids qu'à une
décision, et une session future ne saurait plus ce qui fait foi.

| Fichier | Ce qu'il porte |
|---|---|
| **`CLAUDE.md`** | la spécification et les décisions **tranchées**. Fait foi |
| **`JOURNAL.md`** | ce qui est **déjà fait**, daté, avec les chiffres et les causes. Fait foi sur l'état. Porte aussi, en annexe, le raisonnement complet des chantiers terminés |
| **`TODO.md`** | le travail **restant** et les décisions en attente d'arbitrage technique |
| **`IDEES.md`** | les envies **non tranchées**. Ne fait foi sur rien |

`README.md` porte l'installation et les commandes — c'est de l'outillage, pas une décision.

Une idée n'entre en §13 **qu'une fois arbitrée**, avec ce qui a été écarté et pourquoi. Une
entrée n'entre dans `JOURNAL.md` **qu'une fois vérifiée fonctionnellement** — le document a
quatre fois la preuve qu'une sonde ne prouve rien.

**Et un chantier terminé quitte §13.** Il y laisse ce qui reste opératoire — la règle, le piège,
le critère — et son raisonnement part en annexe de `JOURNAL.md`. C'est ce qui a été fait le
18 septembre 2026 pour §13.1, §13.6 et §13.7 : le document pesait 184 700 caractères, soit
4,6 fois le seuil au-delà duquel une session le relit en entier pour un coût qui dilue le reste.
**Écrire le motif reste la règle ; le garder ici une fois le chantier fini ne l'est pas.**

---

### 13.6 L'identité et les comptes — arbitrée et faite le 11 septembre 2026

**Le raisonnement complet est dans `JOURNAL.md`**, annexe « §13.6, l'identité et les comptes » :
ce qui est tranché et son motif, ce qui a été écarté — le rapprochement automatique par email,
« le premier compte créé devient propriétaire », la garde à trois niveaux, la table `Session` —
et la reprise de la collection existante.

Ce qui vit maintenant dans le modèle est en §2 « Utilisateur » : `identifiant` normalisé et
unique, `motDePasseHash` en `scrypt` de `node:crypto` — sel de 16 octets, vérification par
`timingSafeEqual`, **aucune dépendance** —, `versionJeton` qui coupe toutes les sessions d'un
compte quand son mot de passe change, et `email` obligatoire mais **non vérifié**. Neuf des dix
actions gardées sont passées à `exigerAcces()` ; **seule `definirParution` garde
`exigerProprietaire()`**, par la lettre de §13.2.

**Trois conséquences qui tiennent toujours :**

- **Une adresse email squattée bloque son vrai titulaire** — `email` est `@unique`. C'est le
  lot 2 qui dénoue ça ; d'ici là, `npm run compte`.
- **Une restauration remonte les comptes sans aucun mot de passe** : le hash n'entre pas dans
  `data/backup.json`, le dépôt étant public (§7) — un hash publié s'attaque hors ligne, sans
  limite de tentatives. Après un `db:backup -- --restore`, plus personne ne se connecte avant un
  passage de `npm run compte`. Les sept compteurs ne bougent pas, donc le contrôle de
  restauration reste valable.
- **Le piège du premier jour** : passer par le formulaire d'inscription **avant** le script crée
  un compte neuf et vide. Rien n'est perdu, mais il faut alors supprimer le compte parasite.
  D'où l'ordre : sauvegarde, script, connexion, **et on vérifie qu'on voit sa collection**. Une
  collection vide à la première connexion est le signal qu'on s'est trompé de ligne.

#### Lot 2 — la réinitialisation par email

Hors chantier, et **sans pénalité : c'est un ajout**. Trois surfaces — demander, saisir le code,
choisir le nouveau mot de passe —, `nodemailer` et le **SMTP de Gmail avec un mot de passe
d'application**.

Le choix de l'expéditeur est arbitré et vaut d'être su : **Resend exige un domaine vérifié pour
écrire à une adresse arbitraire**, donc sans domaine il ne peut pas servir un ami ; Brevo et
Mailjet acceptent de vérifier **une adresse seule**, mais un envoi depuis un `@gmail.com` via
leurs serveurs n'est aligné ni SPF ni DKIM — c'est le cas nominal du classement en indésirable.
Gmail est aligné par construction.

**Et ce maillon ne s'éprouve qu'en production** : `api.mangabaka.org` se ferme déjà à ce réseau
par interception TLS (§12), donc un 587 sortant depuis le poste ne prouverait rien, ni dans un
sens ni dans l'autre.

---

### 13.7 La visibilité entre comptes — arbitrée et faite le 17 septembre 2026

**L'écran est décrit en §4 « Communauté », qui fait foi.** Le choix et les deux formes écartées
sont dans `JOURNAL.md`, annexe « §13.7, la visibilité entre comptes ».

La forme retenue est **publique par défaut entre comptes connectés** : rien à accorder, rien à
maintenir, aucune table, et c'est la seule qui rende un classement possible — un top 10 suppose
de pouvoir regarder tout le monde. Écartées : la visibilité **sur autorisation** — « la forme
juste, et la plus chère », une table, deux écrans et une condition de plus dans chaque requête,
à rouvrir le jour où quelqu'un veut ne pas être vu — et le **lien opaque**, la seule qui marche
sans compte, mais qui rouvrirait la session en lecture seule que §13.6 venait de supprimer.

**Ce que ça expose est le prix assumé** : l'inscription est libre et le domaine de production est
public, donc tout compte inscrit est visible de tout compte inscrit. La contrepartie est que
**l'argent ne sort pas** — ni valeur totale ni prix. C'est ce qui rend la forme tenable : ce
qu'on publie est une liste de séries, pas un patrimoine.

**Le retrait existe depuis le même jour** : `Utilisateur.visible`, `@default(true)`, réglable
depuis `/compte`. Il ne change rien à la forme retenue — le défaut reste la visibilité, et se
retirer est un geste actif.

**`exigerUtilisateur()` ne naît toujours pas**, contrairement à ce que §13.6 prévoyait : il n'a
pas de différence à porter face à `exigerAcces()`. **La lecture seule ne tient pas à une garde
mais à l'absence de chemin d'écriture** — aucune action de `lib/actions.ts` n'accepte un
identifiant de compte en paramètre. Une garde de plus aurait donné l'illusion d'une protection
là où c'est la forme des actions qui protège.

**Reste ouvert**, et vit dans `IDEES.md` : la visibilité **sans compte** — la seule chose que
l'invité savait faire et qui n'est jamais revenue —, et tout ce que §13.3 met derrière le mur :
comparaison, suivi d'autres comptes, badges.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
