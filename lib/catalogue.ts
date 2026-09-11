import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normaliserPourCatalogue } from "@/lib/normalisation";
import {
  CANDIDATS_RECHERCHE_MAX,
  MOIS_SANS_SORTIE_POUR_TERMINEE,
  NOM_EDITION_PAR_DEFAUT,
  SIMILARITE_CATALOGUE_MIN,
} from "@/lib/constants";
import type { AnnonceCandidat, CandidatEdition, TomeCandidat } from "@/lib/domain";

type LigneGroupe = {
  serieNormalise: string;
  marqueurNormalise: string | null;
  marqueurEdition: string | null;
  serieTitre: string;
  editeur: string | null;
  tomesParus: number | null;
  lignes: bigint;
  derniereParution: Date | null;
  couvertureUrl: string | null;
};

function estTerminee(derniereParution: Date | null, instant: Date): boolean {
  if (derniereParution === null) return false;
  const limite = new Date(instant);
  limite.setMonth(limite.getMonth() - MOIS_SANS_SORTIE_POUR_TERMINEE);
  return derniereParution < limite;
}

function enCandidat(ligne: LigneGroupe, instant: Date): CandidatEdition {
  return {
    serieNormalise: ligne.serieNormalise,
    marqueurNormalise: ligne.marqueurNormalise,
    marqueurEdition: ligne.marqueurEdition,
    titre: ligne.serieTitre,
    nom: ligne.marqueurEdition ?? NOM_EDITION_PAR_DEFAUT,
    editeur: ligne.editeur,
    tomesParus: ligne.tomesParus ?? 1,
    lignes: Number(ligne.lignes),
    derniereParution: ligne.derniereParution?.toISOString() ?? null,
    editionTerminee: estTerminee(ligne.derniereParution, instant),
    slugEdition: null,
    dansMaCollection: false,
    couvertureUrl: ligne.couvertureUrl,
  };
}

const MARQUEUR_NORMALISE = Prisma.sql`lower("marqueurEdition")`;

const CHAMPS_GROUPE = Prisma.sql`
  (array_agg("marqueurEdition" ORDER BY "date" DESC))[1] AS "marqueurEdition",
  (array_agg("serieTitre" ORDER BY "date" DESC))[1] AS "serieTitre",
  mode() WITHIN GROUP (ORDER BY "editeur") AS "editeur",
  max("numero") FILTER (WHERE "date" <= now())::int AS "tomesParus",
  count(*)::bigint AS "lignes",
  max("date") FILTER (WHERE "date" <= now()) AS "derniereParution",
  (array_agg("vignetteUrl" ORDER BY "numero" ASC NULLS LAST, "date" ASC)
     FILTER (WHERE "vignetteUrl" IS NOT NULL))[1] AS "couvertureUrl"`;

const PARUTIONS_AVEC_VIGNETTE = Prisma.sql`
  SELECT pc.*, v."couvertureUrl" AS "vignetteUrl"
  FROM "ParutionCatalogue" pc
  LEFT JOIN "VignetteCatalogue" v ON v."ean" = pc."ean"`;

export async function rechercherCandidats(
  utilisateurId: string,
  terme: string,
  instant = new Date(),
): Promise<CandidatEdition[]> {
  const requete = normaliserPourCatalogue(terme);
  if (requete === "") {
    return [];
  }

  const groupes = await prisma.$queryRaw<LigneGroupe[]>`
    SELECT "serieNormalise", ${MARQUEUR_NORMALISE} AS "marqueurNormalise", ${CHAMPS_GROUPE}
    FROM (${PARUTIONS_AVEC_VIGNETTE}) parutions
    WHERE "serieNormalise" LIKE ${`%${requete}%`}
       OR similarity("serieNormalise", ${requete}) >= ${SIMILARITE_CATALOGUE_MIN}
    GROUP BY 1, 2
    ORDER BY
      ("serieNormalise" = ${requete}) DESC,
      ("serieNormalise" LIKE ${`${requete}%`}) DESC,
      max(similarity("serieNormalise", ${requete})) DESC,
      count(*) DESC
    LIMIT ${CANDIDATS_RECHERCHE_MAX}`;

  return rattacherAuxEditions(
    utilisateurId,
    groupes.map((groupe) => enCandidat(groupe, instant)),
  );
}

export async function candidatParEan(
  utilisateurId: string,
  ean: string,
  instant = new Date(),
): Promise<CandidatEdition | null> {
  const cible = await prisma.parutionCatalogue.findFirst({
    where: { ean },
    orderBy: { date: "desc" },
    select: { serieNormalise: true, marqueurEdition: true },
  });
  if (!cible) {
    return null;
  }
  return candidatParGroupe(
    utilisateurId,
    cible.serieNormalise,
    cible.marqueurEdition === null ? null : cible.marqueurEdition.toLowerCase(),
    instant,
  );
}

export async function candidatParGroupe(
  utilisateurId: string,
  serieNormalise: string,
  marqueurNormalise: string | null,
  instant = new Date(),
): Promise<CandidatEdition | null> {
  const groupes = await prisma.$queryRaw<LigneGroupe[]>`
    SELECT "serieNormalise", ${MARQUEUR_NORMALISE} AS "marqueurNormalise", ${CHAMPS_GROUPE}
    FROM (${PARUTIONS_AVEC_VIGNETTE}) parutions
    WHERE "serieNormalise" = ${serieNormalise}
      AND ${MARQUEUR_NORMALISE} IS NOT DISTINCT FROM ${marqueurNormalise}
    GROUP BY 1, 2`;

  const groupe = groupes[0];
  if (!groupe) {
    return null;
  }
  return (await rattacherAuxEditions(utilisateurId, [enCandidat(groupe, instant)]))[0] ?? null;
}

export async function tomesDuGroupe(
  serieNormalise: string,
  marqueurNormalise: string | null,
  instant = new Date(),
): Promise<{ tomes: TomeCandidat[]; annonces: AnnonceCandidat[] }> {
  const lignes = await prisma.$queryRaw<{ numero: number; ean: string | null; date: Date }[]>`
    SELECT "numero", (array_agg("ean" ORDER BY "date" DESC))[1] AS "ean", max("date") AS "date"
    FROM "ParutionCatalogue"
    WHERE "serieNormalise" = ${serieNormalise}
      AND ${MARQUEUR_NORMALISE} IS NOT DISTINCT FROM ${marqueurNormalise}
      AND "numero" IS NOT NULL
    GROUP BY "numero"
    ORDER BY "numero" ASC`;

  const tomes: TomeCandidat[] = [];
  const annonces: AnnonceCandidat[] = [];
  for (const ligne of lignes) {
    const entree = { numero: ligne.numero, ean: ligne.ean, date: ligne.date.toISOString() };
    if (ligne.date <= instant) {
      tomes.push(entree);
    } else {
      annonces.push(entree);
    }
  }

  if (lignes.length === 0) {
    const unique = await ligneSansNumero(serieNormalise, marqueurNormalise);
    if (unique !== null) {
      const entree = { numero: 1, ean: unique.ean, date: unique.date.toISOString() };
      if (unique.date <= instant) {
        tomes.push(entree);
      } else {
        annonces.push(entree);
      }
    }
  }

  return { tomes, annonces };
}

async function ligneSansNumero(
  serieNormalise: string,
  marqueurNormalise: string | null,
): Promise<{ ean: string | null; date: Date } | null> {
  const lignes = await prisma.$queryRaw<{ ean: string | null; date: Date }[]>`
    SELECT "ean", "date"
    FROM "ParutionCatalogue"
    WHERE "serieNormalise" = ${serieNormalise}
      AND ${MARQUEUR_NORMALISE} IS NOT DISTINCT FROM ${marqueurNormalise}
      AND "numero" IS NULL
    ORDER BY "date" DESC
    LIMIT 1`;
  return lignes[0] ?? null;
}

async function rattacherAuxEditions(
  utilisateurId: string,
  candidats: CandidatEdition[],
): Promise<CandidatEdition[]> {
  if (candidats.length === 0) {
    return candidats;
  }

  const series = [...new Set(candidats.map((candidat) => candidat.serieNormalise))];

  const connus = await prisma.$queryRaw<
    {
      serieNormalise: string;
      marqueurNormalise: string | null;
      slug: string;
      suivie: boolean;
      couvertureCollection: string | null;
    }[]
  >`
    SELECT DISTINCT pc."serieNormalise", lower(pc."marqueurEdition") AS "marqueurNormalise",
           e."slug",
           EXISTS (SELECT 1 FROM "SuiviEdition" su
                    WHERE su."editionId" = e."id"
                      AND su."utilisateurId" = ${utilisateurId}) AS "suivie",
           (SELECT tome."couvertureUrl"
              FROM "Volume" tome
             WHERE tome."editionId" = e."id" AND tome."couvertureUrl" IS NOT NULL
             ORDER BY tome."numero" ASC
             LIMIT 1) AS "couvertureCollection"
    FROM "ParutionCatalogue" pc
    JOIN "Volume" v ON v."isbn" = pc."ean"
    JOIN "Edition" e ON e."id" = v."editionId"
    WHERE pc."serieNormalise" = ANY(${series})`;

  const parGroupe = new Map<
    string,
    { slug: string; suivie: boolean; couverture: string | null }
  >();
  for (const connu of connus) {
    const cle = `${connu.serieNormalise} ${connu.marqueurNormalise ?? ""}`;
    const retenu = parGroupe.get(cle);
    if (retenu === undefined || (connu.suivie && !retenu.suivie)) {
      parGroupe.set(cle, {
        slug: connu.slug,
        suivie: connu.suivie,
        couverture: connu.couvertureCollection,
      });
    }
  }

  return candidats.map((candidat) => {
    const connu = parGroupe.get(
      `${candidat.serieNormalise} ${candidat.marqueurNormalise ?? ""}`,
    );
    return {
      ...candidat,
      slugEdition: connu?.slug ?? null,
      dansMaCollection: connu?.suivie ?? false,
      couvertureUrl: candidat.couvertureUrl ?? connu?.couverture ?? null,
    };
  });
}
