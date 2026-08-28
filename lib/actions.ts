"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function marquerVerifiee(slug: string): Promise<void> {
  await prisma.edition.updateMany({
    where: { slug, aVerifier: true },
    data: { aVerifier: false },
  });
}

function revaliderEdition(slug: string): void {
  revalidatePath(`/edition/${slug}`);
  revalidatePath(`/edition/${slug}/tomes`);
}

export async function basculerTome(
  slug: string,
  numero: number,
  possede: boolean,
): Promise<void> {
  const volume = await prisma.volume.findFirst({
    where: { numero, edition: { slug } },
    select: { id: true },
  });

  if (!volume) {
    throw new Error(`Tome ${numero} introuvable pour l'édition ${slug}`);
  }

  await prisma.possession.upsert({
    where: { volumeId: volume.id },
    create: { volumeId: volume.id, possede },
    update: { possede },
  });

  await marquerVerifiee(slug);
  revaliderEdition(slug);
}

export async function definirTousLesTomes(slug: string, possede: boolean): Promise<void> {
  const edition = await prisma.edition.findUnique({
    where: { slug },
    select: { tomesParus: true, volumes: { select: { id: true, numero: true } } },
  });

  if (!edition) {
    throw new Error(`Édition ${slug} introuvable`);
  }

  const identifiants = edition.volumes
    .filter((volume) => volume.numero <= edition.tomesParus)
    .map((volume) => volume.id);

  await prisma.possession.updateMany({
    where: { volumeId: { in: identifiants } },
    data: { possede },
  });

  await marquerVerifiee(slug);
  revaliderEdition(slug);
}
