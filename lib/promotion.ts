import { prisma } from "@/lib/prisma";
import { debutRetroactivitePlanning } from "@/lib/domain";

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
  sourceCouverture: true,
  couvertureRecupereeLe: true,
  editionId: true,
  edition: { select: { slug: true } },
} as const;

type SortieChargee = {
  id: string;
  numero: number;
  date: Date;
  isbn: string | null;
  couvertureUrl: string | null;
  sourceCouverture: string | null;
  couvertureRecupereeLe: Date | null;
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
        sourceCouverture: sortie.couvertureUrl === null ? undefined : sortie.sourceCouverture,
        couvertureRecupereeLe:
          sortie.couvertureUrl === null ? undefined : sortie.couvertureRecupereeLe,
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

    return { slug: sortie.edition.slug, numero: sortie.numero, tomesParus: cible };
  });
}

async function reprendreCouverture(sortie: SortieChargee): Promise<void> {
  if (sortie.couvertureUrl === null) {
    return;
  }

  await prisma.volume.updateMany({
    where: { editionId: sortie.editionId, numero: sortie.numero, couvertureUrl: null },
    data: {
      couvertureUrl: sortie.couvertureUrl,
      sourceCouverture: sortie.sourceCouverture,
      couvertureRecupereeLe: sortie.couvertureRecupereeLe,
    },
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
  retirees: string[];
};

export async function promouvoirSortiesEchues(instant: Date): Promise<BilanPromotion> {
  const parues = await prisma.sortie.findMany({
    where: { date: { lte: instant } },
    orderBy: [{ date: "asc" }, { numero: "asc" }],
    select: { ...SORTIE_COMPLETE, edition: { select: { slug: true, tomesParus: true } } },
  });

  const promues: SortiePromue[] = [];
  const horsSequence: string[] = [];
  const tomesParusCourants = new Map<string, number>();

  for (const sortie of parues) {
    const tomesParus = tomesParusCourants.get(sortie.editionId) ?? sortie.edition.tomesParus;

    if (sortie.numero <= tomesParus) {
      await reprendreCouverture(sortie);
      continue;
    }

    if (sortie.numero > tomesParus + 1) {
      horsSequence.push(`${sortie.edition.slug} t${sortie.numero} sur ${tomesParus}`);
      continue;
    }

    const promue = await promouvoir(sortie, null);
    tomesParusCourants.set(sortie.editionId, promue.tomesParus);
    promues.push(promue);
  }

  const perimees = await prisma.sortie.findMany({
    where: { date: { lt: debutRetroactivitePlanning(instant) } },
    orderBy: [{ date: "asc" }, { numero: "asc" }],
    select: { id: true, numero: true, edition: { select: { slug: true, tomesParus: true } } },
  });

  const retirees: string[] = [];
  for (const sortie of perimees) {
    if (sortie.numero > sortie.edition.tomesParus) {
      continue;
    }
    await prisma.sortie.delete({ where: { id: sortie.id } });
    retirees.push(`${sortie.edition.slug} t${sortie.numero}`);
  }

  return { promues, horsSequence, retirees };
}
