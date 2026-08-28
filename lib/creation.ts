import { prisma } from "@/lib/prisma";
import { slugifier } from "@/lib/slug";
import { NOM_EDITION_PAR_DEFAUT } from "@/lib/constants";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

export type ChampsEdition = {
  titre: string;
  titreVo: string | null;
  auteur: string;
  genres: string[];
  nom: string;
  editeur: string | null;
  tomesParus: number;
  prixDefautCentimes: number | null;
  statut: StatutEdition;
  editionTerminee: boolean;
};

async function slugUnique(
  base: string,
  existe: (slug: string) => Promise<boolean>,
): Promise<string> {
  const racine = base === "" ? "serie" : base;
  let candidat = racine;
  let suffixe = 2;
  while (await existe(candidat)) {
    candidat = `${racine}-${suffixe}`;
    suffixe += 1;
  }
  return candidat;
}

export async function creerSerieAvecEdition(champs: ChampsEdition): Promise<string> {
  const serieSlug = await slugUnique(
    slugifier(champs.titre),
    async (slug) => (await prisma.serie.count({ where: { slug } })) > 0,
  );

  const baseEdition =
    champs.nom === NOM_EDITION_PAR_DEFAUT ? serieSlug : `${serieSlug}-${slugifier(champs.nom)}`;

  const editionSlug = await slugUnique(
    baseEdition,
    async (slug) => (await prisma.edition.count({ where: { slug } })) > 0,
  );

  await prisma.serie.create({
    data: {
      slug: serieSlug,
      titre: champs.titre,
      titreVo: champs.titreVo,
      auteur: champs.auteur,
      genres: champs.genres,
      themes: [],
      editions: {
        create: {
          slug: editionSlug,
          nom: champs.nom,
          editeur: champs.editeur,
          tomesParus: champs.tomesParus,
          editionTerminee: champs.editionTerminee,
          prixDefautCentimes: champs.prixDefautCentimes,
          statut: champs.statut,
          volumes: {
            create: Array.from({ length: champs.tomesParus }, (_, index) => ({
              numero: index + 1,
              possession: { create: { possede: false } },
            })),
          },
        },
      },
    },
  });

  return editionSlug;
}
