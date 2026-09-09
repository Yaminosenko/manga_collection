import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "audit-editions.json");
const NOM_PAR_DEFAUT = "Édition simple";

type Candidat = {
  serieNormalise: string;
  marqueurEdition: string | null;
  nom: string;
  serieTitre: string;
  editeur: string | null;
  tomesParus: number;
  lignes: number;
  nosTomes: number;
};

type Divergence = {
  slug: string;
  titre: string;
  base: { nom: string; editeur: string | null; tomesParus: number; tomesAvecIsbn: number };
  candidat: Candidat | null;
  autresCandidats: Candidat[];
  ecarts: string[];
};

const ECART_NOM = "nom";
const ECART_EDITEUR = "editeur";
const ECART_TOMES = "tomesParus";
const ECART_MELANGE = "tomes repartis sur plusieurs editions du catalogue";
const ECART_SANS_ISBN = "aucun tome ne porte d'ISBN";
const ECART_HORS_CATALOGUE = "aucun ISBN retrouve au catalogue";

async function candidatsPourEan(eans: string[]): Promise<Candidat[]> {
  if (eans.length === 0) return [];

  const groupes = await prisma.$queryRaw<
    {
      serieNormalise: string;
      marqueurEdition: string | null;
      nosTomes: bigint;
    }[]
  >`
    SELECT "serieNormalise", "marqueurEdition", count(*)::bigint AS "nosTomes"
    FROM "ParutionCatalogue"
    WHERE "ean" = ANY(${eans})
    GROUP BY 1, 2
    ORDER BY 3 DESC`;

  const candidats: Candidat[] = [];
  for (const groupe of groupes) {
    const detail = await prisma.$queryRaw<
      {
        serieTitre: string;
        editeur: string | null;
        tomesParus: number | null;
        lignes: bigint;
      }[]
    >`
      SELECT
        (array_agg("serieTitre" ORDER BY "date" DESC))[1] AS "serieTitre",
        mode() WITHIN GROUP (ORDER BY "editeur") AS "editeur",
        max("numero") FILTER (WHERE "date" <= now())::int AS "tomesParus",
        count(*)::bigint AS "lignes"
      FROM "ParutionCatalogue"
      WHERE "serieNormalise" = ${groupe.serieNormalise}
        AND "marqueurEdition" IS NOT DISTINCT FROM ${groupe.marqueurEdition}`;

    const ligne = detail[0];
    if (!ligne) continue;

    candidats.push({
      serieNormalise: groupe.serieNormalise,
      marqueurEdition: groupe.marqueurEdition,
      nom: groupe.marqueurEdition ?? NOM_PAR_DEFAUT,
      serieTitre: ligne.serieTitre,
      editeur: ligne.editeur,
      tomesParus: ligne.tomesParus ?? 1,
      lignes: Number(ligne.lignes),
      nosTomes: Number(groupe.nosTomes),
    });
  }
  return candidats;
}

function memeEditeur(gauche: string | null, droite: string | null): boolean {
  if (gauche === null || droite === null) return true;
  const normaliser = (valeur: string) =>
    valeur
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const a = normaliser(gauche);
  const b = normaliser(droite);
  return a === b || a.includes(b) || b.includes(a);
}

async function main(): Promise<void> {
  const editions = await prisma.edition.findMany({
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      nom: true,
      editeur: true,
      tomesParus: true,
      serie: { select: { titre: true } },
      volumes: { select: { isbn: true } },
    },
  });

  const divergences: Divergence[] = [];
  let conformes = 0;

  for (const edition of editions) {
    const eans = edition.volumes
      .map((volume) => volume.isbn)
      .filter((isbn): isbn is string => isbn !== null);

    const candidats = await candidatsPourEan(eans);
    const principal = candidats[0] ?? null;
    const ecarts: string[] = [];

    if (eans.length === 0) {
      ecarts.push(ECART_SANS_ISBN);
    } else if (principal === null) {
      ecarts.push(ECART_HORS_CATALOGUE);
    } else {
      if (candidats.length > 1) ecarts.push(ECART_MELANGE);
      if (principal.nom !== edition.nom) ecarts.push(ECART_NOM);
      if (!memeEditeur(edition.editeur, principal.editeur)) ecarts.push(ECART_EDITEUR);
      if (principal.tomesParus !== edition.tomesParus) ecarts.push(ECART_TOMES);
    }

    if (ecarts.length === 0) {
      conformes += 1;
      continue;
    }

    divergences.push({
      slug: edition.slug,
      titre: edition.serie.titre,
      base: {
        nom: edition.nom,
        editeur: edition.editeur,
        tomesParus: edition.tomesParus,
        tomesAvecIsbn: eans.length,
      },
      candidat: principal,
      autresCandidats: candidats.slice(1),
      ecarts,
    });
  }

  const parEcart = new Map<string, number>();
  for (const divergence of divergences) {
    for (const ecart of divergence.ecarts) {
      parEcart.set(ecart, (parEcart.get(ecart) ?? 0) + 1);
    }
  }

  writeFileSync(
    MANIFESTE,
    `${JSON.stringify({ releveLe: new Date().toISOString(), editions: editions.length, conformes, divergences }, null, 2)}\n`,
  );

  console.log(`${editions.length} editions auditees, ${conformes} conformes au catalogue`);
  console.log(`${divergences.length} portent au moins un ecart :`);
  for (const [ecart, nombre] of [...parEcart.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(nombre).padStart(3)}  ${ecart}`);
  }

  const nomsFautifs = divergences.filter((d) => d.ecarts.includes(ECART_NOM));
  if (nomsFautifs.length > 0) {
    console.log(`\nnoms d'edition a revoir :`);
    for (const d of nomsFautifs) {
      console.log(
        `  ${d.slug.padEnd(38)} base="${d.base.nom}" catalogue="${d.candidat?.nom}" (${d.candidat?.nosTomes}/${d.base.tomesAvecIsbn} de nos ISBN)`,
      );
    }
  }

  const tomesFautifs = divergences.filter((d) => d.ecarts.includes(ECART_TOMES));
  if (tomesFautifs.length > 0) {
    console.log(`\ntomes parus a revoir :`);
    for (const d of tomesFautifs) {
      console.log(
        `  ${d.slug.padEnd(38)} base=${String(d.base.tomesParus).padStart(3)} catalogue=${String(d.candidat?.tomesParus).padStart(3)}  ${d.candidat?.nom}`,
      );
    }
  }

  console.log(`\nmanifeste ecrit dans ${MANIFESTE}`);
  console.log("lecture seule : rien n'a ete modifie");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
