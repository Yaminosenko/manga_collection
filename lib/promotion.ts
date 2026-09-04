import { prisma } from "@/lib/prisma";
import { debutDuMois } from "@/lib/domain";

export type SortiePromue = {
  slug: string;
  numero: number;
  tomesParus: number;
};

const SORTIE_COMPLETE = {
  id: true,
  numero: true,
  date: true,
  isbn: true,
  couvertureUrl: true,
  editionId: true,
  edition: { select: { slug: true } },
} as const;

type SortieChargee = {
  id: string;
  numero: number;
  date: Date;
  isbn: string | null;
  couvertureUrl: string | null;
  editionId: string;
  edition: { slug: string };
};

async function promouvoir(sortie: SortieChargee, possede: boolean): Promise<SortiePromue> {
  return prisma.$transaction(async (tx) => {
    const edition = await tx.edition.findUniqueOrThrow({
      where: { id: sortie.editionId },
      select: { tomesParus: true },
    });
    const cible = Math.max(edition.tomesParus, sortie.numero);

    for (let numero = edition.tomesParus + 1; numero <= sortie.numero; numero += 1) {
      await tx.volume.upsert({
        where: { editionId_numero: { editionId: sortie.editionId, numero } },
        create: {
          editionId: sortie.editionId,
          numero,
          possession: { create: { possede: false } },
        },
        update: {},
      });
    }

    const volume = await tx.volume.update({
      where: { editionId_numero: { editionId: sortie.editionId, numero: sortie.numero } },
      data: {
        isbn: sortie.isbn ?? undefined,
        dateSortie: sortie.date,
        couvertureUrl: sortie.couvertureUrl ?? undefined,
      },
      select: { id: true },
    });

    await tx.possession.upsert({
      where: { volumeId: volume.id },
      create: { volumeId: volume.id, possede },
      update: { possede },
    });

    if (cible > edition.tomesParus) {
      await tx.edition.update({ where: { id: sortie.editionId }, data: { tomesParus: cible } });
    }

    await tx.sortie.delete({ where: { id: sortie.id } });

    return { slug: sortie.edition.slug, numero: sortie.numero, tomesParus: cible };
  });
}

export async function promouvoirSortie(
  slug: string,
  numero: number,
  possede: boolean,
  instant: Date,
): Promise<SortiePromue | null> {
  const sortie = await prisma.sortie.findFirst({
    where: { numero, edition: { slug } },
    select: SORTIE_COMPLETE,
  });

  if (!sortie || sortie.date.getTime() > instant.getTime()) {
    return null;
  }

  return promouvoir(sortie, possede);
}

export async function promouvoirSortiesEchues(instant: Date): Promise<SortiePromue[]> {
  const echues = await prisma.sortie.findMany({
    where: { date: { lt: debutDuMois(instant) } },
    orderBy: [{ date: "asc" }, { numero: "asc" }],
    select: SORTIE_COMPLETE,
  });

  const promues: SortiePromue[] = [];
  for (const sortie of echues) {
    promues.push(await promouvoir(sortie, false));
  }
  return promues;
}
