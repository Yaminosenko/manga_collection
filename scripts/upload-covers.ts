import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";
import { prisma } from "../lib/prisma";

const SOURCE = join(process.cwd(), "data", "covers.json");
const SOURCE_ANNONCES = join(process.cwd(), "data", "covers-annonces.json");
const MANIFESTE_BLOB = join(process.cwd(), "data", "blob.json");
const DOSSIER_LOCAL = join(process.cwd(), "public", "covers");
const PREFIXE_BLOB = "covers";
const EXTENSION = ".webp";
const TYPE_IMAGE = "image/webp";
const CACHE_UN_AN_SECONDES = 31_536_000;
const CONCURRENCE = 8;
const PAGE_LISTE = 1000;
const RETOUR_ARRIERE = "--revert";
const FORCER = "--force";
const PLAFOND = "--max";
const SEPARATEUR_CIBLE = ":";
const ENVOIS_MAX_PAR_DEFAUT = 150;
const QUOTA_MENSUEL_AVANCEES = 2000;

type Manifeste = Record<string, number[]>;

type Couverture = {
  slug: string;
  numero: number;
  chemin: string;
  cheminLocal: string;
};

type Options = {
  retourArriere: boolean;
  plafond: number;
  slugsForces: Set<string>;
  ciblesForcees: Set<string>;
};

function charger(chemin: string): Manifeste {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as Manifeste) : {};
}

function inventorier(manifeste: Manifeste): Couverture[] {
  return Object.entries(manifeste).flatMap(([slug, numeros]) =>
    numeros.map((numero) => ({
      slug,
      numero,
      chemin: `${PREFIXE_BLOB}/${slug}/${numero}${EXTENSION}`,
      cheminLocal: join(DOSSIER_LOCAL, slug, `${numero}${EXTENSION}`),
    })),
  );
}

function lireOptions(argv: string[]): Options {
  const slugsForces = new Set<string>();
  const ciblesForcees = new Set<string>();
  let plafond = ENVOIS_MAX_PAR_DEFAUT;
  let index = 0;

  while (index < argv.length) {
    if (argv[index] === PLAFOND) {
      const valeur = Number(argv[index + 1]);
      if (!Number.isInteger(valeur) || valeur <= 0) {
        throw new Error(`${PLAFOND} attend un entier positif`);
      }
      plafond = valeur;
      index += 2;
      continue;
    }

    if (argv[index] === FORCER) {
      index += 1;
      while (index < argv.length && !argv[index].startsWith("--")) {
        const [slug, numero] = argv[index].split(SEPARATEUR_CIBLE);
        if (numero === undefined) {
          slugsForces.add(slug);
        } else {
          ciblesForcees.add(`${slug}${SEPARATEUR_CIBLE}${numero}`);
        }
        index += 1;
      }
      continue;
    }

    index += 1;
  }

  return { retourArriere: argv.includes(RETOUR_ARRIERE), plafond, slugsForces, ciblesForcees };
}

function estForcee(couverture: Couverture, options: Options): boolean {
  return (
    options.slugsForces.has(couverture.slug) ||
    options.ciblesForcees.has(`${couverture.slug}${SEPARATEUR_CIBLE}${couverture.numero}`)
  );
}

async function listerBlobsExistants(): Promise<{ existants: Map<string, string>; pages: number }> {
  const existants = new Map<string, string>();
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await list({ prefix: `${PREFIXE_BLOB}/`, limit: PAGE_LISTE, cursor });
    pages += 1;
    for (const blob of page.blobs) {
      existants.set(blob.pathname, blob.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return { existants, pages };
}

async function envoyer(couverture: Couverture): Promise<string> {
  const contenu = await readFile(couverture.cheminLocal);
  const blob = await put(couverture.chemin, contenu, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: TYPE_IMAGE,
    cacheControlMaxAge: CACHE_UN_AN_SECONDES,
  });
  return blob.url;
}

async function enFile<T>(taches: (() => Promise<T>)[], concurrence: number) {
  const resultats: T[] = [];
  let index = 0;

  async function ouvrier() {
    while (index < taches.length) {
      const rang = index;
      index += 1;
      resultats[rang] = await taches[rang]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrence, taches.length) }, ouvrier));
  return resultats;
}

async function ecrireSorties(urls: Map<string, string>, annonces: Couverture[]) {
  let ecrites = 0;
  for (const couverture of annonces) {
    const url = urls.get(couverture.chemin);
    if (!url) continue;
    const edition = await prisma.edition.findUnique({
      where: { slug: couverture.slug },
      select: { id: true },
    });
    if (!edition) continue;
    const { count } = await prisma.sortie.updateMany({
      where: { editionId: edition.id, numero: couverture.numero },
      data: { couvertureUrl: url },
    });
    ecrites += count;
  }
  return ecrites;
}

async function ecrireEnBase(urls: Map<string, string>, couvertures: Couverture[]) {
  const parSlug = new Map<string, Couverture[]>();
  for (const couverture of couvertures) {
    if (!urls.has(couverture.chemin)) continue;
    const liste = parSlug.get(couverture.slug) ?? [];
    liste.push(couverture);
    parSlug.set(couverture.slug, liste);
  }

  const absents: string[] = [];
  let ecrits = 0;

  for (const [slug, liste] of parSlug) {
    const edition = await prisma.edition.findUnique({ where: { slug }, select: { id: true } });
    if (!edition) {
      absents.push(slug);
      continue;
    }
    for (const couverture of liste) {
      await prisma.volume.update({
        where: { editionId_numero: { editionId: edition.id, numero: couverture.numero } },
        data: { couvertureUrl: urls.get(couverture.chemin) },
      });
      ecrits += 1;
    }
  }

  return { ecrits, absents };
}

async function effacerEnBase(couvertures: Couverture[]) {
  const slugs = [...new Set(couvertures.map((couverture) => couverture.slug))];
  const editions = await prisma.edition.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  const { count } = await prisma.volume.updateMany({
    where: { editionId: { in: editions.map((edition) => edition.id) } },
    data: { couvertureUrl: null },
  });
  return count;
}

async function main() {
  const options = lireOptions(process.argv.slice(2));
  const couvertures = inventorier(charger(SOURCE));
  const annonces = inventorier(charger(SOURCE_ANNONCES));
  const toutes = [...couvertures, ...annonces];

  if (options.retourArriere) {
    const remisesANull = await effacerEnBase(couvertures);
    console.log(`${remisesANull} volumes remis a null, les blobs sont conserves`);
    return;
  }

  const forcees = [...options.slugsForces, ...options.ciblesForcees];
  if (forcees.length > 0) {
    console.log(`renvoi force : ${forcees.join(", ")}`);
  }

  const { existants, pages } = await listerBlobsExistants();
  console.log(`${existants.size} couvertures deja dans Blob`);

  const urls = new Map<string, string>();
  const echecs: string[] = [];
  const introuvables: string[] = [];

  const candidates = toutes.filter((couverture) => {
    const deja = existants.get(couverture.chemin);
    if (deja && !estForcee(couverture, options)) {
      urls.set(couverture.chemin, deja);
      return false;
    }
    return true;
  });

  const aEnvoyer = candidates.slice(0, options.plafond);
  const reportees = candidates.length - aEnvoyer.length;

  console.log(`${candidates.length} a envoyer sur ${toutes.length} du manifeste`);
  console.log(
    `cout de ce passage : ${pages + aEnvoyer.length} operations avancees ` +
      `(${pages} liste + ${aEnvoyer.length} envois) sur ${QUOTA_MENSUEL_AVANCEES} par mois`,
  );
  if (reportees > 0) {
    console.log(
      `${reportees} reportees par le plafond de ${options.plafond} : ` +
        `relancer pour la suite, ou ${PLAFOND} <n> pour relever le plafond`,
    );
  }

  await enFile(
    aEnvoyer.map((couverture) => async () => {
      try {
        urls.set(couverture.chemin, await envoyer(couverture));
      } catch (erreur) {
        const cause = erreur instanceof Error ? erreur.message : String(erreur);
        if (cause.includes("ENOENT")) {
          introuvables.push(couverture.chemin);
        } else {
          echecs.push(`${couverture.chemin} : ${cause}`);
        }
      }
    }),
    CONCURRENCE,
  );

  const { ecrits, absents } = await ecrireEnBase(urls, couvertures);
  const sortiesEcrites = await ecrireSorties(urls, annonces);
  const premiere = urls.values().next().value;
  if (premiere) {
    writeFileSync(MANIFESTE_BLOB, `${JSON.stringify({ base: new URL(premiere).origin }, null, 2)}\n`);
  }

  const avecCouverture = await prisma.volume.count({ where: { couvertureUrl: { not: null } } });
  const tomes = await prisma.volume.count();

  console.log(`${urls.size} couvertures dans Blob, ${ecrits} volumes mis a jour`);
  console.log(`${sortiesEcrites} tomes annonces pourvus d'une couverture`);
  console.log(`volumes avec couverture : ${avecCouverture} / ${tomes}`);
  if (introuvables.length > 0) {
    console.log(`absentes du disque : ${introuvables.length}`);
  }
  if (absents.length > 0) {
    console.log(`slugs absents en base : ${absents.join(", ")}`);
  }
  if (echecs.length > 0) {
    console.log(`echecs :\n${echecs.join("\n")}`);
  }
}

main().finally(() => prisma.$disconnect());
