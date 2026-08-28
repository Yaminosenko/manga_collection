# Handoff — Collection & page Édition (V1)

## Vue d'ensemble

Deux écrans de l'application de suivi de collection de mangas décrits dans `CLAUDE.md` :

1. **Collection** — la liste des éditions, écran principal.
2. **Édition** — la page de détail, et sa **sous-page « Mes tomes »** : la grille de sélection tome par tome. C'est le cœur de l'application, le geste que l'utilisateur répète.

La direction retenue pour la grille est la **grille 4 colonnes de couvertures** (option `2b` du document de design). Les options écartées (`1b` à `1e`, `2a`) restent visibles dans le fichier HTML comme trace des arbitrages — ne pas les implémenter.

## À propos des fichiers de design

Les fichiers de ce dossier sont des **références de design écrites en HTML** : un prototype qui montre l'apparence et le comportement attendus, **pas du code de production à copier**. Le travail consiste à **recréer ces écrans dans l'environnement du dépôt cible** (`Yaminosenko/manga_collection`) avec ses conventions. À ce jour le dépôt ne contient que `data/` et `scripts/` — aucun front. Le choix de stack proposé dans `CLAUDE.md` (Next.js App Router + Prisma + PostgreSQL, PWA mobile) reste à confirmer avant la première ligne de code applicatif.

`Grille de pastilles.dc.html` s'ouvre directement dans un navigateur (il charge `support.js`, fourni ici). Il est interactif : les taps cochent réellement, compteurs et barres suivent.

## Fidélité

**Haute fidélité.** Couleurs, typographie, espacements et interactions sont définitifs. Toutes les valeurs viennent des tokens du design system Nocturne (`nocturne/styles.css`) — ne pas écrire de hex en dur, consommer les variables CSS.

Ce qui n'est **pas** définitif : les couvertures (vignettes rayées = emplacement d'une image réelle) et le nom d'éditeur (« Soleil Manga » est inventé, la colonne est vide dans `collection.json`).

---

## Écran 1 — Collection

**Rôle.** Liste de toutes les éditions. Point d'entrée de l'application.

**Structure**, de haut en bas, dans une colonne flex, fond `--color-bg` :

- **En-tête**, padding `14px 18px 10px`, colonne, gap `12px`
  - Titre `Collection` en `h4` (20px / poids 500 / `--color-text`), et à droite, aligné sur la même ligne de base, le compteur global `1 148 tomes · 112 éditions` en 11.5px / `--color-neutral-500`.
  - Rangée de recherche, gap `8px` :
    - Champ : hauteur 38px, `flex:1`, fond `--color-surface`, radius `--radius-md` (8px), padding horizontal 12px, icône Phosphor `magnifying-glass` + libellé `Rechercher` en 13px `--color-neutral-500`.
    - Bouton tri : 38×38, radius 8px, bordure `1px solid --color-neutral-800`, icône `sort-ascending` 16px en `--color-accent`.
- **Liste**, padding horizontal 18px, une ligne par édition.
- **Section « Vendues »** en fin de liste : chevron `caret-right` + libellé + compteur `4`, en `--color-neutral-600`, repliée par défaut.
- **Barre d'onglets** : bordure haute `1px rgba(233,233,237,.08)`, fond `--color-surface`, padding `8px 0 18px`, 3 onglets à `flex:1` (icône 20px + libellé 10px) — Collection (`ph-fill ph-books`, `--color-accent`), Manquants (`puzzle-piece`), Ajouter (`plus-circle`), inactifs en `--color-neutral-600`.

### Anatomie d'une ligne de collection

Rangée flex, gap `12px`, padding vertical `13px`, séparateur bas `1px solid rgba(233,233,237,.07)`. Hover : fond `rgba(255,255,255,.02)`.

- **Couverture** — 52×74, radius 5px, `flex:none`, `box-shadow: var(--shadow-sm)`. C'est la couverture du **dernier tome possédé** ; à défaut, placeholder portant le numéro de ce tome, en 10px `--color-neutral-700`, aligné en bas à droite (padding 4px).
- **Colonne texte**, `flex:1`, `min-width:0`, gap `4px` :
  - **Titre** — 14px / poids 500 / `--font-heading` / `--color-text`, tronqué par ellipse sur une ligne. Suivi le cas échéant d'une **icône d'état** 13px `--color-neutral-600` : `warning-circle` (à vérifier), `pause-circle` (abandonnée / en pause), `flag-checkered` (complétion forcée).
  - **Sous-titre** — 11.5px `--color-neutral-600`, tronqué : `Nom d'édition · Éditeur`, ou l'état quand il prime (`à vérifier`, `abandonné`, `terminée par choix`, `complète`).
  - **Barre + compteur**, rangée gap `8px`, margin-top 3px :
    - Barre : hauteur 5px, gap 3px entre zones, chaque zone en radius 3px.
    - Compteur `X / Y` à droite : 11.5px poids 500 `--color-neutral-300`, `white-space:nowrap`.
- **Édition abandonnée / en pause** : titre en `--color-neutral-500`, compteur en `--color-neutral-600`, couverture à `opacity: .5`, zone possédée de la barre en `--color-accent-700` au lieu de `--color-accent`.

### Barre de progression à trois zones (partagée par les deux écrans)

Conteneur flex, `gap: 3px`, hauteur 5px (liste) ou 6px (page Édition).

| Zone | Implémentation | Style |
|---|---|---|
| Possédés | `flex-grow: <nb possédés>` | `background: var(--color-accent)`, radius 3px |
| Parus non possédés | `flex-grow: <tomesParus − possédés>` | `background: var(--color-neutral-800)`, radius 3px |
| À paraître | **largeur fixe** 20px (liste) / 22px (page Édition), jamais proportionnelle | `background: repeating-linear-gradient(115deg, var(--color-neutral-800) 0 2px, transparent 2px 5px)`, radius 3px |

La zone « à paraître » est présente **si et seulement si** `editionTerminee` est faux ou nul. Les deux autres zones utilisent `flex-grow`, jamais de pourcentage calculé : l'arithmétique reste dans le layout.

Une édition vendue n'a pas de barre — le libellé `Vendu` la remplace.

---

## Écran 2 — Page Édition

Colonne flex sur `--color-bg`, contenu scrollable, padding `0 18px 18px`, gap `20px` entre blocs.

- **Barre de navigation** : `arrow-left` à gauche, `dots-three-outline` à droite, 18px, `--color-accent`, padding `10px 18px`.
- **En-tête d'édition**, rangée gap `14px` :
  - Couverture 74×104, radius 6px, `var(--shadow-sm)`, numéro du dernier tome possédé en bas à droite (13px `--color-neutral-600`).
  - Colonne : titre en `h5` (16px / 500 / `--color-text`, line-height 1.2) ; `Nom d'édition · Éditeur` en 11.5px `--color-neutral-600` ; puis, si `aVerifier`, un badge aligné à gauche — padding `2px 7px`, radius 4px, bordure `1px solid --color-neutral-800`, 10px poids 500 `--color-neutral-400`, icône `warning-circle` + `À vérifier`. Enfin la barre trois zones + le compteur `X / Y` (12px poids 500 `--color-text`).
- **Bouton d'accès à la sélection** — `.btn .btn-primary .btn-block` du design system (contour accent sur fond transparent, jamais un aplat), `text-transform: uppercase`, `letter-spacing: .06em`. Libellé : **`9 / 14 TOMES`**, c'est-à-dire `<possédés> / <tomesParus> TOMES`, recalculé à chaque changement. C'est le seul accès à la grille.
- **Carrousel « Couvertures possédées »** — titre en `h6` (13px, majuscules, `letter-spacing .08em`, `--color-neutral-500`), puis rangée scrollable horizontale, gap 9px, vignettes 66×94, radius 5px, `var(--shadow-sm)`. **Tomes possédés uniquement**, chargement paresseux, purement visuel, ne mène nulle part.
- **Pied de page** — bordure haute `1px rgba(233,233,237,.08)`, padding-top 12px. Paires clé/valeur sur une ligne (`justify-content: space-between`, padding vertical 7px, 12px) : clé `--color-neutral-600`, valeur `--color-neutral-300`. Auteur, Genres, Statut, Valeur. Puis un lien sortant `Fiche manga-news` + icône `arrow-up-right`, 12px poids 500 `--color-accent`.
- **Bloc « Autres éditions »** — non maquetté : affiché seulement si la série compte plusieurs éditions (4 séries concernées à l'import). À traiter comme une liste de lignes de collection réduites.

---

## Écran 3 — Sous-page « Mes tomes » (le cœur)

Ouverte par le bouton `X / Y TOMES`. Écran plein, fond `--color-bg`.

- **En-tête**, rangée gap 12px, padding `22px 18px 14px` : `arrow-left` 18px `--color-accent` (retour), puis colonne — titre de la série 14px poids 500 tronqué, sous-titre `Édition simple · 14 tomes parus` en 11px `--color-neutral-600`.
- **Rangée compteur + actions de masse**, padding `0 18px 14px`, `space-between` :
  - `9 / 14 tomes` en 17px poids 500 `--color-text` — se met à jour à chaque tap.
  - Deux boutons `Tout` et `Aucun` : padding `6px 11px`, radius 8px, bordure `1px solid --color-neutral-800`, 11px poids 500 `--color-neutral-300`. Hover : bordure `--color-accent-600`, texte `--color-accent-200`.
- **Grille**, zone scrollable, padding `0 18px 18px`, gap 14px entre la grille et la légende.

### La grille de couvertures

`display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px;`

Une case par tome, de 1 à `tomesParus`, **plus 3 cases fantômes « à paraître »** si `editionTerminee` est faux. Ces trois cases ne sont pas une donnée : l'application ne sait pas combien de tomes restent, elles ne font que signaler que la série continue. Elles ne sont pas cliquables.

Chaque case : `position: relative`, `aspect-ratio: 0.71` (ratio couverture manga), `border-radius: 5px`, `overflow: hidden`, `transition: opacity .09s ease, box-shadow .09s ease`.

| État | Contour | Contenu | Opacité |
|---|---|---|---|
| **Possédé** | `inset 0 0 0 1px var(--color-accent-600)` + `0 1px 0 var(--color-neutral-900)` | couverture pleine | 1 |
| **Manquant** | `inset 0 0 0 1px var(--color-neutral-800)` | même couverture | **0.34** |
| **À paraître** | `1px dashed var(--color-neutral-900)`, fond transparent | vide | 1 |

Surcouches, sur les cases numérotées uniquement :

- **Pastille numéro**, en bas à gauche, margin 5px, padding `2px 6px`, radius 3px, 11px poids 500 `--font-heading`.
  Possédé : fond `--color-accent-800`, texte `--color-accent-200`. Manquant : fond `rgba(11,13,22,.8)`, texte `--color-neutral-500`.
- **Coche**, en haut à droite, 18×18, ronde, fond `--color-accent-700`, glyphe `ph-fill ph-check` 10px `--color-accent-100`. **Affichée uniquement quand le tome est possédé.**

**Le geste.** Un tap sur une case bascule `Possession.possede`. Rien d'autre : pas de confirmation, pas d'annulation, pas de mode édition. Transition de 90 ms sur l'opacité et le contour, c'est tout le retour visuel — délibérément discret puisque le geste est répété des dizaines de fois. L'appui long est **réservé à la V2** (fiche tome) et n'a aucun effet en V1. Cible tactile : à 4 colonnes sur 390 px de large, une case fait environ 84×118 — largement au-dessus du minimum de 44 px.

- **Légende**, rangée gap 14px, 10.5px `--color-neutral-600` : trois pastilles 9×9 (possédé / manquant / à paraître) reprenant exactement les traitements ci-dessus.
- **Mention** : `Un tap coche ou décoche. Les modifications sont enregistrées au fil de l'eau.` 11px `--color-neutral-600`.

### Sur les séries longues

La grille reste continue, sans regroupement par dizaines. À 4 colonnes, Berserk (42 tomes) occupe 11 rangées : c'est le prix assumé du choix de montrer les couvertures. Si la vue d'ensemble manque à l'usage, la piste de repli est un second mode d'affichage à 7 colonnes sans couverture (option `1b` dans le fichier de design), à basculer depuis l'en-tête de la sous-page.

---

## Interactions et comportements

| Déclencheur | Effet |
|---|---|
| Tap sur une case de la grille | Bascule `possede` du tome. Compteur de la sous-page, libellé du bouton `X / Y TOMES` et barre de la page Édition se recalculent immédiatement. |
| `Tout` | Coche les tomes 1 à `tomesParus`. Jamais les cases à paraître. |
| `Aucun` | Décoche tout. |
| Bouton `X / Y TOMES` | Ouvre la sous-page. |
| `arrow-left` de la sous-page | Retour à la page Édition, état déjà enregistré. |
| Appui long sur une case | Aucun effet en V1. |

**États à prévoir sur chaque écran** : chargement, vide, erreur, hors ligne. En mode hors ligne (bandeau `Hors ligne · consultation seule` en haut d'écran), les cases sont **inertes mais pas grisées** — elles ne doivent pas sembler cassées, seul le tap ne produit rien.

**Une couverture absente n'est jamais bloquante** : placeholder portant le numéro de tome, avec possibilité d'uploader une photo manuellement.

## État applicatif

Pour la sous-page, l'état minimal est l'ensemble des numéros de tomes possédés pour l'édition courante. Tout le reste s'en déduit : compteur, libellé du bouton, `flex-grow` des zones de barre, complétion.

- `possede: Set<numero>` — écrit à chaque tap, persisté au fil de l'eau (pas de bouton Valider).
- `tomesParus`, `editionTerminee` — lus depuis l'édition ; conditionnent le nombre de cases et la présence des cases fantômes.
- `aVerifier` — passe à `false` à la première validation manuelle de l'édition.

**Aucun appel à une API externe à l'ouverture d'un écran.** Tout écran lit la base locale ; les API ne sont sollicitées qu'à l'import et au rafraîchissement de fond hebdomadaire.

## Tokens de design

Tous dans `nocturne/styles.css`, à consommer via `var(--*)`. Les hex ci-dessous sont donnés pour référence, pas pour être recopiés.

**Couleurs** — `--color-bg` #161826 · `--color-surface` #232532 · `--color-text` #e9e9ed · `--color-accent` #9184d9.
Rampes 100→900 : neutres `#f3f5fe #e4e7f5 #cfd3e5 #b2b6ca #9397ab #75798c #595d6c #3f424d #292b31`, accent `#f5f4ff #e7e5fe #d2cefd #b5abfc #968ae0 #796cbf #5d5294 #423a6a #2b2741`.
Sur ce fond sombre : 700–900 pour les fonds teintés et les bordures, 500 comme base, 100–300 pour le texte posé dessus. Une seule valeur hors tokens dans la maquette : `#0b0d16`, le creux plus sombre que le fond utilisé par l'option `1c` — non retenue, à ignorer.

**Espacements** (densité 0.7×) — `--space-1` 2.8 · `--space-2` 5.6 · `--space-3` 8.4 · `--space-4` 11.2 · `--space-6` 16.8 · `--space-8` 22.4 px.

**Rayons** — `--radius-sm` 4 · `--radius-md` 8 · `--radius-lg` 14 px. Les vignettes de couverture utilisent 5–6 px, les téléphones 20–26 px.

**Typographie** — Inter partout, `--font-heading` en poids 500, `--font-body` en 400. Échelle utilisée : h4 20 / h5 16 / h6 13 (majuscules, `letter-spacing .08em`) / corps 15 / secondaire 11.5–13 / mention 10.5–11.

**Ombres** — `--shadow-sm` `0 0 0 1px #3f424d` · `--shadow-md` · `--shadow-lg`. Ne pas empiler d'ombres : sur fond sombre, l'élévation est une arête plus une obscurité ambiante.

**Règles du système à respecter** — l'accent est un trait et une lueur, jamais un aplat sur de grandes surfaces ; les actions principales sont des boutons **contour**, pas remplis ; pas de noir pur ni de blanc pur ; les titres ne dépassent pas le poids 500, la hiérarchie se fait par la taille et l'espace ; focus clavier en `2px solid var(--color-accent)` avec `outline-offset: 2px`.

## Assets

- **Icônes** : Phosphor (https://phosphoricons.com), chargées ici depuis unpkg. Glyphes utilisés — `magnifying-glass`, `sort-ascending`, `arrow-left`, `arrow-up-right`, `dots-three-outline`, `warning-circle`, `pause-circle`, `flag-checkered`, `caret-right`, `books` (fill), `puzzle-piece`, `plus-circle`, `check` (fill), `wifi-high`, `battery-high`.
- **Couvertures** : aucune image dans la maquette. Les vignettes rayées (`repeating-linear-gradient` en tons neutres) marquent l'emplacement d'une couverture réelle. En production : téléchargées une fois, redimensionnées, servies par le serveur, jamais référencées depuis une URL d'API externe. Deux tailles, vignette 120×170 et moyenne 400×570, en WebP.
- **Données de démonstration** : `data/collection.json` du dépôt. Le cas affiché, CALL OF THE NIGHT 9/14 avec des trous, est fabriqué — le Sheet importé attribue les N premiers tomes, donc aucune édition réelle n'a de trou avant vérification manuelle. L'éditeur « Soleil Manga » est inventé : la colonne est vide dans le JSON.

## Fichiers de ce dossier

- `Grille de pastilles.dc.html` — le prototype, ouvrable directement dans un navigateur. La version retenue est l’option 1b (turn 1) : page Édition + sa sous-page en grille 4 colonnes de couvertures. Les autres options (1a montre la Collection ; 1c, 1d, 1e, 2a, 2b sont des explorations) sont conservées comme trace des arbitrages.
- `support.js` — le runtime dont dépend le fichier HTML.
- `nocturne/styles.css` — la feuille de tokens et de composants du design system.
- `nocturne/readme.md` — le guide du design system, à lire avant d'écrire du style.
