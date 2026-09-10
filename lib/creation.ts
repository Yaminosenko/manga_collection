import { prisma } from "@/lib/prisma";
import { idUtilisateurCourant } from "@/lib/utilisateur";
import { slugifier } from "@/lib/slug";
import { aliasAffichables, formesNormalisees } from "@/lib/normalisation";
import { MOIS_FENETRE_SORTIE, NOM_EDITION_PAR_DEFAUT } from "@/lib/constants";
import { tomesDuGroupe } from "@/lib/catalogue";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

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

export type ChampsCandidat = {
  serieNormalise: string;
  marqueurNormalise: string | null;
  titre: string;
  titreVo: string | null;
  auteur: string;
  genres: string[];
  themes: string[];
  cible: string | null;
  alias: string[];
  idMangaBaka: number | null;
  nom: string;
  editeur: string | null;
  tomesParus: number;
  prixDefautCentimes: number | null;
  editionTerminee: boolean;
  statut: StatutEdition;
};

async function serieExistante(titre: string, slug: string): Promise<string | null> {
  const serie = await prisma.serie.findFirst({
    where: { OR: [{ slug }, { titre }, { alias: { has: titre } }] },
    select: { id: true },
  });
  return serie?.id ?? null;
}

export async function creerDepuisCandidat(champs: ChampsCandidat): Promise<string> {
  return creerDepuisCandidatPour(await idUtilisateurCourant(), champs);
}

export async function creerDepuisCandidatPour(
  utilisateurId: string,
  champs: ChampsCandidat,
): Promise<string> {
  const instant = new Date();
  const finFenetre = new Date(instant);
  finFenetre.setMonth(finFenetre.getMonth() + MOIS_FENETRE_SORTIE);

  const { tomes, annonces } = await tomesDuGroupe(
    champs.serieNormalise,
    champs.marqueurNormalise,
    instant,
  );
  const parNumero = new Map(tomes.map((tome) => [tome.numero, tome]));

  const slugSerieSouhaite = slugifier(champs.titre);
  const serieId =
    (await serieExistante(champs.titre, slugSerieSouhaite)) ??
    (
      await prisma.serie.create({
        data: {
          slug: await slugUnique(
            slugSerieSouhaite,
            async (slug) => (await prisma.serie.count({ where: { slug } })) > 0,
          ),
          titre: champs.titre,
          titreVo: champs.titreVo,
          auteur: champs.auteur,
          genres: champs.genres,
          themes: champs.themes,
          cible: champs.cible,
          idMangaBaka: champs.idMangaBaka,
          alias: aliasAffichables(champs.titre, champs.titreVo, champs.alias),
          aliasNormalises: formesNormalisees(champs.titre, champs.titreVo, champs.alias),
        },
        select: { id: true },
      })
    ).id;

  const serie = await prisma.serie.findUniqueOrThrow({
    where: { id: serieId },
    select: { slug: true },
  });

  const baseEdition =
    champs.nom === NOM_EDITION_PAR_DEFAUT
      ? serie.slug
      : `${serie.slug}-${slugifier(champs.nom)}`;

  const editionSlug = await slugUnique(
    baseEdition,
    async (slug) => (await prisma.edition.count({ where: { slug } })) > 0,
  );

  const edition = await prisma.edition.create({
    data: {
      serieId,
      slug: editionSlug,
      nom: champs.nom,
      editeur: champs.editeur,
      tomesParus: champs.tomesParus,
      editionTerminee: champs.editionTerminee,
      prixDefautCentimes: champs.prixDefautCentimes,
      creeeParId: utilisateurId,
      suivis: { create: { utilisateurId, statut: champs.statut } },
      volumes: {
        create: Array.from({ length: champs.tomesParus }, (_, index) => {
          const numero = index + 1;
          const connu = parNumero.get(numero);
          return {
            numero,
            isbn: connu?.ean ?? null,
            dateSortie: connu ? new Date(connu.date) : null,
          };
        }),
      },
    },
    select: { id: true, slug: true },
  });

  const aAnnoncer = annonces.filter((annonce) => {
    const date = new Date(annonce.date);
    return annonce.numero > champs.tomesParus && date <= finFenetre;
  });

  if (aAnnoncer.length > 0) {
    await prisma.sortie.createMany({
      data: aAnnoncer.map((annonce) => ({
        editionId: edition.id,
        numero: annonce.numero,
        date: new Date(annonce.date),
        isbn: annonce.ean,
      })),
      skipDuplicates: true,
    });
  }

  return edition.slug;
}
