import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { list, put } from "@vercel/blob";
import { prisma } from "../lib/prisma";

const SOURCE = join(process.cwd(), "data", "covers.json");
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

type Manifeste = Record<string, number[]>;

type Couverture = {
  slug: string;
  numero: number;
  chemin: string;
  cheminLocal: string;
};

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

async function listerBlobsExistants(): Promise<Map<string, string>> {
  const existants = new Map<string, string>();
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: `${PREFIXE_BLOB}/`, limit: PAGE_LISTE, cursor });
    for (const blob of page.blobs) {
      existants.set(blob.pathname, blob.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return existants;
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
  const manifeste = JSON.parse(readFileSync(SOURCE, "utf-8")) as Manifeste;
  const couvertures = inventorier(manifeste);

  if (process.argv.includes(RETOUR_ARRIERE)) {
    const remisesANull = await effacerEnBase(couvertures);
    console.log(`${remisesANull} volumes remis a null, les blobs sont conserves`);
    return;
  }

  const forces = new Set(
    process.argv.slice(process.argv.indexOf(FORCER) + 1).filter((valeur) => !valeur.startsWith("--")),
  );
  if (process.argv.includes(FORCER)) {
    console.log(`renvoi force : ${[...forces].join(", ") || "(aucun slug donne)"}`);
  }

  const existants = await listerBlobsExistants();
  console.log(`${existants.size} couvertures deja dans Blob`);

  const urls = new Map<string, string>();
  const echecs: string[] = [];
  const introuvables: string[] = [];

  const aEnvoyer = couvertures.filter((couverture) => {
    const deja = existants.get(couverture.chemin);
    if (deja && !forces.has(couverture.slug)) {
      urls.set(couverture.chemin, deja);
      return false;
    }
    return true;
  });

  console.log(`${aEnvoyer.length} a envoyer sur ${couvertures.length} du manifeste`);

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
  const premiere = urls.values().next().value;
  if (premiere) {
    writeFileSync(MANIFESTE_BLOB, `${JSON.stringify({ base: new URL(premiere).origin }, null, 2)}\n`);
  }

  const avecCouverture = await prisma.volume.count({ where: { couvertureUrl: { not: null } } });
  const tomes = await prisma.volume.count();

  console.log(`${urls.size} couvertures dans Blob, ${ecrits} volumes mis a jour`);
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
