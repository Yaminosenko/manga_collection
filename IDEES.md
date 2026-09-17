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

> **Le glissement horizontal est construit le 17 septembre 2026** — `CLAUDE.md` §4 et
> `JOURNAL.md`. La piste `scroll-snap` décrite ci-dessous est bien ce qui a été fait, sans
> dépendance. Des cinq difficultés, la 3 était la bonne — le défilement par panneau a coûté tout
> le travail —, la 4 est **mesurée** et la réponse est *oui, les panneaux voisins chargent leurs
> images*, et la 5 est réglée depuis que les chiffres ont quitté le bandeau. **Ce qui reste
> ouvert ici est la pile à lire** (difficulté 2), donc une quatrième pastille et un geste que
> rien n'écrit — et la difficulté 1, les couvertures d'une série de wish list, que le cron
> quotidien a réglée depuis le 16 septembre.

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

### Se rendre invisible dans Communauté — 17 septembre 2026

**Ce qui reste de « la visibilité entre comptes » une fois la forme publique par défaut
arbitrée** (§13.7). L'écran Communauté liste tous les comptes et laisse visiter chacun :
**personne ne peut s'y soustraire**, et il n'y a aujourd'hui aucun réglage.

Ça ne gêne pas à deux comptes qui se connaissent. Ce qui le rendra nécessaire est écrit
d'avance : **le jour où un inconnu s'inscrit** — l'inscription est libre et le domaine public —,
il voit la liste des séries du propriétaire sans avoir rien demandé. Ce qui est déjà borné :
l'argent ne sort pas, les manquants et la wish list non plus.

Les formes possibles, par coût croissant : un booléen `visible` sur `Utilisateur`, qui retire du
classement et rend la visite introuvable ; ou la table `PartageCollection` écartée en §13.7, qui
inverse le défaut — on n'est visible que de qui on a autorisé. Le booléen est un ajout, donc sans
prix d'attente au sens de §13.1.

**Question qui vient avec** : un compte retiré du classement doit-il rester visitable par URL
directe ? Non si le réglage veut dire quelque chose — mais alors il faut le contrôler dans
`compteParIdentifiant`, pas seulement dans `classerComptes`.

### Montrer sa collection à quelqu'un qui n'a pas de compte — 17 septembre 2026

Le lien opaque, écarté en §13.7 parce qu'il rouvrait une session en lecture seule que §13.6
venait de supprimer. **Le besoin, lui, n'est pas mort** : Communauté ne sert qu'entre comptes
inscrits, et l'invité savait faire sans compte — c'est la seule chose qu'il savait faire et qui
n'est jamais revenue.

À rouvrir si le cas se présente pour de vrai. Il ne s'est pas présenté depuis le 11 septembre.

### La gestion des comptes côté propriétaire — 11 septembre 2026

Mis de côté à l'ouverture du chantier des comptes, le 11 septembre 2026 : l'auto-inscription
étant libre, **rien dans l'application ne montre qui s'est inscrit.** Le propriétaire ne peut
ni lister, ni renommer, ni supprimer un compte depuis son téléphone.

Ce n'est pas bloquant et c'est mesuré : `npm run compte -- --lister` le fait depuis le poste,
et la suppression d'un compte emporte déjà ses `SuiviEdition` et ses `Possession` par
`onDelete: Cascade` — éprouvé le 9 septembre sur le banc. Donc le besoin est réel mais le
geste existe ailleurs.

Ce qui le rendra nécessaire : **le jour où un compte inconnu s'inscrit et crée des fiches de
catalogue.** `Edition.creeeParId` dit déjà qui a créé quoi, et §13.2 prévoit un drapeau de
relecture — ce serait l'écran où il s'exerce. À rouvrir à ce moment-là, pas avant, et §13.2
dit pourquoi : la qualité d'une fiche se joue à la saisie, pas à la relecture.

### Les navigations instantanées — 11 septembre 2026

Parti d'une question à l'usage : **un temps de chargement court mais visible à chaque
changement de page**, qui casse la sensation d'application mobile. Consigné ici plutôt
qu'attaqué : c'est un chantier qui touche **toutes les pages**, et il n'est pas arbitré.

**Ce n'est pas la PWA.** Premier réflexe, et il est faux : le service worker n'existe pas
(§12), donc la couche PWA ne met rien en cache et ne peut ni ralentir ni accélérer une
navigation. L'app installée se comporte exactement comme l'onglet Chrome. Écarter cette
piste évite de croire qu'un service worker réglerait la chose — il mettrait en cache le
document, pas les données personnelles de §6.

**La cause est structurelle et lisible dans le code.** Dix pages portent
`export const dynamic = "force-dynamic"` — les 5 onglets, les 3 pages d'édition, `/scanner`
et `/acces`. Rien n'est donc prérendu, rien n'est mis en cache, et **chaque tap est un
aller-retour serveur complet** : fonction `fra1` → Prisma → Neon `eu-central-1` → agrégation
→ payload RSC. Le « mini chargement » n'est pas un artefact, c'est `app/(tabs)/loading.tsx`
qui s'affiche pendant que le serveur travaille — les 5 frontières `loading.tsx` font
exactement leur travail.

Deux facteurs aggravants déjà connus : la base **s'endort après 5 minutes** (§7, ~1 s de
réveil — c'est le pic, pas l'ordinaire), et le `force-dynamic` n'est pas seul en cause,
`utilisateurCourant()` et `estProprietaire()` lisant les cookies interdiraient de toute
façon le prérendu.

**Le levier existe dans Next 16.3.3** : `node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`
décrit précisément ce cas. Le chemin est `cacheComponents: true` + Partial Prefetching, puis
les directives `"use cache"` sur les chargeurs, ce qui fait entrer le contenu dans le *static
shell* et à portée du prefetch, avant le clic.

**Les difficultés, la plus structurante d'abord :**

1. **Toutes les données de l'app sont derrière un cookie, et ça plafonne le gain.** C'est
   `"use cache: private"` qui s'applique, pas `"use cache"` nu — et le doc est explicite :
   son résultat est **caché dans le navigateur seulement, pas sur le serveur**, et **ne peut
   pas faire partie du static shell**. Donc le shell ne portera jamais que l'ossature —
   en-tête, barre d'onglets, squelette de liste — et jamais une couverture ni un compteur.
   **C'est la question à trancher avant tout le reste : est-ce que « l'ossature instantanée,
   les données en streaming » suffit à l'effet recherché ?** Si oui le chantier vaut le coup ;
   si l'attente perçue ne change pas, il ne vaut rien.
2. **Le premier affichage ne s'améliore pas.** Un cache navigateur est froid à la première
   visite, et le réveil de Neon est devant lui. Le gain porte sur les navigations
   **suivantes**, pas sur l'ouverture de l'app — or c'est peut-être là que l'agacement est le
   plus fort. À mesurer avant, pas après.
3. **L'invalidation doit rester exacte au cochage.** `lib/actions.ts` appelle déjà
   `revalidatePath` sur `/`, `/manquants`, `/wishlist`, `/planning` et les pages d'édition à
   chaque écriture, donc le câblage existe. Mais la sémantique d'invalidation d'un cache
   **côté navigateur** n'a pas été vérifiée : un tome coché dont le compteur resterait périmé
   serait pire que le chargement qu'on cherche à supprimer.
4. **Descendre les frontières `<Suspense>`.** Le doc le dit sans détour — une validation qui
   passe ne veut pas dire que les états de chargement sont bons ; une frontière haute
   « remplace la majeure partie de la page par un seul fallback à chaque navigation », ce qui
   est exactement l'état actuel. Le travail d'interface est là, pas dans la config.
5. **Le `stale` minimal est de 5 minutes** pour que le shell porte du `use cache: private`.
   À confronter à l'usage réel en librairie, où l'on coche et rouvre dans la minute.

**Fausse piste à ne pas retenter** : `prefetch={true}` sur les `<Link>` de
`components/tab-bar.tsx`. Le doc tranche — *« Per-link prefetching cannot fix a route that
blocks without it »*. Sans le travail de cache en amont, le prefetch ne ramène que la coquille
jusqu'à `loading.tsx`, soit ce qui s'affiche déjà.

**Ordre, et pourquoi ça n'est pas urgent** : le chantier réécrit la façon dont chaque page
charge ses données, donc il entre en collision directe avec la refonte en panneaux glissants
ci-dessus — laquelle met justement plusieurs listes dans le DOM et pose une question de
chargement d'images non mesurée. **Les deux ne se mènent pas en parallèle.** Et rien n'est
cassé entre-temps : l'app est correcte, elle est seulement moins immersive qu'une native.

**Préalable à tout arbitrage : chronométrer sur le téléphone, en production.** Rien de ce qui
précède n'est mesuré — la répartition entre réveil de Neon, latence de la requête et rendu est
inconnue. Si le réveil domine, la réponse n'est pas le cache mais un ping de maintien, et ce
chantier tombe. Le document a quatre fois la leçon qu'une sonde ne prouve rien.

### Acheter `zenkanapp.com` — 17 septembre 2026

Venue avec le renommage en Zenkan. **Le domaine n'est pas acheté, et la décision est
explicitement reportée** ce même jour. Ce qui suit est ce qu'il faudra peser le jour où on la
reprend.

**Le frein est unique et il est dans §7** : un domaine est une dépense **certaine et
récurrente**, de l'ordre de 10 à 15 $/an. L'amendement du 1er septembre 2026 — « coût zéro, et
aucun débit possible sans franchir un palier hors d'atteinte » — ne le couvre pas, et c'est
écrit noir sur blanc : il « ne vaut que pour un service dont le palier gratuit est à deux
ordres de grandeur du besoin ». Un nom de domaine n'a pas de palier gratuit du tout. Acheter
`zenkanapp.com`, c'est donc **franchir la contrainte fondatrice du projet**, pas l'aménager.
Petite somme, mais la première.

**Ce que ça débloquerait, et qui n'est pas rien — trois choses déjà écrites ailleurs :**

- **Le domaine personnalisé sur le bucket R2.** C'est le seul « reste à faire » de §12 dont le
  frein est *uniquement* le coût du nom : l'URL `r2.dev` est limitée en débit et non mise en
  cache par Cloudflare, le basculement est gratuit et sans réenvoi, et `covers:migrate` ne fait
  que réécrire les URL. Un `covers.zenkanapp.com` sur un nom déjà payé ne coûte **rien de
  plus**.
- **Resend pour le lot 2 de §13.6.** Il a été écarté pour une raison unique — « Resend exige un
  domaine vérifié pour écrire à une adresse arbitraire » —, ce qui a fait retenir le SMTP de
  Gmail avec un mot de passe d'application. Un domaine vérifié supprime ce motif, et avec lui la
  gêne SPF/DKIM qui avait fait écarter Brevo et Mailjet.
- **Une URL qu'on peut dire à quelqu'un.** `manga-collection-wcj8.vercel.app` porte encore
  l'ancien nom et un suffixe généré. Confort pur, mais il devient réel le jour où un second
  compte n'est pas un compte d'essai.

**Ce que ça ne débloque pas, et qu'il ne faut pas s'imaginer :** rien dans le code n'attend ce
domaine, l'application fonctionne et se déploie telle quelle, et l'APK par Bubblewrap n'en a
pas besoin — `assetlinks.json` se sert très bien depuis `vercel.app`. Ça ne touche pas non plus
les quatre échéances de §13.4 : un domaine n'est pas un euro encaissé.

**La bonne question n'est donc pas « est-ce que ça vaut 12 $ »** — évidemment oui pour ce que ça
rend — **mais « est-ce qu'on ouvre la ligne des dépenses récurrentes »**, et à quoi on la ferme
ensuite. Le projet a tenu quinze ans de catalogue et 12 880 groupes sans payer un centime ; le
jour où un abonnement annuel existe, le suivant se justifie plus facilement.

## Questions ouvertes

- **La pile à lire arrive-t-elle dans ce lot ou après ?** C'est la seule des quatre pastilles
  qui demande un geste nouveau et une écriture que rien ne fait aujourd'hui.
- **Le tri et la recherche s'appliquent-ils au panneau actif ou restent-ils globaux ?** La
  référence n'affiche qu'un seul champ, ce qui suggère qu'il filtre le panneau visible.
- **Les compteurs d'en-tête restent-ils globaux ou suivent-ils le panneau ?**
- **Que devient l'onglet Manquants de la barre du bas** une fois « Compléter » dans la bande ?
  Deux navigations désigneraient la même chose.
- **Les panneaux glissants ou les navigations instantanées en premier ?** Les deux réécrivent
  la façon dont les écrans chargent leurs données, et le second supprimerait peut-être le
  besoin du premier — un glissement horizontal entre panneaux déjà montés n'a aucune
  navigation à rendre instantanée.
- **Le vocabulaire de « À jour ».** D.Gray-man est dit « à jour dans la parution » alors que
  l'application le montre 25/29 en « Édition en cours », le libellé exigeant
  `possédés == tomesParus`. Deux idées distinctes que le modèle fond en une : *je suis la
  parution* et *j'ai des trous anciens*. `suivie` capture la première pour le Planning ; reste à
  savoir si le libellé de la Collection doit la refléter.

## Écarté

- **La visibilité entre comptes « sur autorisation »** — une table `PartageCollection`, un écran
  pour accorder, un autre pour retirer. **Écartée le 17 septembre 2026** au profit du public par
  défaut : c'est la forme juste et la plus chère, et surtout **elle rend le classement
  impossible** — un top 10 suppose de pouvoir regarder tout le monde. Le motif de l'écarter est
  donc le coût, pas la justesse : si quelqu'un demande un jour à ne pas être vu, c'est elle ou
  un simple booléen qu'il faudra, voir « Se rendre invisible ». Voir §13.7.
- **La visibilité entre comptes « par lien opaque »** — un jeton dans l'URL, consultable **sans
  compte**. **Écartée le 17 septembre 2026** : c'est le retour d'une session en lecture seule,
  exactement ce que §13.6 venait de supprimer, et elle publie une collection à qui détient
  l'URL. C'était pourtant **la seule des trois qui remplaçait vraiment l'invité** — d'où l'entrée
  « Montrer sa collection à quelqu'un qui n'a pas de compte », qui garde le besoin ouvert.
  Voir §13.7.

---

## Arbitré — parti dans `CLAUDE.md`

Trace de sortie, pour qu'une session qui se souvient de la discussion sache où elle a fini.

- **Remplacer « terminé par choix » par « suivre »** — proposé le 4 septembre, **arbitré le
  8 septembre 2026**. `suivie` remplace `termineeForcee`, `@default(true)`, backfill
  `statut = 'EN_COURS' AND termineeForcee = false` → 84 suivies. `raisonCompletion` supprimée
  avec elle. Voir §13.1, « `suivie` remplace `termineeForcee` ».
- **Le rôle invité disparaît quand les comptes existent** — proposé le 9 septembre,
  **arbitré le 11 septembre 2026** : il est supprimé franchement avec le lot 1 des comptes,
  code compris — `jetonInvite`, `entrerEnInvite`, `quitterInvite`, la bannière, et la
  résolution invité → propriétaire de `lib/utilisateur.ts`. Voir §13.6. Ce qu'il rendait
  possible et qui n'a pas de remplaçant est resté ici, sous « La visibilité entre comptes ».
- **La visibilité entre comptes** — posée le 11 septembre avec trois formes et aucune écartée,
  **arbitrée le 17 septembre 2026** : c'est la forme **publique par défaut**, livrée comme l'écran
  **Communauté** — classement des dix plus grosses collections, recherche sur tous les comptes,
  visite en lecture seule sans l'argent. Voir §4 et §13.7. Les deux autres formes sont descendues
  dans « Écarté » avec leur motif, et les deux besoins qu'elles portaient et que la V1 ne couvre
  pas sont remontés en attente d'arbitrage : se rendre invisible, et montrer sa collection sans
  compte.
