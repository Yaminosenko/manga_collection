---
name: planning-manga-news
description: >
  Rafraîchir le planning et le catalogue de Zenkan depuis de nouveaux CSV manga-news.
  À utiliser dès qu'il est question de « nouveaux CSV », « retélécharger le planning »,
  « ajouter un mois », « mettre à jour les sorties », « planning:import », « catalogue:import »,
  ou de l'écran Planning qui ne montre pas une sortie attendue. Porte l'ordre exact des
  commandes, ce qui se relit entre chaque, et les pièges qui ont déjà coûté des données.
---

# Rafraîchir le planning depuis les CSV manga-news

Les CSV ne sont pas versionnés : ils se retéléchargent depuis manga-news, un fichier par mois.
Ils atterrissent dans `~/Downloads` sous `PlanningManga_JJ-MM-AAAA (n).csv`, nommés à la date de
téléchargement et non à leur contenu.

**Deux circuits lisent les mêmes fichiers et ne font pas la même chose.** Les confondre est
l'erreur la plus fréquente.

| | `planning:*` | `catalogue:*` |
|---|---|---|
| Périmètre | **ma collection** | **tout**, sans filtre |
| Écrit | `Volume.isbn`, `Volume.dateSortie`, `Edition.tomesParus`, `Sortie` | `ParutionCatalogue` |
| Sert à | l'écran Planning, les Manquants | `/ajouter`, le scanner, les vignettes |

Rafraîchir l'un ne rafraîchit pas l'autre.

## Avant tout — ranger les fichiers

Identifier le mois de chaque fichier **par son contenu**, jamais par son nom, puis le copier sous
`planning_AAAA-MM.csv` dans un dossier de travail. Ne pas déplacer les originaux.

```bash
PY=~/.pyenv/pyenv-win/versions/3.12.10/python.exe
$PY -c "
import csv, io, glob, re, unicodedata, collections
for p in sorted(glob.glob('PlanningManga_*.csv')):
    c = collections.Counter()
    for l in csv.DictReader(io.open(p, encoding='utf-8-sig')):
        m = re.match(r'\s*\d{1,2}\s+(\S+)\s+(\d{4})', (l.get('Date') or '').strip())
        if m:
            s = unicodedata.normalize('NFKD', m.group(1)).encode('ascii','ignore').decode().lower()
            c[s + ' ' + m.group(2)] += 1
    print(p, dict(c))
"
```

`python` seul échoue sur ce poste (pyenv non résolu) : passer par l'interpréteur 3.12.10.

## L'ordre, et ce qu'on relit entre chaque

### 1. `npm run db:backup`

**Obligatoire, et c'est le piège n°1.** `import_planning.py` lit `data/backup.json` pour savoir
quelles éditions existent. Une sauvegarde périmée rend invisibles toutes les séries ajoutées
depuis — mesuré le 21 septembre 2026 : une sauvegarde vieille de quatre jours faisait **manquer 4
sorties** sur 29, dont Blue Lock t35 et t36.

### 2. `npm run planning:import <dossier>`

N'écrit **rien en base** : seulement `data/planning.json` et `data/planning-divergences.json`.

**Relire les deux avant d'aller plus loin.** Le second porte les lignes écartées sur divergence
d'éditeur — c'est le garde-fou qui a attrapé la collision LEVIATHAN à quinze ans d'écart. Le
script annonce aussi les éditions où le planning dépasse la base : chaque hausse se justifie.

### 3. `npm run planning:apply`

Réconcilie les sorties une par une, depuis le 21 septembre 2026 :

- absente → créée ;
- présente à une autre date → **`UPDATE` de la date seule**, l'`id` et la couverture survivent ;
- présente à l'identique → rien ;
- présente mais plus annoncée, dans la fenêtre du manifeste → supprimée ;
- présente et le tome est désormais paru → supprimée, **et sa couverture est recopiée sur le
  `Volume`** si celui-ci n'en a pas, comme le fait `promouvoir()`.

Avant ce changement, le script purgeait puis recréait en bloc : 14 couvertures sur 15 partaient à
chaque passage. Vérifié sur le banc : **0 image perdue**.

`-- --revert` remonte `data/editions-avant-planning.json`, qui porte l'état **par tome**.

### 4. `npm run catalogue:import <dossier>` puis `npm run catalogue:apply`

`-- --dry-run` d'abord. Relire `data/catalogue-controles.json`.

`catalogue:apply` est **insertion seule** — `createMany({ skipDuplicates: true })` sur la clé
`(titreBrut, date)`. Il n'efface ni ne corrige jamais rien : une parution reportée laisse donc sa
ligne à l'ancienne date, et le groupe se retrouve avec deux lignes pour le même tome. Conséquence
connue : `tomesParus` d'un candidat se calcule sur les lignes de date passée, donc un tome
repoussé compte comme paru. Petit, mais ça grossit à chaque fenêtre retéléchargée.

### 5. `npm run covers:fetch` puis `npm run covers:upload`

Pour les couvertures des sorties nouvellement créées. Plus indispensable qu'avant — la
réconciliation ne détruit plus les images existantes — mais les créations en ont besoin.

## Vérifier avant d'écrire, sur le banc jamais sur Neon

Toute écriture nouvelle s'éprouve sur le Postgres local. `LOCAL_DATABASE_URL` **ne va jamais dans
`.env`** : elle se passe en préfixe de commande, sinon `db:backup` irait lire le banc et
écraserait `data/backup.json`.

```bash
npx prisma dev -d -n manga                     # rend une URL sur template1
BANC='postgres://postgres:postgres@localhost:PORT/template1?sslmode=disable'
LOCAL_DATABASE_URL=$BANC npm run db:migrate
LOCAL_DATABASE_URL=$BANC npx tsx scripts/backup-db.ts --restore --reset
LOCAL_DATABASE_URL=$BANC npx tsx scripts/apply-planning.ts
```

Après l'essai, restaurer et relire les compteurs : ils doivent revenir à l'identique. Et
`import_planning` comme `apply-planning` écrivent des fichiers versionnés — les remettre avec
`git checkout -- data/planning.json data/planning-divergences.json
data/editions-avant-planning.json`.

## L'horizon de fiabilité est de deux mois

**Au-delà de deux mois, une annonce n'est pas un fait.** C'est l'aveu de la source, et c'est la
consigne du propriétaire. Trois conséquences :

- une date lointaine se dit au conditionnel, jamais « le tome sort le 11 février » ;
- **une ligne absente n'est pas une annulation, c'est une absence de la fenêtre téléchargée** —
  le nombre de « retraits » d'un lot est un plafond, pas un compte ;
- un décalage lointain ne se signale pas : c'est le fonctionnement normal.

Mesuré le 21 septembre 2026 : sur 96 disparitions, **75 étaient des reports**. Un bloc de
11 titres Komikku annoncés au 17 septembre était reparti sur janvier et février 2027, dont
`The Ancient Magus Bride` t24 — **même EAN**, repoussé de cinq mois. Avec cinq fichiers en main
j'avais compté 27 retraits ; le sixième en a effacé 6 d'un coup.

**Donc : télécharger un mois de plus que la fenêtre sur laquelle on veut conclure.** Et le remède
au décalage n'est pas d'alerter, c'est de réimporter souvent — depuis la réconciliation, un report
ne coûte plus qu'un `UPDATE` de date.

## Comparer avant d'appliquer

Pour savoir ce qu'un lot change, comparer les CSV à `ParutionCatalogue` sur la clé
`(titreBrut, date)`, puis classer les disparitions : même titre à une autre date (report), même
EAN sous un autre titre (retitrage), ou absente de la fenêtre. **Classer avant de compter** — une
disparition brute ne veut rien dire, voir l'horizon de deux mois ci-dessus.

## Ce que le circuit ne fera jamais

- **Les éditions dont le `nom` n'est pas « Édition simple »** ne sont pas indexées :
  `fairy-tail-edition-collector`, `hellsing-perfect-edition`, `berserk-prestige-edition`… Elles
  n'auront jamais ni planning ni ISBN par ce chemin.
- **Quatre slugs sont écartés à la main** parce que possédés en réédition : `blame`,
  `dragon-ball`, `gantz`, `neon-genesis-evangelion`. Le planning y décrit un autre objet physique.
- **Une édition absente du manifeste garde ses sorties**, même périmées — « le silence d'un import
  ne vaut pas suppression ». Une série que manga-news cesse d'annoncer laisse donc une `Sortie`
  orpheline que le cron finira par promouvoir. C'est la bonne raison de télécharger un mois de
  plus : le mois manquant est souvent celui qui porte le report.
- **Un tome paru est un `Volume` *et* garde sa `Sortie` pendant deux mois**, depuis le
  21 septembre 2026. Il est donc cochable dans la grille et visible au Planning en même temps —
  la `Sortie` ne dit plus « va paraître » mais « vient de paraître ». Le cron la supprime une fois
  passé le premier jour du mois précédent. `MOIS_AU_PLANNING_APRES_PARUTION` pilote ça, et **la
  constante est dupliquée** entre `lib/constants.ts` et `import_planning.py` : les faire bouger
  ensemble. Une ligne de date passée entre donc dans `tomes` **et** dans `aParaitre`.
- **Une `Sortie` n'appartient à personne.** Elle disparaît du Planning d'un compte parce que
  `chargerPlanning` retire les tomes qu'il possède déjà, pas parce qu'on l'efface. Ne jamais
  rajouter un `sortie.delete()` dans une action : ce serait l'effacer pour tout le monde.

## Les fichiers

| | |
|---|---|
| `scripts/import_planning.py` | lit les CSV et `data/backup.json`, n'écrit qu'un manifeste |
| `scripts/apply-planning.ts` | écrit en base, réconcilie les sorties, `--revert` |
| `scripts/import_catalogue.py` · `apply-catalogue.ts` | le catalogue entier |
| `data/planning.json` · `planning-divergences.json` | le manifeste et les lignes écartées |
| `data/editions-avant-planning.json` | l'état d'avant, par tome, jamais écrasé |
