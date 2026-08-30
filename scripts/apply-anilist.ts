import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "anilist.json");
const SAUVEGARDE = join(process.cwd(), "data", "series-avant-anilist.json");
const RETOUR_ARRIERE = "--revert";

const GENRES_DEPLACES_EN_THEMES = ["School Life", "Mature", "Guide", "Nekketsu"];

const GENRES_FRANCAIS: Record<string, string> = {
  Aventure: "Adventure",
  Comédie: "Comedy",
  Fantastique: "Fantasy",
};

type Correspondance = {
  titreLocal: string;
  id: number;
  romaji: string | null;
  native: string | null;
  genres: string[];
  score: number;
};

type Manifeste = Record<string, Correspondance | null>;
type EtatSerie = { titreVo: string | null; genres: string[]; themes: string[] };
type Sauvegarde = Record<string, EtatSerie>;

function charger<T>(chemin: string, defaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : defaut;
}

async function restaurer() {
  const sauvegarde = charger<Sauvegarde | null>(SAUVEGARDE, null);
  if (!sauvegarde) {
    console.log(`aucune sauvegarde dans ${SAUVEGARDE} : rien a restaurer`);
    return;
  }

  let restaurees = 0;
  for (const [slug, avant] of Object.entries(sauvegarde)) {
    await prisma.serie.update({
      where: { slug },
      data: { titreVo: avant.titreVo, genres: avant.genres, themes: avant.themes },
    });
    restaurees += 1;
  }
  console.log(`${restaurees} series restaurees`);
}

async function main() {
  if (process.argv.includes(RETOUR_ARRIERE)) {
    await restaurer();
    return;
  }

  const manifeste = charger<Manifeste>(MANIFESTE, {});
  if (Object.keys(manifeste).length === 0) {
    throw new Error(`${MANIFESTE} est vide : lancer npm run anilist:fetch d'abord`);
  }

  const series = await prisma.serie.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true, titreVo: true, genres: true, themes: true },
  });

  if (!existsSync(SAUVEGARDE)) {
    const sauvegarde: Sauvegarde = {};
    for (const serie of series) {
      sauvegarde[serie.slug] = {
        titreVo: serie.titreVo,
        genres: serie.genres,
        themes: serie.themes,
      };
    }
    writeFileSync(SAUVEGARDE, `${JSON.stringify(sauvegarde, null, 2)}\n`);
    console.log(`sauvegarde de ${series.length} series ecrite dans ${SAUVEGARDE}`);
  }

  const ignorees: string[] = [];
  let ecrites = 0;

  for (const serie of series) {
    const correspondance = manifeste[serie.slug];
    const orphelins = serie.genres.filter((genre) => GENRES_DEPLACES_EN_THEMES.includes(genre));
    const themes = [...new Set([...serie.themes, ...orphelins])];

    if (!correspondance) {
      const traduits = serie.genres
        .filter((genre) => !GENRES_DEPLACES_EN_THEMES.includes(genre))
        .map((genre) => GENRES_FRANCAIS[genre] ?? genre);

      await prisma.serie.update({
        where: { slug: serie.slug },
        data: { genres: [...new Set(traduits)], themes },
      });
      ignorees.push(serie.slug);
      continue;
    }

    await prisma.serie.update({
      where: { slug: serie.slug },
      data: {
        titreVo: correspondance.native ?? correspondance.romaji ?? serie.titreVo,
        genres: correspondance.genres,
        themes,
      },
    });
    ecrites += 1;
  }

  const avecTitreVo = await prisma.serie.count({ where: { titreVo: { not: null } } });
  const genresDistincts = new Set(
    (await prisma.serie.findMany({ select: { genres: true } })).flatMap((serie) => serie.genres),
  );

  console.log(`${ecrites} series depuis AniList, ${ignorees.length} traduites sans correspondance`);
  console.log(`titreVo renseigne : ${avecTitreVo} / ${series.length}`);
  console.log(`genres distincts : ${genresDistincts.size} — ${[...genresDistincts].sort().join(", ")}`);
  if (ignorees.length > 0) {
    console.log(`sans correspondance AniList : ${ignorees.join(", ")}`);
  }
}

main().finally(() => prisma.$disconnect());
