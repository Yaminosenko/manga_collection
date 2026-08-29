import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const SOURCE = join(process.cwd(), "data", "covers.json");
const RETOUR_ARRIERE = "--revert";

type Manifeste = Record<string, number[]>;

async function appliquer(manifeste: Manifeste, effacer: boolean) {
  const absents: string[] = [];
  let ecrits = 0;

  for (const [slug, numeros] of Object.entries(manifeste)) {
    const edition = await prisma.edition.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!edition) {
      absents.push(slug);
      continue;
    }
    for (const numero of numeros) {
      await prisma.volume.update({
        where: { editionId_numero: { editionId: edition.id, numero } },
        data: { couvertureUrl: effacer ? null : `/covers/${slug}/${numero}.webp` },
      });
      ecrits += 1;
    }
  }

  return { ecrits, absents };
}

async function main() {
  const effacer = process.argv.includes(RETOUR_ARRIERE);
  const manifeste = JSON.parse(readFileSync(SOURCE, "utf-8")) as Manifeste;

  const { ecrits, absents } = await appliquer(manifeste, effacer);

  const avecCouverture = await prisma.volume.count({ where: { couvertureUrl: { not: null } } });
  const compteurs = {
    series: await prisma.serie.count(),
    editions: await prisma.edition.count(),
    tomes: await prisma.volume.count(),
    possedes: await prisma.possession.count({ where: { possede: true } }),
    aVerifier: await prisma.edition.count({ where: { aVerifier: true } }),
    forcees: await prisma.edition.count({ where: { termineeForcee: true } }),
  };

  console.log(`${ecrits} volumes ${effacer ? "remis a null" : "mis a jour"}`);
  if (absents.length > 0) {
    console.log(`slugs absents en base : ${absents.join(", ")}`);
  }
  console.log(`volumes avec couverture : ${avecCouverture} / ${compteurs.tomes}`);
  console.log(`compteurs : ${JSON.stringify(compteurs)}`);
}

main().finally(() => prisma.$disconnect());
