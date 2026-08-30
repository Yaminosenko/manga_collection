import { prisma } from "@/lib/prisma";
import type { Collection, Edition, Manquants } from "@/lib/domain";

export async function chargerEdition(slug: string): Promise<Edition | null> {
  const edition = await prisma.edition.findUnique({
    where: { slug },
    include: {
      volumes: {
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          couvertureUrl: true,
          prixCentimes: true,
          possession: { select: { possede: true } },
        },
      },
      sorties: {
        orderBy: { numero: "asc" },
        select: { numero: true, date: true, couvertureUrl: true },
      },
      serie: {
        include: {
          editions: {
            orderBy: { nom: "asc" },
            select: {
              slug: true,
              nom: true,
              editeur: true,
              tomesParus: true,
              editionTerminee: true,
              statut: true,
              volumes: { select: { possession: { select: { possede: true } } } },
            },
          },
        },
      },
    },
  });

  if (!edition) {
    return null;
  }

  return {
    slug: edition.slug,
    nom: edition.nom,
    editeur: edition.editeur,
    titre: edition.serie.titre,
    auteur: edition.serie.auteur,
    genres: edition.serie.genres,
    cible: edition.serie.cible,
    tomesParus: edition.tomesParus,
    editionTerminee: edition.editionTerminee,
    statut: edition.statut,
    termineeForcee: edition.termineeForcee,
    aVerifier: edition.aVerifier,
    slugMangaNews: edition.slugMangaNews,
    couvertureUrl: edition.couvertureUrl,
    prixDefautCentimes: edition.prixDefautCentimes,
    sorties: edition.sorties.map((sortie) => ({
      numero: sortie.numero,
      date: sortie.date.toISOString(),
      couvertureUrl: sortie.couvertureUrl,
    })),
    tomes: edition.volumes.map((volume) => ({
      numero: volume.numero,
      possede: volume.possession?.possede ?? false,
      couvertureUrl: volume.couvertureUrl,
      prixCentimes: volume.prixCentimes,
    })),
    autresEditions: edition.serie.editions
      .filter((autre) => autre.slug !== edition.slug)
      .map((autre) => ({
        slug: autre.slug,
        nom: autre.nom,
        editeur: autre.editeur,
        tomesParus: autre.tomesParus,
        possedes: autre.volumes.filter((volume) => volume.possession?.possede).length,
        editionTerminee: autre.editionTerminee,
        statut: autre.statut,
      })),
  };
}

export async function chargerCollection(): Promise<Collection> {
  const editions = await prisma.edition.findMany({
    select: {
      slug: true,
      nom: true,
      editeur: true,
      tomesParus: true,
      editionTerminee: true,
      statut: true,
      termineeForcee: true,
      aVerifier: true,
      ajouteeLe: true,
      couvertureUrl: true,
      serie: { select: { titre: true, _count: { select: { editions: true } } } },
      volumes: {
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          couvertureUrl: true,
          possession: { select: { possede: true } },
        },
      },
    },
  });

  const toutes = editions.map((edition) => {
    const possedes = edition.volumes.filter((volume) => volume.possession?.possede);
    const dernier = possedes.at(-1) ?? null;
    return {
      slug: edition.slug,
      titre: edition.serie.titre,
      nom: edition.nom,
      editeur: edition.editeur,
      tomesParus: edition.tomesParus,
      possedes: possedes.length,
      editionTerminee: edition.editionTerminee,
      statut: edition.statut,
      termineeForcee: edition.termineeForcee,
      aVerifier: edition.aVerifier,
      ajouteeLe: edition.ajouteeLe.getTime(),
      editionsDeLaSerie: edition.serie._count.editions,
      dernierNumeroPossede: dernier?.numero ?? null,
      couvertureUrl: edition.couvertureUrl ?? dernier?.couvertureUrl ?? null,
    };
  });

  const lignes = toutes.filter((ligne) => ligne.statut !== "VENDUE");

  return {
    lignes,
    vendues: toutes.filter((ligne) => ligne.statut === "VENDUE"),
    tomesPossedes: lignes.reduce((total, ligne) => total + ligne.possedes, 0),
    nombreEditions: lignes.length,
  };
}

export async function chargerManquants(): Promise<Manquants> {
  const editions = await prisma.edition.findMany({
    where: { statut: { not: "VENDUE" }, termineeForcee: false },
    select: {
      slug: true,
      nom: true,
      editeur: true,
      statut: true,
      aVerifier: true,
      tomesParus: true,
      couvertureUrl: true,
      serie: { select: { titre: true } },
      volumes: {
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          couvertureUrl: true,
          possession: { select: { possede: true } },
        },
      },
    },
  });

  const avecManquants = editions
    .map((edition) => {
      const parus = edition.volumes.filter((volume) => volume.numero <= edition.tomesParus);
      const possedes = parus.filter((volume) => volume.possession?.possede);
      const dernier = possedes.at(-1) ?? null;
      return {
        slug: edition.slug,
        titre: edition.serie.titre,
        nom: edition.nom,
        editeur: edition.editeur,
        statut: edition.statut,
        aVerifier: edition.aVerifier,
        tomesParus: edition.tomesParus,
        possedes: possedes.length,
        manquants: parus
          .filter((volume) => !volume.possession?.possede)
          .map((volume) => volume.numero),
        dernierNumeroPossede: dernier?.numero ?? null,
        couvertureUrl: edition.couvertureUrl ?? dernier?.couvertureUrl ?? null,
      };
    })
    .filter((edition) => edition.manquants.length > 0)
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  const editionsActives = avecManquants.filter((edition) => edition.statut === "EN_COURS");

  return {
    editions: editionsActives,
    arretees: avecManquants.filter((edition) => edition.statut !== "EN_COURS"),
    tomesManquants: editionsActives.reduce(
      (total, edition) => total + edition.manquants.length,
      0,
    ),
  };
}
