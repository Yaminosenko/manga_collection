import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "titles.json");
const SAUVEGARDE = join(process.cwd(), "data", "series-avant-titres.json");
const RETOUR_ARRIERE = "--revert";

type Proposition = {
  actuel: string;
  propose: string;
  source: string;
  changementOrthographe: boolean;
};

type Manifeste = Record<string, Proposition>;
type Sauvegarde = Record<string, string>;

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
  for (const [slug, titre] of Object.entries(sauvegarde)) {
    await prisma.serie.update({ where: { slug }, data: { titre } });
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
    console.log(`aucune proposition dans ${MANIFESTE} : lancer titles:fetch d'abord`);
    return;
  }

  const series = await prisma.serie.findMany({ select: { slug: true, titre: true } });
  const parSlug = new Map(series.map((serie) => [serie.slug, serie.titre]));

  const sauvegarde: Sauvegarde = {};
  for (const serie of series) {
    sauvegarde[serie.slug] = serie.titre;
  }
  writeFileSync(SAUVEGARDE, `${JSON.stringify(sauvegarde, null, 2)}\n`);

  const absents: string[] = [];
  const orthographe: string[] = [];
  let ecrits = 0;

  for (const [slug, proposition] of Object.entries(manifeste)) {
    const actuel = parSlug.get(slug);
    if (actuel === undefined) {
      absents.push(slug);
      continue;
    }
    if (actuel === proposition.propose) {
      continue;
    }
    await prisma.serie.update({ where: { slug }, data: { titre: proposition.propose } });
    ecrits += 1;
    if (proposition.changementOrthographe) {
      orthographe.push(`${actuel} -> ${proposition.propose}`);
    }
  }

  const [nombreSeries, editions, volumes, possedes] = await Promise.all([
    prisma.serie.count(),
    prisma.edition.count(),
    prisma.volume.count(),
    prisma.possession.count({ where: { possede: true } }),
  ]);

  console.log(`${ecrits} titres reecrits, etat precedent dans ${SAUVEGARDE}`);
  if (orthographe.length > 0) {
    console.log(`dont ${orthographe.length} corrections d'orthographe :`);
    for (const ligne of orthographe) {
      console.log(`  ${ligne}`);
    }
  }
  if (absents.length > 0) {
    console.log(`slugs absents en base : ${absents.join(", ")}`);
  }
  console.log(`series ${nombreSeries} · editions ${editions} · tomes ${volumes} · possedes ${possedes}`);
}

main().finally(() => prisma.$disconnect());
