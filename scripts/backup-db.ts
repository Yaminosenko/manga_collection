import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { prisma as prismaNeon } from "../lib/prisma";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { StatutEdition, TypeLienSerie } from "../lib/generated/prisma/enums";

const urlLocale = process.env["LOCAL_DATABASE_URL"];

const prisma = urlLocale
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: urlLocale }) })
  : prismaNeon;

const SAUVEGARDE = join(process.cwd(), "data", "backup.json");
const RESTAURATION = "--restore";
const ECRASEMENT = "--reset";
const LOT_ECRITURE = 500;

type PossessionSauvee = {
  id: string;
  possede: boolean;
  dateAchat: string | null;
  prixPayeCentimes: number | null;
  etat: string | null;
  lu: boolean;
  note: number | null;
};

type VolumeSauve = {
  id: string;
  numero: number;
  isbn: string | null;
  dateSortie: string | null;
  prixCentimes: number | null;
  couvertureUrl: string | null;
  possession: PossessionSauvee | null;
};

type SortieSauvee = {
  id: string;
  numero: number;
  date: string;
  isbn: string | null;
  couvertureUrl: string | null;
};

type EditionSauvee = {
  id: string;
  slug: string;
  nom: string;
  editeur: string | null;
  tomesParus: number;
  editionTerminee: boolean | null;
  prixDefautCentimes: number | null;
  statut: StatutEdition;
  termineeForcee: boolean;
  raisonCompletion: string | null;
  aVerifier: boolean;
  slugMangaNews: string | null;
  couvertureUrl: string | null;
  ajouteeLe: string;
  volumes: VolumeSauve[];
  sorties: SortieSauvee[];
};

type SerieSauvee = {
  id: string;
  slug: string;
  titre: string;
  titreVo: string | null;
  auteur: string;
  genres: string[];
  themes: string[];
  cible: string | null;
  couvertureUrl: string | null;
  editions: EditionSauvee[];
};

type Compteurs = {
  series: number;
  editions: number;
  tomes: number;
  possedes: number;
  aVerifier: number;
  forcees: number;
  couvertures: number;
  liens: number;
};

type LienSauve = {
  id: string;
  serieId: string;
  serieLieeId: string;
  type: TypeLienSerie;
};

type Sauvegarde = {
  exporteeLe: string;
  compteurs: Compteurs;
  series: SerieSauvee[];
  liens: LienSauve[];
};

function enISO(valeur: Date | null): string | null {
  return valeur === null ? null : valeur.toISOString();
}

function enDate(valeur: string | null): Date | null {
  return valeur === null ? null : new Date(valeur);
}

async function compter(): Promise<Compteurs> {
  return {
    series: await prisma.serie.count(),
    editions: await prisma.edition.count(),
    tomes: await prisma.volume.count(),
    possedes: await prisma.possession.count({ where: { possede: true } }),
    aVerifier: await prisma.edition.count({ where: { aVerifier: true } }),
    forcees: await prisma.edition.count({ where: { termineeForcee: true } }),
    couvertures: await prisma.volume.count({ where: { couvertureUrl: { not: null } } }),
    liens: await prisma.lienSerie.count(),
  };
}

async function exporter() {
  const series = await prisma.serie.findMany({
    orderBy: { slug: "asc" },
    include: {
      editions: {
        orderBy: { slug: "asc" },
        include: {
          volumes: { orderBy: { numero: "asc" }, include: { possession: true } },
          sorties: { orderBy: { numero: "asc" } },
        },
      },
    },
  });

  const liens = await prisma.lienSerie.findMany({
    orderBy: [{ serieId: "asc" }, { serieLieeId: "asc" }],
  });

  const sauvegarde: Sauvegarde = {
    exporteeLe: new Date().toISOString(),
    compteurs: await compter(),
    liens,
    series: series.map((serie) => ({
      id: serie.id,
      slug: serie.slug,
      titre: serie.titre,
      titreVo: serie.titreVo,
      auteur: serie.auteur,
      genres: serie.genres,
      themes: serie.themes,
      cible: serie.cible,
      couvertureUrl: serie.couvertureUrl,
      editions: serie.editions.map((edition) => ({
        id: edition.id,
        slug: edition.slug,
        nom: edition.nom,
        editeur: edition.editeur,
        tomesParus: edition.tomesParus,
        editionTerminee: edition.editionTerminee,
        prixDefautCentimes: edition.prixDefautCentimes,
        statut: edition.statut,
        termineeForcee: edition.termineeForcee,
        raisonCompletion: edition.raisonCompletion,
        aVerifier: edition.aVerifier,
        slugMangaNews: edition.slugMangaNews,
        couvertureUrl: edition.couvertureUrl,
        ajouteeLe: edition.ajouteeLe.toISOString(),
        sorties: edition.sorties.map((sortie) => ({
          id: sortie.id,
          numero: sortie.numero,
          date: sortie.date.toISOString(),
          isbn: sortie.isbn,
          couvertureUrl: sortie.couvertureUrl,
        })),
        volumes: edition.volumes.map((volume) => ({
          id: volume.id,
          numero: volume.numero,
          isbn: volume.isbn,
          dateSortie: enISO(volume.dateSortie),
          prixCentimes: volume.prixCentimes,
          couvertureUrl: volume.couvertureUrl,
          possession: volume.possession
            ? {
                id: volume.possession.id,
                possede: volume.possession.possede,
                dateAchat: enISO(volume.possession.dateAchat),
                prixPayeCentimes: volume.possession.prixPayeCentimes,
                etat: volume.possession.etat,
                lu: volume.possession.lu,
                note: volume.possession.note,
              }
            : null,
        })),
      })),
    })),
  };

  writeFileSync(SAUVEGARDE, `${JSON.stringify(sauvegarde, null, 2)}\n`);

  const { compteurs } = sauvegarde;
  console.log(`sauvegarde ecrite dans ${SAUVEGARDE}`);
  console.log(
    `${compteurs.series} series · ${compteurs.editions} editions · ${compteurs.tomes} tomes · ` +
      `${compteurs.possedes} possedes · ${compteurs.aVerifier} a verifier · ` +
      `${compteurs.forcees} forcees · ${compteurs.couvertures} couvertures`,
  );
}

async function ecrireParLots<T>(nom: string, lignes: T[], ecrire: (lot: T[]) => Promise<unknown>) {
  for (let debut = 0; debut < lignes.length; debut += LOT_ECRITURE) {
    await ecrire(lignes.slice(debut, debut + LOT_ECRITURE));
  }
  console.log(`  ${lignes.length} ${nom}`);
}

async function restaurer() {
  if (!existsSync(SAUVEGARDE)) {
    throw new Error(`${SAUVEGARDE} est absent : rien a restaurer`);
  }

  const sauvegarde = JSON.parse(readFileSync(SAUVEGARDE, "utf-8")) as Sauvegarde;
  const existantes = await prisma.edition.count();

  if (existantes > 0 && !process.argv.includes(ECRASEMENT)) {
    throw new Error(
      `La base contient ${existantes} editions. Relancer avec ${RESTAURATION} ${ECRASEMENT} pour tout remplacer.`,
    );
  }

  console.log(`sauvegarde du ${sauvegarde.exporteeLe}`);
  console.log(`attendu : ${JSON.stringify(sauvegarde.compteurs)}`);

  if (existantes > 0) {
    await prisma.serie.deleteMany();
  }

  const series = sauvegarde.series.map((serie) => ({
    id: serie.id,
    slug: serie.slug,
    titre: serie.titre,
    titreVo: serie.titreVo,
    auteur: serie.auteur,
    genres: serie.genres,
    themes: serie.themes,
    cible: serie.cible,
    couvertureUrl: serie.couvertureUrl,
  }));

  const editions = sauvegarde.series.flatMap((serie) =>
    serie.editions.map((edition) => ({
      id: edition.id,
      serieId: serie.id,
      slug: edition.slug,
      nom: edition.nom,
      editeur: edition.editeur,
      tomesParus: edition.tomesParus,
      editionTerminee: edition.editionTerminee,
      prixDefautCentimes: edition.prixDefautCentimes,
      statut: edition.statut,
      termineeForcee: edition.termineeForcee,
      raisonCompletion: edition.raisonCompletion,
      aVerifier: edition.aVerifier,
      slugMangaNews: edition.slugMangaNews,
      couvertureUrl: edition.couvertureUrl,
      ajouteeLe: new Date(edition.ajouteeLe),
    })),
  );

  const volumes = sauvegarde.series.flatMap((serie) =>
    serie.editions.flatMap((edition) =>
      edition.volumes.map((volume) => ({
        id: volume.id,
        editionId: edition.id,
        numero: volume.numero,
        isbn: volume.isbn,
        dateSortie: enDate(volume.dateSortie),
        prixCentimes: volume.prixCentimes,
        couvertureUrl: volume.couvertureUrl,
      })),
    ),
  );

  const sorties = sauvegarde.series.flatMap((serie) =>
    serie.editions.flatMap((edition) =>
      (edition.sorties ?? []).map((sortie) => ({
        id: sortie.id,
        editionId: edition.id,
        numero: sortie.numero,
        date: new Date(sortie.date),
        isbn: sortie.isbn,
        couvertureUrl: sortie.couvertureUrl,
      })),
    ),
  );

  const possessions = sauvegarde.series.flatMap((serie) =>
    serie.editions.flatMap((edition) =>
      edition.volumes.flatMap((volume) =>
        volume.possession
          ? [
              {
                id: volume.possession.id,
                volumeId: volume.id,
                possede: volume.possession.possede,
                dateAchat: enDate(volume.possession.dateAchat),
                prixPayeCentimes: volume.possession.prixPayeCentimes,
                etat: volume.possession.etat,
                lu: volume.possession.lu,
                note: volume.possession.note,
              },
            ]
          : [],
      ),
    ),
  );

  await ecrireParLots("series", series, (lot) => prisma.serie.createMany({ data: lot }));
  await ecrireParLots("editions", editions, (lot) => prisma.edition.createMany({ data: lot }));
  await ecrireParLots("tomes", volumes, (lot) => prisma.volume.createMany({ data: lot }));
  await ecrireParLots("possessions", possessions, (lot) =>
    prisma.possession.createMany({ data: lot }),
  );
  await ecrireParLots("sorties annoncees", sorties, (lot) =>
    prisma.sortie.createMany({ data: lot }),
  );
  await ecrireParLots("liens de series", sauvegarde.liens ?? [], (lot) =>
    prisma.lienSerie.createMany({ data: lot }),
  );

  const obtenus = await compter();
  console.log(`obtenu  : ${JSON.stringify(obtenus)}`);

  const ecarts = Object.entries(obtenus).filter(
    ([cle, valeur]) => sauvegarde.compteurs[cle as keyof Compteurs] !== valeur,
  );
  if (ecarts.length > 0) {
    throw new Error(`compteurs divergents : ${ecarts.map(([cle]) => cle).join(", ")}`);
  }
  console.log("les compteurs correspondent");
}

async function main() {
  if (urlLocale) {
    console.log("cible : Postgres local (LOCAL_DATABASE_URL)");
  }
  if (process.argv.includes(RESTAURATION)) {
    await restaurer();
    return;
  }
  await exporter();
}

main().finally(() => prisma.$disconnect());
