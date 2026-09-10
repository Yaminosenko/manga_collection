import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { formesNormalisees, normaliserAlias } from "../lib/normalisation";

const MANIFESTE = join(process.cwd(), "data", "mangabaka.json");
const SAUVEGARDE = join(process.cwd(), "data", "series-avant-mangabaka.json");
const RETOUR_ARRIERE = "--revert";
const NON_EXACTES = "--non-exactes";

type Correspondance = {
  id: number;
  titre: string;
  titreVo: string | null;
  genres: string[];
  themes: string[];
  cible: string | null;
  alias: string[];
  exact: boolean;
  score: number;
};

type Manifeste = Record<string, Correspondance | null>;

type EtatSerie = {
  titreVo: string | null;
  genres: string[];
  themes: string[];
  cible: string | null;
  alias: string[];
  aliasNormalises: string[];
  idMangaBaka: number | null;
};

type Sauvegarde = Record<string, EtatSerie>;

function charger<T>(chemin: string, defaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : defaut;
}

function aliasFusionnes(titre: string, existants: string[], venus: string[]): string[] {
  const normaliseDuTitre = normaliserAlias(titre);
  const vus = new Set([normaliseDuTitre]);
  const retenus: string[] = [];

  for (const candidat of [...existants, ...venus]) {
    const normalise = normaliserAlias(candidat);
    if (normalise === "" || vus.has(normalise)) continue;
    vus.add(normalise);
    retenus.push(candidat);
  }

  return retenus;
}

async function restaurer() {
  const sauvegarde = charger<Sauvegarde | null>(SAUVEGARDE, null);
  if (!sauvegarde) {
    console.log(`aucune sauvegarde dans ${SAUVEGARDE} : rien a restaurer`);
    return;
  }

  for (const [slug, avant] of Object.entries(sauvegarde)) {
    await prisma.serie.update({ where: { slug }, data: avant });
  }
  console.log(`${Object.keys(sauvegarde).length} series restaurees`);
}

async function main() {
  if (process.argv.includes(RETOUR_ARRIERE)) {
    await restaurer();
    return;
  }

  const inclureNonExactes = process.argv.includes(NON_EXACTES);
  const manifeste = charger<Manifeste>(MANIFESTE, {});
  if (Object.keys(manifeste).length === 0) {
    throw new Error(`${MANIFESTE} est vide : lancer npm run mangabaka:fetch d'abord`);
  }

  const series = await prisma.serie.findMany({
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      titre: true,
      titreVo: true,
      genres: true,
      themes: true,
      cible: true,
      alias: true,
      aliasNormalises: true,
      idMangaBaka: true,
    },
  });

  if (!existsSync(SAUVEGARDE)) {
    const sauvegarde: Sauvegarde = {};
    for (const serie of series) {
      sauvegarde[serie.slug] = {
        titreVo: serie.titreVo,
        genres: serie.genres,
        themes: serie.themes,
        cible: serie.cible,
        alias: serie.alias,
        aliasNormalises: serie.aliasNormalises,
        idMangaBaka: serie.idMangaBaka,
      };
    }
    writeFileSync(SAUVEGARDE, `${JSON.stringify(sauvegarde, null, 2)}\n`);
    console.log(`sauvegarde de ${series.length} series ecrite dans ${SAUVEGARDE}`);
  }

  const ignorees: string[] = [];
  const ecartees: string[] = [];
  let ecrites = 0;
  let genresChanges = 0;
  let themesRemplis = 0;
  let ciblesRemplies = 0;
  let aliasAjoutes = 0;

  for (const serie of series) {
    const correspondance = manifeste[serie.slug];

    if (!correspondance) {
      ignorees.push(serie.slug);
    } else if (!correspondance.exact && !inclureNonExactes) {
      ecartees.push(`${serie.slug} → ${correspondance.titre} (${correspondance.score})`);
    }

    const retenue =
      correspondance && (correspondance.exact || inclureNonExactes) ? correspondance : null;

    const alias = aliasFusionnes(serie.titre, serie.alias, retenue?.alias ?? []);
    const titreVo = serie.titreVo ?? retenue?.titreVo ?? null;
    const genres = retenue && retenue.genres.length > 0 ? retenue.genres : serie.genres;
    const themes =
      serie.themes.length === 0 && retenue ? retenue.themes : serie.themes;
    const cible = serie.cible ?? retenue?.cible ?? null;

    await prisma.serie.update({
      where: { slug: serie.slug },
      data: {
        titreVo,
        genres,
        themes,
        cible,
        alias,
        aliasNormalises: formesNormalisees(serie.titre, titreVo, alias),
        idMangaBaka: retenue?.id ?? serie.idMangaBaka,
      },
    });

    ecrites += 1;
    if (genres.join("|") !== serie.genres.join("|")) genresChanges += 1;
    if (themes.length > 0 && serie.themes.length === 0) themesRemplis += 1;
    if (cible !== null && serie.cible === null) ciblesRemplies += 1;
    aliasAjoutes += Math.max(0, alias.length - serie.alias.length);
  }

  const apres = await prisma.serie.findMany({
    select: { genres: true, themes: true, aliasNormalises: true, idMangaBaka: true },
  });
  const genresDistincts = new Set(apres.flatMap((serie) => serie.genres));
  const themesDistincts = new Set(apres.flatMap((serie) => serie.themes));
  const formes = apres.reduce((somme, serie) => somme + serie.aliasNormalises.length, 0);

  console.log();
  console.log(`Series ecrites        : ${ecrites}`);
  console.log(`Genres modifies       : ${genresChanges}`);
  console.log(`Themes remplis        : ${themesRemplis}`);
  console.log(`Cibles remplies       : ${ciblesRemplies}`);
  console.log(`Alias ajoutes         : ${aliasAjoutes}`);
  console.log(`Formes indexees       : ${formes}`);
  console.log(`Series avec idMangaBaka : ${apres.filter((serie) => serie.idMangaBaka !== null).length}`);
  console.log(`Genres distincts (${genresDistincts.size}) : ${[...genresDistincts].sort().join(", ")}`);
  console.log(`Themes distincts : ${themesDistincts.size}`);
  if (ignorees.length > 0) {
    console.log(`\nsans correspondance MangaBaka (${ignorees.length}) : ${ignorees.join(", ")}`);
  }
  if (ecartees.length > 0) {
    console.log(
      `\nappariement non exact, ecarte — relancer avec ${NON_EXACTES} pour les inclure (${ecartees.length}) :\n  ${ecartees.join("\n  ")}`,
    );
  }
}

main().finally(() => prisma.$disconnect());
