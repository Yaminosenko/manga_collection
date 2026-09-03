import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { basePublique, deposer, listerObjets } from "../lib/r2";
import { enFile } from "../lib/queue";
import { prisma } from "../lib/prisma";

const MANIFESTE_STOCKAGE = join(process.cwd(), "data", "storage.json");
const PREFIXE = "covers/";
const CONCURRENCE = 8;
const ESSAI_A_BLANC = "--dry-run";
const PLAFOND = "--max";
const ENVOIS_MAX_PAR_DEFAUT = 2000;
const QUOTA_MENSUEL_CLASSE_A = 1_000_000;

type Origine = "volume" | "sortie";

type Image = {
  origine: Origine;
  id: string;
  chemin: string;
  urlActuelle: string;
};

function lirePlafond(argv: string[]): number {
  const rang = argv.indexOf(PLAFOND);
  if (rang === -1) return ENVOIS_MAX_PAR_DEFAUT;
  const valeur = Number(argv[rang + 1]);
  if (!Number.isInteger(valeur) || valeur <= 0) {
    throw new Error(`${PLAFOND} attend un entier positif`);
  }
  return valeur;
}

function cheminDepuisUrl(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

async function inventorier(): Promise<{ images: Image[]; illisibles: string[] }> {
  const volumes = await prisma.volume.findMany({
    where: { couvertureUrl: { not: null } },
    select: { id: true, couvertureUrl: true },
  });
  const sorties = await prisma.sortie.findMany({
    where: { couvertureUrl: { not: null } },
    select: { id: true, couvertureUrl: true },
  });

  const brutes: { origine: Origine; id: string; url: string }[] = [
    ...volumes.map((volume) => ({ origine: "volume" as const, id: volume.id, url: volume.couvertureUrl! })),
    ...sorties.map((sortie) => ({ origine: "sortie" as const, id: sortie.id, url: sortie.couvertureUrl! })),
  ];

  const images: Image[] = [];
  const illisibles: string[] = [];

  for (const brute of brutes) {
    const chemin = cheminDepuisUrl(brute.url);
    if (!chemin) {
      illisibles.push(brute.url);
      continue;
    }
    images.push({ origine: brute.origine, id: brute.id, chemin, urlActuelle: brute.url });
  }

  return { images, illisibles };
}

async function telecharger(url: string): Promise<Buffer> {
  const reponse = await fetch(url);
  if (!reponse.ok) {
    throw new Error(`HTTP ${reponse.status}`);
  }
  const contenu = Buffer.from(await reponse.arrayBuffer());
  if (contenu.byteLength === 0) {
    throw new Error("reponse vide");
  }
  return contenu;
}

async function reecrire(images: Image[], base: string): Promise<{ volumes: number; sorties: number }> {
  let volumes = 0;
  let sorties = 0;

  for (const image of images) {
    const url = `${base}/${image.chemin}`;
    if (image.origine === "volume") {
      await prisma.volume.update({ where: { id: image.id }, data: { couvertureUrl: url } });
      volumes += 1;
    } else {
      await prisma.sortie.update({ where: { id: image.id }, data: { couvertureUrl: url } });
      sorties += 1;
    }
  }

  return { volumes, sorties };
}

async function main() {
  const argv = process.argv.slice(2);
  const aBlanc = argv.includes(ESSAI_A_BLANC);
  const plafond = lirePlafond(argv);
  const base = basePublique();

  const { images, illisibles } = await inventorier();
  const dejaMigrees = images.filter((image) => image.urlActuelle.startsWith(`${base}/`));
  const aMigrer = images.filter((image) => !image.urlActuelle.startsWith(`${base}/`));

  console.log(`${images.length} images referencees en base`);
  console.log(`${dejaMigrees.length} deja sur ${base}, ${aMigrer.length} a migrer`);
  if (illisibles.length > 0) {
    console.log(`${illisibles.length} URL illisibles, ignorees : ${illisibles.slice(0, 3).join(", ")}`);
  }
  if (aMigrer.length === 0) {
    console.log("rien a faire");
    return;
  }

  const { chemins, pages } = await listerObjets(PREFIXE);
  console.log(`${chemins.size} objets deja dans le bucket (${pages} page(s) de liste)`);

  const cheminsUniques = [...new Set(aMigrer.map((image) => image.chemin))];
  const absents = cheminsUniques.filter((chemin) => !chemins.has(chemin));
  const aEnvoyer = absents.slice(0, plafond);
  const reportees = absents.length - aEnvoyer.length;

  console.log(`${cheminsUniques.length} objets distincts, ${absents.length} absents du bucket`);
  console.log(
    `cout de ce passage : ${pages + aEnvoyer.length} operations Class A ` +
      `(${pages} liste + ${aEnvoyer.length} envois) sur ${QUOTA_MENSUEL_CLASSE_A.toLocaleString("fr-FR")} par mois`,
  );
  if (reportees > 0) {
    console.log(`${reportees} reportees par le plafond de ${plafond} : relancer, ou ${PLAFOND} <n>`);
  }

  if (aBlanc) {
    console.log("\nessai a blanc : rien n'a ete telecharge, envoye ni ecrit en base");
    return;
  }

  const parChemin = new Map(aMigrer.map((image) => [image.chemin, image.urlActuelle]));
  const echecs: string[] = [];
  let envoyees = 0;

  await enFile(
    aEnvoyer.map((chemin) => async () => {
      try {
        await deposer(chemin, await telecharger(parChemin.get(chemin)!));
        chemins.add(chemin);
        envoyees += 1;
      } catch (erreur) {
        echecs.push(`${chemin} : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
      }
    }),
    CONCURRENCE,
  );

  console.log(`${envoyees} objets envoyes dans le bucket`);

  const migrables = aMigrer.filter((image) => chemins.has(image.chemin));
  const { volumes, sorties } = await reecrire(migrables, base);
  console.log(`${volumes} volumes et ${sorties} sorties reecrits vers ${base}`);

  writeFileSync(MANIFESTE_STOCKAGE, `${JSON.stringify({ base }, null, 2)}\n`);

  const horsBase = {
    AND: [{ couvertureUrl: { not: null } }, { NOT: { couvertureUrl: { startsWith: `${base}/` } } }],
  };
  const restants = await prisma.volume.count({ where: horsBase });
  const restantsSorties = await prisma.sortie.count({ where: horsBase });
  console.log(`restant hors ${base} : ${restants} volumes, ${restantsSorties} sorties`);

  if (echecs.length > 0) {
    console.log(`\n${echecs.length} echecs, URL laissees sur l'ancien store :\n${echecs.join("\n")}`);
  }
}

main().finally(() => prisma.$disconnect());
