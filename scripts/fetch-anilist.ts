import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { URL_ANILIST } from "../lib/constants";

const MANIFESTE = join(process.cwd(), "data", "anilist.json");
const REQUETES_PAR_MINUTE = 28;
const TENTATIVES_MAX = 4;
const ATTENTE_PAR_DEFAUT_SECONDES = 60;
const CANDIDATS_CONSERVES = 3;
const SCORE_A_RELIRE = 0.5;

const RECHERCHES_MANUELLES: Record<string, string> = {
  "ippo-s4-la-loi-du-ring": "Hajime no Ippo",
  "je-suis-un-assassin-et-je-surpasse-le-heros":
    "Ansatsusha de aru Ore no Status ga Yuusha yori mo Akiraka ni Tsuyoi",
  "kaijin-reijoh": "Kaijin Reijou",
  "kaiju-n8": "Kaijuu 8-gou",
  "marimashita-iruma-kun": "Mairimashita! Iruma-kun",
  "mirai-nikki-le-journal-du-futur": "Mirai Nikki",
  "monster-musume-everyday-life-with-monster-girls": "Monster Musume no Iru Nichijou",
  "mushoku-tensei-l-epee-d-iris": "Mushoku Tensei: Isekai Ittara Honki Dasu",
  "one-puch-man": "One Punch-Man",
  "oriant-samurai-quest": "Orient",
  "pandora-heart-8-5": "Pandora Hearts",
  "pokemon-la-grande-aventure": "Pocket Monsters Special",
  "pokemon-zoroark-le-maitre-des-illusion": "Pokemon Zoroark Master of Illusions",
  "red-eyes-sword-akame-ga-kill": "Akame ga Kill!",
  "red-eyes-sword-akame-ga-kill-zero": "Akame ga Kill! Zero",
  "saga-of-tany-the-evil-youjo-senki": "Youjo Senki",
  "terraformars": "Terra Formars",
  "the-ancient-magus-bride-supplement-2": "Mahoutsukai no Yome",
  "the-unwanted-unded-adventurer": "Nozomanu Fushi no Boukensha",
  "uqholder": "UQ Holder",
  "why-nobody-remember-my-world": "Naze Boku no Sekai wo Daremo Oboeteinai no ka",
  "yuna-de-la-pension-yuragi": "Yuragi-sou no Yuuna-san",
};

const REQUETE = `
query ($recherche: String, $parPage: Int) {
  Page(perPage: $parPage) {
    media(search: $recherche, type: MANGA, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      synonyms
      genres
    }
  }
}`;

type MediaAniList = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[] | null;
  genres: string[] | null;
};

type Correspondance = {
  titreLocal: string;
  recherche: string;
  id: number;
  romaji: string | null;
  native: string | null;
  genres: string[];
  score: number;
  autresCandidats: string[];
};

type Manifeste = Record<string, Correspondance | null>;

let dernierAppel = 0;

async function dormir(millisecondes: number) {
  await new Promise((suite) => setTimeout(suite, millisecondes));
}

async function patienter() {
  const minimum = 60_000 / REQUETES_PAR_MINUTE;
  const ecart = Date.now() - dernierAppel;
  if (ecart < minimum) {
    await dormir(minimum - ecart);
  }
  dernierAppel = Date.now();
}

function normaliser(texte: string): string {
  return texte
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function similarite(gauche: string, droite: string): number {
  if (gauche === droite) return 1;
  if (gauche.length === 0 || droite.length === 0) return 0;

  let precedente = Array.from({ length: droite.length + 1 }, (_, index) => index);
  for (let i = 1; i <= gauche.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= droite.length; j += 1) {
      const cout = gauche[i - 1] === droite[j - 1] ? 0 : 1;
      courante[j] = Math.min(courante[j - 1] + 1, precedente[j] + 1, precedente[j - 1] + cout);
    }
    precedente = courante;
  }

  return 1 - precedente[droite.length] / Math.max(gauche.length, droite.length);
}

function scoreDeConfiance(titreLocal: string, media: MediaAniList): number {
  const cible = normaliser(titreLocal);
  const noms = [media.title.romaji, media.title.english, media.title.native, ...(media.synonyms ?? [])]
    .filter((nom): nom is string => typeof nom === "string" && nom.length > 0)
    .map(normaliser);

  return Math.max(0, ...noms.map((nom) => similarite(cible, nom)));
}

async function interroger(recherche: string): Promise<MediaAniList[]> {
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
    await patienter();
    const reponse = await fetch(URL_ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: REQUETE,
        variables: { recherche, parPage: CANDIDATS_CONSERVES },
      }),
    });

    if (reponse.status === 429) {
      const entete = Number(reponse.headers.get("retry-after"));
      const attente = Number.isFinite(entete) && entete > 0 ? entete : ATTENTE_PAR_DEFAUT_SECONDES;
      console.log(`  429, pause de ${attente} s`);
      await dormir(attente * 1000);
      continue;
    }

    if (!reponse.ok) {
      throw new Error(`AniList a repondu ${reponse.status}`);
    }

    const charge = (await reponse.json()) as { data?: { Page?: { media?: MediaAniList[] } } };
    return charge.data?.Page?.media ?? [];
  }

  throw new Error(`AniList reste sature apres ${TENTATIVES_MAX} tentatives`);
}

function charger(): Manifeste {
  return existsSync(MANIFESTE) ? (JSON.parse(readFileSync(MANIFESTE, "utf-8")) as Manifeste) : {};
}

function enregistrer(manifeste: Manifeste) {
  writeFileSync(MANIFESTE, `${JSON.stringify(manifeste, null, 2)}\n`);
}

async function main() {
  const series = await prisma.serie.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, titre: true },
  });

  const manifeste = charger();
  const introuvables: string[] = [];
  const aRelire: string[] = [];

  for (const serie of series) {
    if (manifeste[serie.slug] == null) {
      const recherche = RECHERCHES_MANUELLES[serie.slug] ?? serie.titre;
      try {
        const media = await interroger(recherche);
        const premier = media[0];
        manifeste[serie.slug] = premier
          ? {
              titreLocal: serie.titre,
              recherche,
              id: premier.id,
              romaji: premier.title.romaji,
              native: premier.title.native,
              genres: premier.genres ?? [],
              score: Number(scoreDeConfiance(serie.titre, premier).toFixed(3)),
              autresCandidats: media
                .slice(1)
                .map((autre) => autre.title.romaji ?? autre.title.native ?? String(autre.id)),
            }
          : null;
        enregistrer(manifeste);
      } catch (erreur) {
        console.log(`${serie.slug} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
        continue;
      }
    }

    const correspondance = manifeste[serie.slug];
    if (!correspondance) {
      introuvables.push(serie.slug);
    } else if (correspondance.score < SCORE_A_RELIRE) {
      aRelire.push(`${serie.slug} → ${correspondance.romaji} (${correspondance.score})`);
    }
  }

  const trouvees = Object.values(manifeste).filter((valeur) => valeur !== null).length;
  console.log(`${trouvees} correspondances sur ${series.length}, ecrites dans ${MANIFESTE}`);
  if (introuvables.length > 0) {
    console.log(`\nsans resultat AniList (${introuvables.length}) :\n  ${introuvables.join("\n  ")}`);
  }
  if (aRelire.length > 0) {
    console.log(`\nscore faible, a relire (${aRelire.length}) :\n  ${aRelire.join("\n  ")}`);
  }
}

main().finally(() => prisma.$disconnect());
