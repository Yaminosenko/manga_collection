# Icône Zenkan

Un Z au pinceau, style sumi-e, sur fond papier. Rien d'autre : deux couleurs, un trait.

**Le sceau 全巻 a été retiré le 18 septembre 2026.** Il portait l'accent Nocturne `#9184d9` dans
le coin bas droit ; sans lui le trait est agrandi de 12 % et recentré, parce qu'il flottait dans
le cadre et laissait ce coin vide. **L'icône ne porte donc plus aucun violet**, alors que
`--color-accent` de `app/globals.css` reste `#9184d9` : le lien entre l'icône et l'accent de
l'interface est rompu, et c'est le seul endroit qui le dit. Le manifeste n'est pas concerné —
son `theme_color` est `COULEUR_FOND_APPLICATION`, le fond de l'application, jamais l'accent.

## Ce qui est servi, et d'où

Les PNG ne vivent pas ici : ce dossier porte les **sources**. Les copies servies sont
ailleurs, et c'est volontaire — un fichier servi doit être là où le framework l'attend.

| Fichier servi | Ce qui le référence |
|---|---|
| `public/icons/icon-192.png`, `icon-384.png`, `icon-512.png` | `app/manifest.ts`, `purpose: "any"` |
| `public/icons/icon-maskable-192.png`, `icon-maskable-512.png` | `app/manifest.ts`, `purpose: "maskable"` |
| `app/apple-icon.png` (180×180) | convention Next, balise `apple-touch-icon` posée toute seule |
| `app/favicon.ico` (16 · 32 · 48) | convention Next, onglet du navigateur |

**`proxy.ts` doit laisser passer ces chemins.** La garde d'accès redirige tout le reste vers
`/acces` : une icône derrière la garde ne s'afficherait pas à l'invite d'installation, qui est
justement l'écran qu'on voit avant de se connecter.

## Le maskable n'est pas un doublon

Android découpe l'icône selon la forme du lanceur — cercle, carré arrondi, goutte. Le trait
touche presque le bord depuis qu'il a été agrandi de 12 %, donc une icône `any` rognée y perd
ses extrémités. Les versions `maskable` portent 14 % de marge sur chaque bord pour survivre à
n'importe quelle découpe. Les deux jeux sont nécessaires.

## Trois niveaux de détail, dont deux servis

Le dessin n'est pas le même selon la taille, parce que le détail devient de la bouillie en
dessous d'un certain rendu :

- **512 à 180 px** — complet : traits, pinceau sec, éclaboussures, fibres de papier
- **144 à 72 px** — les éclaboussures et les fibres sautent, le pinceau sec reste
- **48 px et moins** — le trait seul, et c'est ce que porte `favicon.ico`

**Le palier du milieu n'est servi nulle part** : le manifeste ne demande que 192, 384 et 512, et
l'application ne pose aucune balise en 144, 96 ou 72. Le générateur rend ces trois cotes quand
même, et elles restent dans `icons/`, que git ignore. Le retrait du sceau n'a pas supprimé ce
palier — il lui a retiré un de ses deux motifs, le sceau y perdait ses caractères.

## Régénérer

`generate_icons.py` reconstruit `svg/` et `icons/` depuis les chemins vectoriels écrits dans le
script. `icons/` est ignoré par git : **la régénération ne met rien à jour toute seule**, il
faut recopier vers `public/icons/`, `app/apple-icon.png` et `app/favicon.ico`.

```bash
pip install cairosvg
python design/zenkan/generate_icons.py
```

**`cairosvg` n'est pas dans `requirements.txt` et n'a pas été installé sur le poste de
développement** : il réclame les bibliothèques Cairo, ce qui n'est pas acquis sous Windows. Les
PNG livrés ont été rendus ailleurs, et les SVG de `svg/` se rouvrent dans n'importe quel
navigateur pour juger un changement sans rien installer.

**Et le générateur ne produit aucun `.ico`.** Il rend `favicon-16.png`, `favicon-32.png` et
`icon-48.png` ; `app/favicon.ico` est un conteneur qu'il faut assembler à partir des trois, avec
leurs octets PNG embarqués tels quels — c'est un format que tous les navigateurs actuels lisent.
Oublier cette étape laisse l'ancienne icône dans l'onglet alors que tout le reste a changé, et
rien ne le signale.

## Couleurs

- Papier `#f4efe4`
- Encre `#16130f`

Il n'y en a plus que deux. `SCEAU`, `POLICE_CJK` et la fonction `sceau()` ont été retirés du
générateur en même temps que les appels : le jeu livré les laissait en place sans les appeler,
et du code mort dans un script qu'on relance une fois par an ne se distingue pas d'un code
vivant.

La variante sombre (`svg/zenkan-icone-sombre.svg`) existe et n'est pas servie. Une icône
d'écran d'accueil se pose sur le fond d'écran de l'utilisateur, pas sur celui de l'application :
le papier clair tient sur la plupart des fonds, l'encre sombre ferait un trou sur les fonds
sombres. Le manifeste ne sait de toute façon pas choisir une icône selon le thème.
