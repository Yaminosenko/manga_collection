import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { StatutEdition } from "../lib/generated/prisma/enums";

const SOURCE_FILE = join(process.cwd(), "data", "collection.json");
const RESET_FLAG = "--reset";

type VolumeSource = {
  numero: number;
  possede: boolean;
};

type EditionSource = {
  slug: string;
  nom: string;
  editeur: string | null;
  tomesParus: number;
  editionTerminee: boolean | null;
  prixDefaut: number | null;
  statut: StatutEdition;
  termineeForcee: boolean;
  raisonCompletion: string | null;
  aVerifier: boolean;
  slugMangaNews: string | null;
  volumes: VolumeSource[];
};

type SerieSource = {
  slug: string;
  titre: string;
  auteur: string;
  genres: string[];
  themes: string[];
  cible: string | null;
  editions: EditionSource[];
};

function toCentimes(prix: number | null): number | null {
  return prix === null ? null : Math.round(prix * 100);
}

function readSource(): SerieSource[] {
  return (JSON.parse(readFileSync(SOURCE_FILE, "utf8")) as { series: SerieSource[] }).series;
}

async function assertEmptyOrReset(): Promise<void> {
  const existing = await prisma.edition.count();
  if (existing === 0) {
    return;
  }
  if (!process.argv.includes(RESET_FLAG)) {
    throw new Error(
      `La base contient deja ${existing} editions. Relancer avec ${RESET_FLAG} pour tout remplacer.`,
    );
  }
  await prisma.serie.deleteMany();
}

async function main(): Promise<void> {
  await assertEmptyOrReset();

  const series = readSource();
  const serieRows = [];
  const editionRows = [];
  const volumeRows = [];
  const possessionRows = [];

  for (const serie of series) {
    const serieId = randomUUID();
    serieRows.push({
      id: serieId,
      slug: serie.slug,
      titre: serie.titre,
      auteur: serie.auteur,
      genres: serie.genres,
      themes: serie.themes,
      cible: serie.cible,
    });

    for (const edition of serie.editions) {
      const editionId = randomUUID();
      editionRows.push({
        id: editionId,
        serieId,
        slug: edition.slug,
        nom: edition.nom,
        editeur: edition.editeur,
        tomesParus: edition.tomesParus,
        editionTerminee: edition.editionTerminee,
        prixDefautCentimes: toCentimes(edition.prixDefaut),
        statut: edition.statut,
        termineeForcee: edition.termineeForcee,
        raisonCompletion: edition.raisonCompletion,
        aVerifier: edition.aVerifier,
        slugMangaNews: edition.slugMangaNews,
      });

      for (const volume of edition.volumes) {
        const volumeId = randomUUID();
        volumeRows.push({ id: volumeId, editionId, numero: volume.numero });
        possessionRows.push({ id: randomUUID(), volumeId, possede: volume.possede });
      }
    }
  }

  await prisma.serie.createMany({ data: serieRows });
  await prisma.edition.createMany({ data: editionRows });
  await prisma.volume.createMany({ data: volumeRows });
  await prisma.possession.createMany({ data: possessionRows });

  const [series_, editions, volumes, possedes, aVerifier, forcees] = await Promise.all([
    prisma.serie.count(),
    prisma.edition.count(),
    prisma.volume.count(),
    prisma.possession.count({ where: { possede: true } }),
    prisma.edition.count({ where: { aVerifier: true } }),
    prisma.edition.count({ where: { termineeForcee: true } }),
  ]);

  const seriesMultiEditions = (
    await prisma.serie.findMany({ select: { _count: { select: { editions: true } } } })
  ).filter((serie) => serie._count.editions > 1).length;

  console.log(`Series                 : ${series_}`);
  console.log(`Editions               : ${editions}`);
  console.log(`Tomes                  : ${volumes}`);
  console.log(`Tomes possedes         : ${possedes}`);
  console.log(`Editions a verifier    : ${aVerifier}`);
  console.log(`Completions forcees    : ${forcees}`);
  console.log(`Series multi-editions  : ${seriesMultiEditions}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
