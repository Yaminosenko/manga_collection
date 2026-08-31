import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "publishers.json");
const SAUVEGARDE = join(process.cwd(), "data", "editions-avant-editeurs.json");
const RETOUR_ARRIERE = "--revert";

type Manifeste = Record<string, string>;
type Sauvegarde = Record<string, string | null>;

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
  for (const [slug, editeur] of Object.entries(sauvegarde)) {
    await prisma.edition.update({ where: { slug }, data: { editeur } });
    restaurees += 1;
  }
  console.log(`${restaurees} editions restaurees`);
}

async function main() {
  if (process.argv.includes(RETOUR_ARRIERE)) {
    await restaurer();
    return;
  }

  const manifeste = charger<Manifeste>(MANIFESTE, {});
  if (Object.keys(manifeste).length === 0) {
    console.log(`aucun editeur dans ${MANIFESTE} : lancer publishers:fetch d'abord`);
    return;
  }

  const editions = await prisma.edition.findMany({ select: { slug: true, editeur: true } });
  const parSlug = new Map(editions.map((edition) => [edition.slug, edition.editeur]));

  const sauvegarde: Sauvegarde = {};
  for (const edition of editions) {
    sauvegarde[edition.slug] = edition.editeur;
  }
  writeFileSync(SAUVEGARDE, `${JSON.stringify(sauvegarde, null, 2)}\n`);

  const absents: string[] = [];
  const remplis: string[] = [];
  const remplaces: string[] = [];

  for (const [slug, editeur] of Object.entries(manifeste)) {
    if (!parSlug.has(slug)) {
      absents.push(slug);
      continue;
    }
    const actuel = parSlug.get(slug) ?? null;
    if (actuel === editeur) {
      continue;
    }
    await prisma.edition.update({ where: { slug }, data: { editeur } });
    if (actuel === null) {
      remplis.push(`${slug} -> ${editeur}`);
    } else {
      remplaces.push(`${slug} : ${actuel} -> ${editeur}`);
    }
  }

  const sansEditeur = await prisma.edition.count({ where: { editeur: null } });

  console.log(`${remplis.length} editeurs renseignes, etat precedent dans ${SAUVEGARDE}`);
  for (const ligne of remplis) {
    console.log(`  ${ligne}`);
  }
  if (remplaces.length > 0) {
    console.log(`${remplaces.length} editeurs remplaces :`);
    for (const ligne of remplaces) {
      console.log(`  ${ligne}`);
    }
  }
  if (absents.length > 0) {
    console.log(`slugs absents en base : ${absents.join(", ")}`);
  }
  console.log(`editions sans editeur : ${sansEditeur}`);
}

main().finally(() => prisma.$disconnect());
