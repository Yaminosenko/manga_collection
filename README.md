# Zenkan

Application personnelle de suivi de collection de mangas — 全巻, « tous les volumes ».
Elle remplace un compteur par série (`10 tomes possédés sur 12`) par un suivi **au tome
physique**, parce qu'un compteur ne dit pas *lesquels* manquent.

Next.js (App Router), React, TypeScript, Prisma, PostgreSQL sur Neon, hébergement Vercel,
couvertures sur Cloudflare R2. PWA installable, mobile d'abord, mode sombre uniquement.

**Le dépôt, le dossier de travail et le projet Vercel gardent leur nom `manga_collection`** :
les renommer casserait les chemins de tous les postes et l'URL de production.

## Les quatre documents

| Fichier | Ce qu'il porte |
|---|---|
| **`CLAUDE.md`** | la spécification et les décisions **tranchées**. Fait foi |
| **`JOURNAL.md`** | ce qui est **déjà fait**, daté, avec les chiffres et les causes. Fait foi sur l'état |
| **`TODO.md`** | le travail **restant** et les décisions en attente |
| **`IDEES.md`** | les envies **non tranchées**. Ne fait foi sur rien |

Ce `README.md` porte l'installation et les commandes. **Lire `CLAUDE.md` en entier avant de
toucher au code.**

---

## Reprendre sur un poste neuf

1. `git clone`, puis `npm install` — le client Prisma se régénère tout seul.
2. **Python et Pillow** pour les scripts de couvertures : `pip install -r requirements.txt`.
3. Créer `.env` sur le modèle de `.env.example`. **Trois variables sont indispensables** :

   | Variable | Où la trouver |
   |---|---|
   | `DATABASE_URL` | Neon → *Connect*, interrupteur **Connection pooling** activé |
   | `DIRECT_URL` | le même, **sans** le pooling. Sert aux migrations |
   | `SESSION_SECRET` | le secret qui signe les cookies de session. **Le même que dans Vercel**, sinon un cookie posé d'un côté est refusé de l'autre. N'importe quelle chaîne longue et aléatoire ; la changer déconnecte tout le monde |

   Les autres sont facultatives : les cinq variables `R2_*` pour déposer des couvertures — voir
   `.env.example`, et **recopier `R2_ENDPOINT` tel qu'affiché, ne pas le reconstruire** — et
   `LOCAL_DATABASE_URL` pour travailler sur un Postgres local — **elle se passe en préfixe de
   commande, jamais dans `.env`**, voir « Pièges établis » : `lib/prisma.ts` la lit aussi, donc
   elle détourne l'application entière en plus des scripts. **Les cinq `R2_*` sont en revanche
   à renseigner dans Vercel depuis le 16 septembre 2026** : le cron quotidien dépose lui-même
   les couvertures qu'il acquiert, et sans elles il lève dès la première image obtenue et la
   route répond 500. Les écrans, eux, n'ont toujours besoin de rien — ils lisent les URL
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
| `npm run db:backup` | **avant toute manipulation de masse.** `-- --restore --reset` remonte tout **dans une seule transaction, contrôle de compteurs compris** (17 septembre 2026) : une coupure ou une divergence n'écrit rien du tout, au lieu de laisser la base vidée à moitié. **Ne sauvegarde aucun mot de passe** — une restauration laisse les comptes sans accès |
| `npm run compte` | les accès. `-- --lister` (lecture seule) montre chaque compte et ses compteurs ; `-- --proprietaire --identifiant <pseudo> [--email <adresse>]` pose un accès **sur la ligne `PROPRIETAIRE` existante**, sans déplacer une seule ligne de collection ; `-- --reinitialiser <pseudo>` repose un mot de passe et coupe les sessions. Le mot de passe est demandé sans écho |
| `npm run planning:import <dossier>` | lit les CSV manga-news, n'écrit qu'un manifeste — **relire aussi `data/planning-divergences.json`** |
| `npm run planning:apply` | écrit `tomesParus`, ISBN, dates et sorties annoncées. **Réconcilie les sorties depuis le 21 septembre 2026** — créée, date ajustée, ou rien — au lieu de purger et recréer, qui perdait leur couverture. `-- --revert` remonte `data/editions-avant-planning.json`, qui porte l'état **par tome** depuis le 17 septembre 2026 — les éditions sauvegardées avant gardent leurs ISBN tels quels, le script les nomme |
| `npm run catalogue:import <dossier>` | lit les mêmes CSV pour le **catalogue entier**, sans aucun filtre de collection — **relire `data/catalogue-controles.json`** |
| `npm run catalogue:apply` | écrit `ParutionCatalogue`. `-- --dry-run` d'abord ; `-- --recalculer` réécrit les champs dérivés depuis `titreBrut` sans retélécharger un CSV |
| `npm run vignettes:fetch` | **une couverture par groupe de catalogue**, depuis la BnF par EAN, en 256×360. Reprenable, `-- --max <n>` plafonne, `-- --tout` enchaîne les 12 000, `-- --dry-run` montre les cibles. Trie par **taille de groupe décroissante** et essaie jusqu'à 4 volumes avant de renoncer. Mémorise aussi les échecs, sinon un EAN sans image serait redemandé à chaque recherche |
| `npm run covers:fetch` | acquiert les couvertures manquantes depuis MangaDex, `fr` puis `ja`. **Son idempotence part de `data/backup.json`** : relancer `db:backup` d'abord, sinon il retélécharge |
| `npm run covers:bnf` | complète par la BnF, **par EAN**, pour ce que MangaDex n'a pas. Demande du 512×720 maximum, proportions respectées. `-- --refaire` reprend les couvertures déjà marquées `bnf`. Écrit `data/covers-bnf.json`, et `covers:upload` en tire `sourceCouverture` **et** `couvertureRecupereeLe` |
| `npm run covers:manuelles <dossier>` | convertit un lot fourni à la main |
| `npm run covers:upload` | dépose dans R2 et écrit `couvertureUrl`. `-- --force <slug>[:<numero>]` pour corriger, `-- --max <n>` pour relever le plafond de 150 envois |
| `npm run covers:migrate` | rebascule toutes les `couvertureUrl` vers `R2_PUBLIC_BASE`. `-- --dry-run` d'abord. Sert au jour du domaine personnalisé : sans rien à envoyer, il ne fait que réécrire |
| `npm run mangabaka:fetch` puis `mangabaka:apply` | genres, thèmes, cible, titre VO, **alias et abréviations**, et les liens de séries. `apply` n'écrit que les appariements **exacts** ; `-- --non-exactes` force les autres, `-- --revert` remonte `data/series-avant-mangabaka.json` |
| `npm run publication:fetch` puis `publication:apply` | tomes parus BnF et état de parution |
| `npm run titles:fetch` puis `titles:apply` | noms de séries alignés sur la BnF |
| `npm run publishers:fetch` puis `publishers:apply` | éditeurs depuis la BnF |
| `npm run relations:fetch` puis `relations:apply` | séries liées. **`fetch` n'appelle plus rien** : il dérive `data/relations.json` des liens déjà portés par `data/mangabaka.json`, hors ligne et instantanément |
| `npm run editions:audit` | **lecture seule** — apparie les éditions au catalogue par les EAN de leurs tomes et liste les écarts de nom, d'éditeur et de tomes parus dans `data/audit-editions.json`. Aveugle sur les 23 éditions sans ISBN |
| `npm run db:migrate` | applique les migrations à Neon sur le 443. `LOCAL_DATABASE_URL` la détourne vers un Postgres local, `MIGRATIONS_DIR` vers un autre dossier — les deux servent à répéter une migration avant de la livrer |

**Toujours relire le manifeste entre le `fetch` et le `apply`** — c'est la raison d'être du
découpage en deux temps, et l'oublier a déjà coûté une relecture après coup.

Le blocage du port 5432 décrit en §7 est propre au poste professionnel. Sur un réseau ordinaire,
`prisma migrate dev` attaque Neon directement et le détour par `npx prisma dev` devient inutile —
`npm run db:migrate` reste valable partout.

