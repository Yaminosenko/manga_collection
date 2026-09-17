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

async function promouvoir(
  sortie: SortieChargee,
  utilisateurId: string | null,
): Promise<SortiePromue> {
  return prisma.$transaction(async (tx) => {
    const edition = await tx.edition.findUniqueOrThrow({
      where: { id: sortie.editionId },
      select: { tomesParus: true },
    });
    const cible = Math.max(edition.tomesParus, sortie.numero);

    for (let numero = edition.tomesParus + 1; numero <= sortie.numero; numero += 1) {
      await tx.volume.upsert({
        where: { editionId_numero: { editionId: sortie.editionId, numero } },
        create: { editionId: sortie.editionId, numero },
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

    if (utilisateurId !== null) {
      await tx.possession.upsert({
        where: { utilisateurId_volumeId: { utilisateurId, volumeId: volume.id } },
        create: { utilisateurId, volumeId: volume.id, possede: true },
        update: { possede: true },
      });
    }

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
  utilisateurId: string,
  instant: Date,
): Promise<SortiePromue | null> {
  const sortie = await prisma.sortie.findFirst({
    where: { numero, edition: { slug, suivis: { some: { utilisateurId } } } },
    select: SORTIE_COMPLETE,
  });

  if (!sortie || sortie.date.getTime() > instant.getTime()) {
    return null;
  }

  return promouvoir(sortie, utilisateurId);
}

export type BilanPromotion = {
  promues: SortiePromue[];
  horsSequence: string[];
};

export async function promouvoirSortiesEchues(instant: Date): Promise<BilanPromotion> {
  const echues = await prisma.sortie.findMany({
    where: { date: { lt: debutDuMois(instant) } },
    orderBy: [{ date: "asc" }, { numero: "asc" }],
    select: { ...SORTIE_COMPLETE, edition: { select: { slug: true, tomesParus: true } } },
  });

  const promues: SortiePromue[] = [];
  const horsSequence: string[] = [];

  for (const sortie of echues) {
    if (sortie.numero > sortie.edition.tomesParus + 1) {
      horsSequence.push(`${sortie.edition.slug} t${sortie.numero} sur ${sortie.edition.tomesParus}`);
      continue;
    }
    promues.push(await promouvoir(sortie, null));
  }

  return { promues, horsSequence };
}
