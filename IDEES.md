# Idées — non tranché

Ce fichier porte les envies, les intuitions et les questions ouvertes.
**Rien ici ne fait foi.** `CLAUDE.md` seul décrit ce qui est décidé et ce qui est construit.

Une idée quitte ce fichier quand elle est arbitrée : elle part alors dans `CLAUDE.md`,
avec ce qui a été écarté et pourquoi. Une idée abandonnée descend dans « Écarté » plutôt
que d'être supprimée — pour ne pas la reproposer dans six mois.

---

## Comment mener une session de brainstorm

Le piège est de produire une liste de fonctionnalités. Une liste ne se priorise pas : tout
y semble également désirable, et rien ne dit ce qui doit exister en premier.

Cinq questions donnent de meilleurs résultats qu'une liste :

**Qu'est-ce qui m'agace aujourd'hui, en utilisant l'app ?** L'irritation réelle bat
l'idée théorique. Elle produit des fonctionnalités qui seront utilisées.

**Qu'est-ce que je fais encore à la main, hors de l'app ?** Le planning avant l'écran
Planning, les couvertures avant le script. Chaque geste manuel récurrent est une
fonctionnalité qui a déjà fait ses preuves.

**Qu'est-ce qui me ferait ouvrir l'app un jour où je n'achète rien ?** C'est la question
de la rétention. Une app de suivi pur ne s'ouvre qu'à l'achat — soit deux fois par mois.

**Qu'est-ce qu'un ami me demanderait au bout de dix minutes ?** Les manques deviennent
visibles à la première paire d'yeux extérieure.

**Qu'est-ce que je regrette de ne pas savoir sur ma collection ?** Les questions auxquelles
le Sheet ne répondait pas, et l'app pas encore.

Noter les réponses telles quelles, sans les trier ni les habiller en fonctionnalités.
L'arbitrage vient après.

---

## En attente d'arbitrage

### Remplacer « terminé par choix » par « suivre » — 4 septembre 2026

**Le reproche fait à `termineeForcee` est qu'il mélange deux choses.** C'est un *jugement sur la
collection* — « je considère cette série finie » — dont l'effet est de *masquer une liste de
courses*. Or on peut vouloir considérer une série finie **et** continuer à voir les tomes qui
manquent. AIR GEAR est le cas : le drapeau a été retiré volontairement, pour retrouver les cinq
tomes manquants dans Manquants — au prix du libellé « Terminée par choix ». Le modèle ne savait
pas exprimer l'intention, il a fallu le détourner.

D.Gray-man est l'autre face du même problème : 25/29, trous aux tomes 9, 10, 13 et 18, parution
en cours. Suivi de près côté nouveautés, troué au milieu.

**La proposition : un booléen `suivie` sur `SuiviEdition`, qui ne répond qu'à une question —
est-ce que je veux être rappelé de ce qui manque ?** Il ne prétend rien sur l'état de la
collection, et c'est ce qui le rend lisible.

| Possédés | Suivie | Manquants | Planning | Où la série vit |
|---|---|---|---|---|
| ≥ 1 | oui | les trous | les sorties | Collection |
| ≥ 1 | non | rien | rien | Collection |
| 0 | oui | **rien** | **rien** | **Wish list** |
| 0 | non | rien | rien | nulle part |

`suivie` ne remplace pas `statut`, qui reste le rapport personnel et continue de piloter le
libellé et la désaturation. Deux axes, comme `editionTerminee` et `statut` le sont déjà.

**L'appartenance à la wish list est déduite, jamais stockée** :
`possédés = 0 ET suivie ET statut ≠ VENDUE`. Cocher un tome fait basculer en collection,
décocher le dernier ramène en wish list. Aucun champ à maintenir, aucun état à désynchroniser,
et l'« instantanément » tombe tout seul puisque c'est une conséquence de la requête. L'exclusion
des vendues est nécessaire : les 4 éditions vendues sont justement à zéro tome possédé.

**Ce que ça unifie.** Trois mécanismes cachent aujourd'hui des choses de Manquants —
`termineeForcee`, `statut = VENDUE`, et la section repliée « Abandonnées et en pause ». Aucun ne
touche le Planning, d'où un défaut mesuré le 4 septembre : **4 des 16 sorties portent sur des
séries abandonnées** — `one-puch-man`, `les-legendaires-saga`, `why-nobody-remember-my-world`,
`blue-exorcist`. Un seul filtre les remplace, sur les deux écrans.

**Reprise recommandée : `suivie = (statut = 'EN_COURS' AND termineeForcee = false)`.**

| | |
|---|---|
| `EN_COURS` non forcée → suivie | **84** |
| `EN_COURS` forcée — `judge`, `nozokiana` → non suivie | 2 |
| `ABANDONNEE` → non suivie | 18 |
| `EN_PAUSE` → non suivie | 5 |
| `VENDUE` → non suivie | 4 |

Cette formule a la propriété qu'on cherche : **elle ne change rien à Manquants**, dont la liste
principale correspond déjà à « EN_COURS non forcée » — 16 éditions, 116 tomes. Le seul
changement visible est le Planning qui perd ses 4 sorties fantômes, c'est-à-dire la correction
du défaut. Une reprise qui ne casse rien, ajustable ensuite d'un tap. Et AIR GEAR devient
`suivie = true`, ce qui est exactement l'intention d'origine, obtenue sans détourner un drapeau.

La section repliée « Abandonnées et en pause » de Manquants disparaît : si on ne veut pas les
voir, on ne les suit pas. Ça retire `Manquants.arretees` du domaine et libère le motif
`CollapsibleSection` sur cet écran.

**À trancher avant que M2 soit écrite.** `termineeForcee` déménage déjà vers `SuiviEdition` :
le renommer et l'inverser dans le même backfill ne coûte rien, alors que le faire après
imposerait une seconde migration sur la même colonne — exactement ce que le critère
« anticiper ce qui déplace » de CLAUDE.md §13.1 dit d'éviter.

### Refonte de la Collection en panneaux glissants — 4 septembre 2026

Référence fournie en capture : l'application de référence pose une **bande de pastilles
horizontale, elle-même défilable**, sous la recherche, la pastille active en plein accent —
« PILE À LIRE · COLLECTION · COMPLÉTER · EN… ». La recherche et le tri restent au-dessus.

**Panneaux retenus** : pile à lire, collection, wish list, **et Manquants** (tranché le
4 septembre — « Compléter » dans la référence). Glissement horizontal d'un panneau à l'autre.

Une série de la wish list ouvre une **vraie page édition**, avec ses couvertures et ses
métadonnées, identique à celle d'une série possédée.

**Faisable sans dépendance** : conteneur en `overflow-x` avec `scroll-snap-type: x mandatory`,
panneaux à `100%` en `scroll-snap-align`. On récupère l'inertie native d'iOS et d'Android, ce
qu'aucune librairie ne fait mieux. La bande se synchronise par `IntersectionObserver` sur les
panneaux, un clic sur une pastille faisant un `scrollIntoView({ behavior: "smooth" })`.

**Les cinq difficultés, la plus chère d'abord :**

1. **Les couvertures d'une série de wish list — le vrai coût, et ce n'est pas de l'interface.**
   Une édition créée par `/ajouter` arrive avec `couvertureUrl` nul sur tous ses tomes : le
   pipeline est un script Python local lancé à la main. Il faut porter en TypeScript le
   sélecteur MangaDex, celui qui pénalise les fiches satellites — sans lui, un appariement naïf
   fait repartir Bleach avec 1 tome sur 74. Déjà dans « Reste à faire ». Sortie de secours : la
   tâche quotidienne existante met la série en file et les couvertures arrivent dans les 24 h,
   ce qui évite une Server Action longue que le délai des fonctions Vercel couperait. Les
   métadonnées, elles, marchent déjà — auteur et genres viennent d'AniList à la création.
2. **« Pile à lire » n'est pas un réarrangement mais une fonctionnalité neuve.** Elle repose sur
   `Possession.lu`, que **rien n'écrit** — §9 met le suivi de lecture hors périmètre V1. Il faut
   d'abord un geste pour marquer lu ; l'appui long de la grille, que §4 réserve à la V2 « sans
   effet en V1 », est le candidat naturel. Sans ce geste la page reste vide pour toujours.
3. **Le défilement vertical par panneau casse la mémoire de position.**
   `useMemoireDefilement` écoute `window` et stocke `window.scrollY` ; avec des panneaux en
   `overflow-y: auto` la fenêtre ne défile plus. Il faut trois clés et un hook prenant une ref
   d'élément. Piège éprouvé le 4 septembre : un `scroll_to` sur la grille de « Mes tomes » n'a
   rien bougé, le conteneur défilant à la place de la page.
4. **Plusieurs listes dans le DOM en même temps.** Le `loading="lazy"` de `components/cover.tsx`
   devrait empêcher les panneaux hors écran de charger leurs images, mais le comportement des
   navigateurs dans un défilement horizontal est **à mesurer** à l'onglet réseau, pas à supposer.
5. **Le budget vertical de l'en-tête.** Il porte déjà deux rangées — titre avec compteurs et
   valeur, puis recherche et tri. La bande en fait une troisième, à 430 px de large.

**Ordre : après la migration multi-compte, jamais avant.** Les panneaux sont tous des vues par
utilisateur sur `SuiviEdition` et `Possession` ; construire l'écran d'abord obligerait à écrire
les requêtes deux fois.

## Questions ouvertes

- **La pile à lire arrive-t-elle dans ce lot ou après ?** C'est la seule des quatre pastilles
  qui demande un geste nouveau et une écriture que rien ne fait aujourd'hui.
- **Le tri et la recherche s'appliquent-ils au panneau actif ou restent-ils globaux ?** La
  référence n'affiche qu'un seul champ, ce qui suggère qu'il filtre le panneau visible.
- **Les compteurs d'en-tête restent-ils globaux ou suivent-ils le panneau ?**
- **Que devient l'onglet Manquants de la barre du bas** une fois « Compléter » dans la bande ?
  Deux navigations désigneraient la même chose.
- **Que devient `raisonCompletion` ?** Elle porte encore le texte d'import sur `judge`,
  `nozokiana` et `air-gear`, et aucun écran ne l'affiche. Note libre « pourquoi j'ai arrêté de
  suivre », ou suppression avec `termineeForcee` ?
- **Le vocabulaire de « À jour ».** D.Gray-man est dit « à jour dans la parution » alors que
  l'application le montre 25/29 en « Édition en cours », le libellé exigeant
  `possédés == tomesParus`. Deux idées distinctes que le modèle fond en une : *je suis la
  parution* et *j'ai des trous anciens*. `suivie` capture la première pour le Planning ; reste à
  savoir si le libellé de la Collection doit la refléter.

## Écarté

_(à remplir — garder le motif, il évite de reproposer)_
