import "dotenv/config";
import { prisma } from "../lib/prisma";
import { deposer } from "../lib/r2";
import { enFile } from "../lib/queue";

const SERVICE_COUVERTURES = "https://openapi.bnf.fr/couverture/image/image/recupererImage";
const PREMIERE_DE_COUVERTURE = 1;
const LARGEUR = 256;
const HAUTEUR = 360;
const SOURCE = "bnf";
const PREFIXE_OBJETS = "vignettes";
const REQUETES_PAR_SECONDE = 3;
const CONCURRENCE = 3;
const DELAI_MS = 20_000;
const PLAFOND_PAR_DEFAUT = 200;
const HAUTEUR_MINIMALE = 60;
const TYPES_ACCEPTES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

const OPTION_PLAFOND = "--max";
const OPTION_ESSAI = "--dry-run";
const OPTION_TOUT = "--tout";

type Cible = { ean: string; titre: string; numero: number | null };

function lireOptions(argv: string[]): { plafond: number; essai: boolean } {
  const essai = argv.includes(OPTION_ESSAI);
  const rang = argv.indexOf(OPTION_PLAFOND);
  if (argv.includes(OPTION_TOUT)) {
    return { plafond: Number.POSITIVE_INFINITY, essai };
  }
  const demande = rang === -1 ? null : Number(argv[rang + 1]);
  return {
    plafond: demande !== null && Number.isFinite(demande) && demande > 0 ? demande : PLAFOND_PAR_DEFAUT,
    essai,
  };
}

async function cibles(): Promise<Cible[]> {
  return prisma.$queryRaw<Cible[]>`
    WITH groupes AS (
      SELECT "serieNormalise", lower("marqueurEdition") AS marqueur,
             count(*)::int AS lignes, max("date") AS derniere
      FROM "ParutionCatalogue"
      WHERE "ean" IS NOT NULL
      GROUP BY 1, 2
    ),
    premiers AS (
      SELECT DISTINCT ON ("serieNormalise", lower("marqueurEdition"))
             "ean", "serieTitre", "numero",
             "serieNormalise", lower("marqueurEdition") AS marqueur
      FROM "ParutionCatalogue"
      WHERE "ean" IS NOT NULL
      ORDER BY "serieNormalise", lower("marqueurEdition"), "numero" ASC NULLS LAST, "date" ASC
    )
    SELECT p."ean", p."serieTitre" AS "titre", p."numero"
    FROM premiers p
    JOIN groupes g
      ON g."serieNormalise" = p."serieNormalise"
     AND g.marqueur IS NOT DISTINCT FROM p.marqueur
    LEFT JOIN "VignetteCatalogue" v ON v."ean" = p."ean"
    WHERE v."ean" IS NULL
    ORDER BY g.lignes DESC, g.derniere DESC`;
}

let dernierDepart = 0;

async function dormir(millisecondes: number) {
  await new Promise((suite) => setTimeout(suite, millisecondes));
}

async function patienter() {
  const minimum = 1000 / REQUETES_PAR_SECONDE;
  const attendu = Math.max(dernierDepart + minimum, Date.now());
  dernierDepart = attendu;
  const ecart = attendu - Date.now();
  if (ecart > 0) {
    await dormir(ecart);
  }
}

type Image = { octets: Buffer; type: string; extension: string };

async function telecharger(ean: string): Promise<Image | null> {
  await patienter();
  try {
    const reponse = await fetch(
      `${SERVICE_COUVERTURES}?EAN=${ean}&couverture=${PREMIERE_DE_COUVERTURE}` +
        `&taille=originale&largeur=${LARGEUR}&hauteur=${HAUTEUR}`,
      { signal: AbortSignal.timeout(DELAI_MS), redirect: "follow" },
    );
    if (!reponse.ok) {
      return null;
    }
    const type = (reponse.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    const extension = TYPES_ACCEPTES[type];
    if (!extension) {
      return null;
    }
    return { octets: Buffer.from(await reponse.arrayBuffer()), type, extension };
  } catch {
    return null;
  }
}

function dimensions(octets: Buffer): { largeur: number; hauteur: number } | null {
  if (octets.length > 24 && octets.readUInt32BE(0) === 0x89504e47) {
    return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
  }
  let position = 2;
  while (position + 9 < octets.length) {
    if (octets[position] !== 0xff) {
      position += 1;
      continue;
    }
    const marqueur = octets[position + 1] ?? 0;
    if (marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc) {
      return { largeur: octets.readUInt16BE(position + 7), hauteur: octets.readUInt16BE(position + 5) };
    }
    position += 2 + octets.readUInt16BE(position + 2);
  }
  return null;
}

async function main() {
  const options = lireOptions(process.argv.slice(2));
  const attente = await cibles();
  const aTraiter = attente.slice(0, options.plafond === Number.POSITIVE_INFINITY ? attente.length : options.plafond);

  const deja = await prisma.vignetteCatalogue.count();
  const dejaTrouvees = await prisma.vignetteCatalogue.count({
    where: { couvertureUrl: { not: null } },
  });

  console.log(`VignetteCatalogue : ${deja} EAN deja interroges, ${dejaTrouvees} avec une image`);
  console.log(`${attente.length} EAN restants, ${aTraiter.length} traites ce passage`);
  console.log(
    `cadence ${REQUETES_PAR_SECONDE}/s : environ ${Math.ceil(aTraiter.length / REQUETES_PAR_SECONDE / 60)} min`,
  );

  if (options.essai) {
    console.log(`\n${OPTION_ESSAI} : rien n'est telecharge. Vingt premieres cibles :`);
    for (const cible of aTraiter.slice(0, 20)) {
      console.log(`  ${cible.ean}  t.${cible.numero ?? "-"}  ${cible.titre.slice(0, 50)}`);
    }
    return;
  }

  let trouvees = 0;
  let absentes = 0;
  let refusees = 0;
  let poids = 0;
  let rang = 0;

  await enFile(
    aTraiter.map((cible) => async () => {
      const image = await telecharger(cible.ean);
      rang += 1;

      if (!image) {
        absentes += 1;
        await prisma.vignetteCatalogue.upsert({
          where: { ean: cible.ean },
          create: { ean: cible.ean, couvertureUrl: null, source: SOURCE },
          update: { couvertureUrl: null, source: SOURCE, recupereeLe: new Date() },
        });
        return;
      }

      const cote = dimensions(image.octets);
      if (cote !== null && cote.hauteur < HAUTEUR_MINIMALE) {
        refusees += 1;
        await prisma.vignetteCatalogue.upsert({
          where: { ean: cible.ean },
          create: { ean: cible.ean, couvertureUrl: null, source: SOURCE },
          update: { couvertureUrl: null, source: SOURCE, recupereeLe: new Date() },
        });
        return;
      }

      const url = await deposer(
        `${PREFIXE_OBJETS}/${cible.ean}.${image.extension}`,
        image.octets,
        image.type,
      );
      trouvees += 1;
      poids += image.octets.length;

      await prisma.vignetteCatalogue.upsert({
        where: { ean: cible.ean },
        create: {
          ean: cible.ean,
          couvertureUrl: url,
          source: SOURCE,
          largeur: cote?.largeur ?? null,
          hauteur: cote?.hauteur ?? null,
        },
        update: {
          couvertureUrl: url,
          source: SOURCE,
          largeur: cote?.largeur ?? null,
          hauteur: cote?.hauteur ?? null,
          recupereeLe: new Date(),
        },
      });

      if (rang % 50 === 0) {
        console.log(`  ${rang}/${aTraiter.length} — ${trouvees} images, ${absentes} absentes`);
      }
    }),
    CONCURRENCE,
  );

  const total = await prisma.vignetteCatalogue.count();
  const avecImage = await prisma.vignetteCatalogue.count({ where: { couvertureUrl: { not: null } } });
  const reste = attente.length - aTraiter.length;

  console.log();
  console.log(`Traites ce passage    : ${aTraiter.length}`);
  console.log(`Images obtenues       : ${trouvees}${refusees > 0 ? ` (${refusees} trop petites, ecartees)` : ""}`);
  console.log(`Sans notice illustree : ${absentes}`);
  if (trouvees > 0) {
    console.log(`Poids moyen           : ${(poids / trouvees / 1024).toFixed(1)} Ko`);
  }
  console.log(`VignetteCatalogue     : ${total} EAN, ${avecImage} avec une image (${Math.round((avecImage / total) * 100)} %)`);
  if (reste > 0) {
    console.log(`Restent ${reste} EAN : relancer, ou ${OPTION_TOUT} pour tout enchainer`);
  }
}

main().finally(() => prisma.$disconnect());
