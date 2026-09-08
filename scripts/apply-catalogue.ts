import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const MANIFESTE = join(process.cwd(), "data", "catalogue.json");
const ESSAI = "--dry-run";
const RECALCUL = "--recalculer";
const TAILLE_LOT = 1000;

type Parution = {
  ean: string | null;
  titreBrut: string;
  serieTitre: string;
  serieNormalise: string;
  marqueurEdition: string | null;
  numero: number | null;
  editeur: string | null;
  date: string;
};

type Manifeste = { parutions: Parution[] };

function enLots<T>(elements: T[], taille: number): T[][] {
  const lots: T[][] = [];
  for (let debut = 0; debut < elements.length; debut += taille) {
    lots.push(elements.slice(debut, debut + taille));
  }
  return lots;
}

function enLigne(parution: Parution) {
  return {
    ean: parution.ean,
    titreBrut: parution.titreBrut,
    serieTitre: parution.serieTitre,
    serieNormalise: parution.serieNormalise,
    marqueurEdition: parution.marqueurEdition,
    numero: parution.numero,
    editeur: parution.editeur,
    date: new Date(parution.date),
  };
}

async function recalculer(parutions: Parution[]) {
  let modifiees = 0;
  for (const parution of parutions) {
    const resultat = await prisma.parutionCatalogue.updateMany({
      where: { titreBrut: parution.titreBrut, date: new Date(parution.date) },
      data: {
        serieTitre: parution.serieTitre,
        serieNormalise: parution.serieNormalise,
        marqueurEdition: parution.marqueurEdition,
        numero: parution.numero,
      },
    });
    modifiees += resultat.count;
  }
  console.log(`${modifiees} parutions recalculees depuis titreBrut`);
}

async function main() {
  if (!existsSync(MANIFESTE)) {
    console.log(`${MANIFESTE} est absent : lancer catalogue:import d'abord`);
    return;
  }

  const { parutions } = JSON.parse(readFileSync(MANIFESTE, "utf-8")) as Manifeste;
  if (parutions.length === 0) {
    console.log(`aucune parution dans ${MANIFESTE}`);
    return;
  }

  const avant = await prisma.parutionCatalogue.count();
  const dates = parutions.map((parution) => parution.date).sort();
  console.log(
    `manifeste : ${parutions.length} parutions, ${dates[0]} -> ${dates[dates.length - 1]}`,
  );
  console.log(`table : ${avant} parutions avant ecriture`);

  if (process.argv.includes(RECALCUL)) {
    await recalculer(parutions);
    return;
  }

  if (process.argv.includes(ESSAI)) {
    const echantillon = parutions.slice(0, 3).map((parution) => parution.titreBrut);
    console.log(`essai : rien n'est ecrit. Premieres lignes : ${echantillon.join(" · ")}`);
    return;
  }

  const lots = enLots(parutions, TAILLE_LOT);
  let inserees = 0;
  for (const [rang, lot] of lots.entries()) {
    const resultat = await prisma.parutionCatalogue.createMany({
      data: lot.map(enLigne),
      skipDuplicates: true,
    });
    inserees += resultat.count;
    console.log(`  lot ${rang + 1}/${lots.length} : ${resultat.count} inserees`);
  }

  const apres = await prisma.parutionCatalogue.count();
  const avecEan = await prisma.parutionCatalogue.count({ where: { ean: { not: null } } });
  const avecMarqueur = await prisma.parutionCatalogue.count({
    where: { marqueurEdition: { not: null } },
  });
  const series = await prisma.parutionCatalogue.groupBy({ by: ["serieNormalise"] });

  console.log(
    `${inserees} inserees, ${parutions.length - inserees} deja presentes ` +
      `(la cle (titreBrut, date) rend l'import rejouable)`,
  );
  console.log(`table : ${apres} parutions, ${series.length} series distinctes`);
  console.log(`${avecEan} avec EAN, ${avecMarqueur} avec marqueur d'edition`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erreur) => {
    console.error(erreur);
    await prisma.$disconnect();
    process.exit(1);
  });
