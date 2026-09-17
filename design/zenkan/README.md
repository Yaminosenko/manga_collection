# Icône Zenkan

Un Z au pinceau, style sumi-e, sur fond papier. Sceau 全巻 — « tous les volumes » — dans
l'accent Nocturne `#9184d9`, qui est exactement `--color-accent` de `app/globals.css`.

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

Android découpe l'icône selon la forme du lanceur — cercle, carré arrondi, goutte. Une icône
`any` rognée perd son sceau, qui est dans le coin. Les versions `maskable` portent 14 % de
marge sur chaque bord pour survivre à n'importe quelle découpe. Les deux jeux sont nécessaires.

## Trois niveaux de détail, et pourquoi

Le dessin n'est pas le même selon la taille, parce que le détail devient de la bouillie en
dessous d'un certain rendu :

- **512 à 180 px** — complet : traits, pinceau sec, éclaboussures, sceau avec 全巻
- **144 à 72 px** — le sceau perd ses caractères, les éclaboussures et les fibres sautent
- **48 px et moins** — le trait seul, et c'est ce que porte `favicon.ico`

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

## Couleurs

- Papier `#f4efe4`
- Encre `#16130f`
- Sceau `#9184d9` — ses caractères sont **en encre, pas en blanc** : le blanc sur ce violet
  tombe à 2,8:1 et disparaît sous 76 px.

La variante sombre (`svg/zenkan-icone-sombre.svg`) existe et n'est pas servie. Une icône
d'écran d'accueil se pose sur le fond d'écran de l'utilisateur, pas sur celui de l'application :
le papier clair tient sur la plupart des fonds, l'encre sombre ferait un trou sur les fonds
sombres. Le manifeste ne sait de toute façon pas choisir une icône selon le thème.
