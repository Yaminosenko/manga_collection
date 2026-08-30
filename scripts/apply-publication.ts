import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "publication.json");
const SAUVEGARDE = join(process.cwd(), "data", "editions-avant-publication.json");
const RETOUR_ARRIERE = "--revert";
const PART_TROUS_MAX = 0.15;

const REEDITIONS = new Set(["blame", "gantz", "neon-genesis-evangelion"]);

type Bnf = {
  maximum: number | null;
  trous?: number[];
};

type AniList = {
  volumes: number | null;
  statut: string | null;
};

type Entree = {
  titre: string;
  tomesParusEnBase: number;
  bnf: Bnf;
  anilist: AniList | null;
};

type Manifeste = Record<string, Entree>;
type EtatAvant = Record<string, { tomesParus: number; editionTerminee: boolean | null }>;

function lectureFiable(bnf: Bnf): boolean {
  if (bnf.maximum === null) return false;
  return (bnf.trous ?? []).length <= Math.max(1, bnf.maximum * PART_TROUS_MAX);
}

function tomesParusCible(slug: string, entree: Entree): number {
  const { maximum } = entree.bnf;
  if (maximum === null || REEDITIONS.has(slug) || !lectureFiable(entree.bnf)) {
    return entree.tomesParusEnBase;
  }
  return Math.max(entree.tomesParusEnBase, maximum);
}

function editionTerminee(entree: Entree, tomesParus: number): boolean | null {
  const anilist = entree.anilist;
  if (!anilist || anilist.statut === null) return null;
  if (anilist.statut === "RELEASING") return false;
  if (anilist.statut !== "FINISHED" && anilist.statut !== "CANCELLED") return null;
  if (anilist.volumes === null) return null;
  return tomesParus >= anilist.volumes;
}

function charger<T>(chemin: string, defaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : defaut;
}

async function restaurer() {
  const avant = charger<EtatAvant | null>(SAUVEGARDE, null);
  if (!avant) {
    console.log(`aucune sauvegarde dans ${SAUVEGARDE} : rien a restaurer`);
    return;
  }

  let editions = 0;
  let supprimes = 0;
  for (const [slug, etat] of Object.entries(avant)) {
    const edition = await prisma.edition.findUnique({ where: { slug }, select: { id: true } });
    if (!edition) continue;
    const { count } = await prisma.volume.deleteMany({
      where: { editionId: edition.id, numero: { gt: etat.tomesParus } },
    });
    await prisma.edition.update({
      where: { slug },
      data: { tomesParus: etat.tomesParus, editionTerminee: etat.editionTerminee },
    });
    editions += 1;
    supprimes += count;
  }
  console.log(`${editions} editions restaurees, ${supprimes} tomes ajoutes supprimes`);
}

async function main() {
  if (process.argv.includes(RETOUR_ARRIERE)) {
    await restaurer();
    return;
  }

  const manifeste = charger<Manifeste>(MANIFESTE, {});
  if (Object.keys(manifeste).length === 0) {
    throw new Error(`${MANIFESTE} est vide : lancer python scripts/fetch_publication.py d'abord`);
  }

  const editions = await prisma.edition.findMany({
    where: { slug: { in: Object.keys(manifeste) } },
    select: { id: true, slug: true, tomesParus: true, editionTerminee: true },
  });

  if (!existsSync(SAUVEGARDE)) {
    const avant: EtatAvant = {};
    for (const edition of editions) {
      avant[edition.slug] = {
        tomesParus: edition.tomesParus,
        editionTerminee: edition.editionTerminee,
      };
    }
    writeFileSync(SAUVEGARDE, `${JSON.stringify(avant, null, 2)}\n`);
    console.log(`sauvegarde de ${editions.length} editions ecrite dans ${SAUVEGARDE}`);
  }

  let tomesAjoutes = 0;
  const elargies: string[] = [];
  const statuts = { terminees: 0, enCours: 0, inconnues: 0 };

  for (const edition of editions) {
    const entree = manifeste[edition.slug];
    const cible = tomesParusCible(edition.slug, entree);
    const terminee = editionTerminee(entree, cible);

    if (terminee === true) statuts.terminees += 1;
    else if (terminee === false) statuts.enCours += 1;
    else statuts.inconnues += 1;

    if (cible > edition.tomesParus) {
      const nouveaux = [];
      for (let numero = edition.tomesParus + 1; numero <= cible; numero += 1) {
        nouveaux.push(numero);
      }
      for (const numero of nouveaux) {
        await prisma.volume.create({
          data: {
            editionId: edition.id,
            numero,
            possession: { create: { possede: false } },
          },
        });
      }
      tomesAjoutes += nouveaux.length;
      elargies.push(`${edition.slug} ${edition.tomesParus} -> ${cible}`);
    }

    await prisma.edition.update({
      where: { id: edition.id },
      data: { tomesParus: cible, editionTerminee: terminee },
    });
  }

  const compteurs = {
    editions: await prisma.edition.count(),
    tomes: await prisma.volume.count(),
    possedes: await prisma.possession.count({ where: { possede: true } }),
    terminees: await prisma.edition.count({ where: { editionTerminee: true } }),
    enCours: await prisma.edition.count({ where: { editionTerminee: false } }),
    inconnues: await prisma.edition.count({ where: { editionTerminee: null } }),
  };

  console.log(`${elargies.length} editions elargies, ${tomesAjoutes} tomes crees`);
  for (const ligne of elargies) console.log(`  ${ligne}`);
  console.log(`statut pose : ${JSON.stringify(statuts)}`);
  console.log(`compteurs : ${JSON.stringify(compteurs)}`);
}

main().finally(() => prisma.$disconnect());
