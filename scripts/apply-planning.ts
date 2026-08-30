import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "planning.json");
const SAUVEGARDE = join(process.cwd(), "data", "editions-avant-planning.json");
const RETOUR_ARRIERE = "--revert";

type Tome = {
  date: string;
  isbn: string | null;
  editeur: string | null;
};

type Fiche = {
  titre: string;
  tomesParusEnBase: number;
  tomes: Record<string, Tome>;
  maximum: number | null;
};

type Manifeste = Record<string, Fiche>;
type EtatAvant = Record<string, { tomesParus: number }>;

function charger<T>(chemin: string, defaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : defaut;
}

async function restaurer() {
  const avant = charger<EtatAvant | null>(SAUVEGARDE, null);
  if (!avant) {
    console.log(`aucune sauvegarde dans ${SAUVEGARDE} : rien a restaurer`);
    return;
  }

  let supprimes = 0;
  for (const [slug, etat] of Object.entries(avant)) {
    const edition = await prisma.edition.findUnique({ where: { slug }, select: { id: true } });
    if (!edition) continue;
    const { count } = await prisma.volume.deleteMany({
      where: { editionId: edition.id, numero: { gt: etat.tomesParus } },
    });
    await prisma.volume.updateMany({
      where: { editionId: edition.id },
      data: { isbn: null, dateSortie: null },
    });
    await prisma.edition.update({ where: { slug }, data: { tomesParus: etat.tomesParus } });
    supprimes += count;
  }
  console.log(
    `${Object.keys(avant).length} editions restaurees, ${supprimes} tomes supprimes, ISBN et dates effaces`,
  );
}

async function main() {
  if (process.argv.includes(RETOUR_ARRIERE)) {
    await restaurer();
    return;
  }

  const manifeste = charger<Manifeste>(MANIFESTE, {});
  if (Object.keys(manifeste).length === 0) {
    throw new Error(`${MANIFESTE} est vide : lancer python scripts/import_planning.py d'abord`);
  }

  const editions = await prisma.edition.findMany({
    where: { slug: { in: Object.keys(manifeste) } },
    select: { id: true, slug: true, tomesParus: true },
  });

  if (!existsSync(SAUVEGARDE)) {
    const avant: EtatAvant = {};
    for (const edition of editions) {
      avant[edition.slug] = { tomesParus: edition.tomesParus };
    }
    writeFileSync(SAUVEGARDE, `${JSON.stringify(avant, null, 2)}\n`);
    console.log(`sauvegarde de ${editions.length} editions ecrite dans ${SAUVEGARDE}`);
  }

  let tomesCrees = 0;
  let isbnEcrits = 0;
  let datesEcrites = 0;
  const elargies: string[] = [];

  for (const edition of editions) {
    const fiche = manifeste[edition.slug];
    const cible = Math.max(edition.tomesParus, fiche.maximum ?? 0);

    if (cible > edition.tomesParus) {
      for (let numero = edition.tomesParus + 1; numero <= cible; numero += 1) {
        await prisma.volume.create({
          data: { editionId: edition.id, numero, possession: { create: { possede: false } } },
        });
        tomesCrees += 1;
      }
      await prisma.edition.update({ where: { id: edition.id }, data: { tomesParus: cible } });
      elargies.push(`${edition.slug} ${edition.tomesParus} -> ${cible}`);
    }

    for (const [brut, tome] of Object.entries(fiche.tomes)) {
      const numero = Number(brut);
      if (numero > cible) continue;
      const { count } = await prisma.volume.updateMany({
        where: { editionId: edition.id, numero },
        data: { isbn: tome.isbn, dateSortie: new Date(tome.date) },
      });
      if (count > 0) {
        if (tome.isbn) isbnEcrits += 1;
        datesEcrites += 1;
      }
    }
  }

  const compteurs = {
    tomes: await prisma.volume.count(),
    possedes: await prisma.possession.count({ where: { possede: true } }),
    avecIsbn: await prisma.volume.count({ where: { isbn: { not: null } } }),
    avecDate: await prisma.volume.count({ where: { dateSortie: { not: null } } }),
  };

  console.log(`${elargies.length} editions elargies, ${tomesCrees} tomes crees`);
  for (const ligne of elargies) console.log(`  ${ligne}`);
  console.log(`${isbnEcrits} ISBN et ${datesEcrites} dates de sortie ecrits`);
  console.log(`compteurs : ${JSON.stringify(compteurs)}`);
}

main().finally(() => prisma.$disconnect());
