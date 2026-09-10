import { prisma } from "@/lib/prisma";
import { rechercherSurMangaBaka } from "@/lib/mangabaka";
import { normaliserAlias } from "@/lib/normalisation";
import { DELAI_REBOND_MS, TITRES_REBOND_MAX } from "@/lib/constants";

export type Rebond = {
  titres: string[];
  idMangaBaka: number | null;
  memorise: boolean;
};

const AUCUN: Rebond = { titres: [], idMangaBaka: null, memorise: false };

function titresUtiles(titre: string, titreFr: string | null): string[] {
  return [...new Set([titreFr, titre].filter((valeur): valeur is string => valeur !== null))];
}

async function memorise(normalise: string): Promise<Rebond | null> {
  const connu = await prisma.aliasRecherche.findUnique({ where: { normalise } });
  if (!connu) {
    return null;
  }

  await prisma.aliasRecherche.update({
    where: { normalise },
    data: { utilisations: { increment: 1 }, vuLe: new Date() },
  });

  return { titres: connu.titres, idMangaBaka: connu.idMangaBaka, memorise: true };
}

export async function rebondir(terme: string): Promise<Rebond> {
  const normalise = normaliserAlias(terme);
  if (normalise === "") {
    return AUCUN;
  }

  const deja = await memorise(normalise);
  if (deja) {
    return deja;
  }

  const trouvees = await rechercherSurMangaBaka(terme, TITRES_REBOND_MAX, DELAI_REBOND_MS);
  if (trouvees.indisponible || trouvees.valeur.length === 0) {
    return AUCUN;
  }

  const titres = [
    ...new Set(
      trouvees.valeur.flatMap((serie) => titresUtiles(serie.titre, serie.titreFr)),
    ),
  ].filter((titre) => normaliserAlias(titre) !== normalise);

  if (titres.length === 0) {
    return AUCUN;
  }

  const premier = trouvees.valeur[0];
  await prisma.aliasRecherche.upsert({
    where: { normalise },
    create: { normalise, terme, titres, idMangaBaka: premier?.id ?? null },
    update: { titres, idMangaBaka: premier?.id ?? null, vuLe: new Date() },
  });

  return { titres, idMangaBaka: premier?.id ?? null, memorise: false };
}
