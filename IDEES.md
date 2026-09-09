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

### Le rôle invité disparaît quand les comptes existent — 9 septembre 2026

Dit en éprouvant la Phase 2 : le mode invité fonctionne, **mais il n'a de raison d'être que
faute de comptes.** Une fois l'identité en place (§13.2), on ne se connectera plus « en invité » :
un utilisateur consultera la collection d'un autre **avec son propre compte**. La consultation
d'autrui remplace le rôle, elle ne s'y ajoute pas.

Ça n'est pas encore tranché — d'où la présence ici — mais deux conséquences sont déjà connues :

- **§13.2 décrit trois rôles, Invité / Utilisateur / Propriétaire.** Si l'invité s'en va, il
  reste deux rôles et une **visibilité** : qui peut voir la collection de qui. Ce n'est pas un
  rôle, c'est une relation entre comptes, et personne ne l'a encore dessinée — publique par
  défaut, sur autorisation, par lien ?
- **`utilisateurCourant()` a une ligne à durée de vie connue.** `lib/utilisateur.ts` résout
  l'invité vers l'id du propriétaire en lecture seule ; c'est indispensable aujourd'hui et
  ça devient mort le jour où le rôle s'en va. À supprimer avec lui, pas avant.

Reste à décider : ce que voit un compte sans collection à lui, et si le partage d'URL publique
survit sous une forme quelconque — c'est aujourd'hui le seul moyen de montrer sa collection à
quelqu'un.

## Questions ouvertes

- **La pile à lire arrive-t-elle dans ce lot ou après ?** C'est la seule des quatre pastilles
  qui demande un geste nouveau et une écriture que rien ne fait aujourd'hui.
- **Le tri et la recherche s'appliquent-ils au panneau actif ou restent-ils globaux ?** La
  référence n'affiche qu'un seul champ, ce qui suggère qu'il filtre le panneau visible.
- **Les compteurs d'en-tête restent-ils globaux ou suivent-ils le panneau ?**
- **Que devient l'onglet Manquants de la barre du bas** une fois « Compléter » dans la bande ?
  Deux navigations désigneraient la même chose.
- **Le vocabulaire de « À jour ».** D.Gray-man est dit « à jour dans la parution » alors que
  l'application le montre 25/29 en « Édition en cours », le libellé exigeant
  `possédés == tomesParus`. Deux idées distinctes que le modèle fond en une : *je suis la
  parution* et *j'ai des trous anciens*. `suivie` capture la première pour le Planning ; reste à
  savoir si le libellé de la Collection doit la refléter.

## Écarté

_(à remplir — garder le motif, il évite de reproposer)_

---

## Arbitré — parti dans `CLAUDE.md`

Trace de sortie, pour qu'une session qui se souvient de la discussion sache où elle a fini.

- **Remplacer « terminé par choix » par « suivre »** — proposé le 4 septembre, **arbitré le
  8 septembre 2026**. `suivie` remplace `termineeForcee`, `@default(true)`, backfill
  `statut = 'EN_COURS' AND termineeForcee = false` → 84 suivies. `raisonCompletion` supprimée
  avec elle. Voir §13.1, « `suivie` remplace `termineeForcee` ».
