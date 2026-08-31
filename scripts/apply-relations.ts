import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { TypeLienSerie } from "../lib/generated/prisma/enums";

const MANIFESTE = join(process.cwd(), "data", "relations.json");
const RETOUR_ARRIERE = "--revert";

type Lien = { slug: string; type: string };
type Manifeste = Record<string, Lien[]>;

const TYPES_CONNUS: TypeLienSerie[] = [
  "PREQUELLE",
  "SUITE",
  "SERIE_MERE",
  "HORS_SERIE",
  "SPIN_OFF",
  "GUIDE",
  "AUTRE",
];

function typeValide(valeur: string): valeur is TypeLienSerie {
  return (TYPES_CONNUS as string[]).includes(valeur);
}

async function main() {
  if (process.argv.includes(RETOUR_ARRIERE)) {
    const { count } = await prisma.lienSerie.deleteMany({});
    console.log(`${count} liens supprimes`);
    return;
  }

  if (!existsSync(MANIFESTE)) {
    console.log(`${MANIFESTE} absent : lancer relations:fetch d'abord`);
    return;
  }

  const manifeste = JSON.parse(readFileSync(MANIFESTE, "utf-8")) as Manifeste;
  const series = await prisma.serie.findMany({ select: { id: true, slug: true, titre: true } });
  const parSlug = new Map(series.map((serie) => [serie.slug, serie]));

  const inconnus: string[] = [];
  const invalides: string[] = [];
  const aEcrire: { serieId: string; serieLieeId: string; type: TypeLienSerie }[] = [];

  for (const [slug, liens] of Object.entries(manifeste)) {
    const serie = parSlug.get(slug);
    if (!serie) {
      inconnus.push(slug);
      continue;
    }
    for (const lien of liens) {
      const liee = parSlug.get(lien.slug);
      if (!liee) {
        inconnus.push(lien.slug);
        continue;
      }
      if (!typeValide(lien.type)) {
        invalides.push(`${slug} -> ${lien.slug} : ${lien.type}`);
        continue;
      }
      aEcrire.push({ serieId: serie.id, serieLieeId: liee.id, type: lien.type });
    }
  }

  const avant = await prisma.lienSerie.count();
  await prisma.lienSerie.deleteMany({});
  await prisma.lienSerie.createMany({ data: aEcrire });
  const apres = await prisma.lienSerie.count();

  const parId = new Map(series.map((serie) => [serie.id, serie.titre]));
  for (const lien of aEcrire) {
    console.log(`  ${parId.get(lien.serieId)} — ${lien.type} — ${parId.get(lien.serieLieeId)}`);
  }

  console.log(`${avant} liens avant, ${apres} apres`);
  if (inconnus.length > 0) {
    console.log(`slugs absents en base : ${[...new Set(inconnus)].join(", ")}`);
  }
  if (invalides.length > 0) {
    console.log(`types inconnus : ${invalides.join(", ")}`);
  }
}

main().finally(() => prisma.$disconnect());
