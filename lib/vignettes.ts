import { prisma } from "@/lib/prisma";

export const VOLUMES_POUR_IDENTIFIER = 4;

type TomeIdentifiable = { couvertureUrl: string | null; isbn: string | null };
type TomePossede = { couvertureUrl: string | null };

export async function vignettesParIsbn(
  isbns: (string | null)[],
): Promise<Map<string, string>> {
  const connus = [...new Set(isbns.filter((isbn): isbn is string => isbn !== null))];
  if (connus.length === 0) {
    return new Map();
  }

  const vignettes = await prisma.vignetteCatalogue.findMany({
    where: { ean: { in: connus }, couvertureUrl: { not: null } },
    select: { ean: true, couvertureUrl: true },
  });

  return new Map(
    vignettes.flatMap((vignette) =>
      vignette.couvertureUrl === null ? [] : [[vignette.ean, vignette.couvertureUrl] as const],
    ),
  );
}

export function couvertureDeProgression(possedes: TomePossede[]): string | null {
  return possedes.at(-1)?.couvertureUrl ?? null;
}

export function couvertureDIdentification(
  tomes: TomeIdentifiable[],
  vignettes: Map<string, string>,
): string | null {
  const premiers = tomes.slice(0, VOLUMES_POUR_IDENTIFIER);

  return (
    premiers.find((tome) => tome.couvertureUrl !== null)?.couvertureUrl ??
    premiers
      .map((tome) => (tome.isbn === null ? null : vignettes.get(tome.isbn) ?? null))
      .find((url) => url !== null) ??
    null
  );
}
