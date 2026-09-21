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
  aParaitre: Record<string, Tome>;
};

type Manifeste = Record<string, Fiche>;
type TomeAvant = { isbn: string | null; dateSortie: string | null };
type EtatAvant = Record<string, { tomesParus: number; tomes?: Record<string, TomeAvant> }>;

function charger<T>(chemin: string, defaut: T): T {
  return existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf-8")) as T) : defaut;
}

function jour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fenetre(manifeste: Manifeste): { debut: Date; fin: Date } | null {
  const dates = Object.values(manifeste)
    .flatMap((fiche) => [...Object.values(fiche.tomes), ...Object.values(fiche.aParaitre ?? {})])
    .map((tome) => tome.date);
  if (dates.length === 0) return null;
  return {
    debut: new Date(dates.reduce((plusTot, date) => (date < plusTot ? date : plusTot))),
    fin: new Date(dates.reduce((plusTardive, date) => (date > plusTardive ? date : plusTardive))),
  };
}

async function restaurer() {
  const avant = charger<EtatAvant | null>(SAUVEGARDE, null);
  if (!avant) {
    console.log(`aucune sauvegarde dans ${SAUVEGARDE} : rien a restaurer`);
    return;
  }

  let supprimes = 0;
  let remis = 0;
  const sansDetail: string[] = [];

  for (const [slug, etat] of Object.entries(avant)) {
    const edition = await prisma.edition.findUnique({ where: { slug }, select: { id: true } });
    if (!edition) continue;
    const { count } = await prisma.volume.deleteMany({
      where: { editionId: edition.id, numero: { gt: etat.tomesParus } },
    });
    if (etat.tomes) {
      for (const [brut, tome] of Object.entries(etat.tomes)) {
        await prisma.volume.updateMany({
          where: { editionId: edition.id, numero: Number(brut) },
          data: {
            isbn: tome.isbn,
            dateSortie: tome.dateSortie === null ? null : new Date(tome.dateSortie),
          },
        });
        remis += 1;
      }
    } else {
      sansDetail.push(slug);
    }
    await prisma.sortie.deleteMany({ where: { editionId: edition.id } });
    await prisma.edition.update({ where: { slug }, data: { tomesParus: etat.tomesParus } });
    supprimes += count;
  }

  console.log(
    `${Object.keys(avant).length} editions restaurees, ${supprimes} tomes supprimes, ${remis} tomes remis a leur ISBN et date d'avant`,
  );
  if (sansDetail.length > 0) {
    console.log(
      `${sansDetail.length} editions sauvegardees avant que l'etat par tome soit memorise : leurs ISBN et dates sont laisses tels quels`,
    );
    for (const slug of sansDetail) console.log(`  ${slug}`);
  }
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
    select: {
      id: true,
      slug: true,
      tomesParus: true,
      volumes: { select: { numero: true, isbn: true, dateSortie: true } },
      sorties: {
        select: {
          id: true,
          numero: true,
          date: true,
          isbn: true,
          couvertureUrl: true,
          sourceCouverture: true,
          couvertureRecupereeLe: true,
        },
      },
    },
  });

  const avant = charger<EtatAvant>(SAUVEGARDE, {});
  const ajoutees = editions.filter((edition) => !(edition.slug in avant));
  for (const edition of ajoutees) {
    const tomes: Record<string, TomeAvant> = {};
    for (const volume of edition.volumes) {
      tomes[String(volume.numero)] = {
        isbn: volume.isbn,
        dateSortie: volume.dateSortie === null ? null : volume.dateSortie.toISOString(),
      };
    }
    avant[edition.slug] = { tomesParus: edition.tomesParus, tomes };
  }
  if (ajoutees.length > 0) {
    writeFileSync(SAUVEGARDE, `${JSON.stringify(avant, null, 2)}\n`);
  }
  console.log(
    `sauvegarde : ${ajoutees.length} editions ajoutees, ${Object.keys(avant).length} au total dans ${SAUVEGARDE}`,
  );

  let tomesCrees = 0;
  let isbnEcrits = 0;
  let datesEcrites = 0;
  let sortiesCreees = 0;
  let sortiesInchangees = 0;
  let couverturesReprises = 0;
  const elargies: string[] = [];
  const ajustees: string[] = [];
  const retirees: string[] = [];

  const couverte = fenetre(manifeste);
  const horsFenetre = couverte
    ? await prisma.sortie.count({
        where: {
          editionId: { in: editions.map((edition) => edition.id) },
          OR: [{ date: { gt: couverte.fin } }, { date: { lt: couverte.debut } }],
        },
      })
    : 0;

  for (const edition of editions) {
    const fiche = manifeste[edition.slug];
    const cible = Math.max(edition.tomesParus, fiche.maximum ?? 0);

    if (cible > edition.tomesParus) {
      for (let numero = edition.tomesParus + 1; numero <= cible; numero += 1) {
        await prisma.volume.create({ data: { editionId: edition.id, numero } });
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

    const annoncees = new Map<number, Tome>();
    for (const [brut, annonce] of Object.entries(fiche.aParaitre ?? {})) {
      annoncees.set(Number(brut), annonce);
    }

    for (const [numero, annonce] of annoncees) {
      const existante = edition.sorties.find((sortie) => sortie.numero === numero);
      const date = new Date(annonce.date);

      if (!existante) {
        await prisma.sortie.create({
          data: { editionId: edition.id, numero, date, isbn: annonce.isbn },
        });
        sortiesCreees += 1;
        continue;
      }

      const dateChangee = existante.date.getTime() !== date.getTime();
      const isbnChange = annonce.isbn !== null && annonce.isbn !== existante.isbn;
      if (!dateChangee && !isbnChange) {
        sortiesInchangees += 1;
        continue;
      }

      await prisma.sortie.update({
        where: { id: existante.id },
        data: {
          date: dateChangee ? date : undefined,
          isbn: isbnChange ? annonce.isbn : undefined,
        },
      });

      const changements: string[] = [];
      if (dateChangee) changements.push(`${jour(existante.date)} -> ${annonce.date}`);
      if (isbnChange) changements.push(`ISBN ${existante.isbn ?? "absent"} -> ${annonce.isbn}`);
      const couverture = existante.couvertureUrl ? ", couverture conservee" : "";
      ajustees.push(`${edition.slug} t${numero} : ${changements.join(", ")}${couverture}`);
    }

    for (const sortie of edition.sorties) {
      if (annoncees.has(sortie.numero)) continue;
      const dansLaFenetre =
        couverte !== null &&
        sortie.date.getTime() >= couverte.debut.getTime() &&
        sortie.date.getTime() <= couverte.fin.getTime();
      if (!dansLaFenetre) continue;

      let reprise = false;
      if (sortie.couvertureUrl !== null) {
        const { count } = await prisma.volume.updateMany({
          where: { editionId: edition.id, numero: sortie.numero, couvertureUrl: null },
          data: {
            couvertureUrl: sortie.couvertureUrl,
            sourceCouverture: sortie.sourceCouverture,
            couvertureRecupereeLe: sortie.couvertureRecupereeLe,
          },
        });
        reprise = count > 0;
        if (reprise) couverturesReprises += 1;
      }

      await prisma.sortie.delete({ where: { id: sortie.id } });
      const image = reprise ? ", couverture reprise sur le tome" : "";
      retirees.push(`${edition.slug} t${sortie.numero} du ${jour(sortie.date)}${image}`);
    }
  }

  const compteurs = {
    tomes: await prisma.volume.count(),
    possedes: await prisma.possession.count({ where: { possede: true } }),
    avecIsbn: await prisma.volume.count({ where: { isbn: { not: null } } }),
    avecDate: await prisma.volume.count({ where: { dateSortie: { not: null } } }),
    sorties: await prisma.sortie.count(),
  };

  console.log(`${elargies.length} editions elargies, ${tomesCrees} tomes crees`);
  for (const ligne of elargies) console.log(`  ${ligne}`);
  console.log(`${isbnEcrits} ISBN et ${datesEcrites} dates de sortie ecrits`);
  console.log(
    `sorties : ${sortiesCreees} creees, ${ajustees.length} ajustees, ` +
      `${sortiesInchangees} inchangees, ${retirees.length} retirees, ` +
      `${couverturesReprises} couvertures reprises sur le tome promu`,
  );
  for (const ligne of ajustees) console.log(`  ${ligne}`);
  for (const ligne of retirees) console.log(`  ${ligne}`);
  if (couverte) {
    console.log(
      `fenetre couverte du ${jour(couverte.debut)} au ${jour(couverte.fin)} : ${horsFenetre} sorties hors fenetre conservees`,
    );
  }
  console.log(`compteurs : ${JSON.stringify(compteurs)}`);
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
