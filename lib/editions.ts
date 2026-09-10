import { prisma } from "@/lib/prisma";
import { ORDRE_LIENS_SERIE } from "@/lib/constants";
import { estPossede, selectionPossession, volumesPossedes } from "@/lib/possession";
import { idUtilisateurCourant } from "@/lib/utilisateur";
import { estEnWishList } from "@/lib/domain";
import {
  couvertureDIdentification,
  couvertureDeProgression,
  vignettesParIsbn,
} from "@/lib/vignettes";
import type {
  Edition,
  EditionManquante,
  EspaceCollection,
  EtatEdition,
  LigneCollection,
  LigneWishList,
  SortiePlanning,
} from "@/lib/domain";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

type SuiviLu = { statut: StatutEdition; suivie: boolean };

function estDesaturee(suivi: SuiviLu | undefined): boolean {
  return suivi !== undefined && suivi.statut !== "EN_COURS";
}

function auMoinsUnTomePossede(utilisateurId: string) {
  return { volumes: { some: { possessions: { some: { utilisateurId, possede: true } } } } };
}

export async function chargerEdition(slug: string): Promise<Edition | null> {
  const utilisateurId = await idUtilisateurCourant();
  const possession = selectionPossession(utilisateurId);

  const edition = await prisma.edition.findUnique({
    where: { slug },
    include: {
      suivis: { where: { utilisateurId }, select: { statut: true, suivie: true } },
      volumes: {
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          couvertureUrl: true,
          prixCentimes: true,
          possessions: possession,
        },
      },
      sorties: {
        orderBy: { numero: "asc" },
        select: { numero: true, date: true, couvertureUrl: true },
      },
      serie: {
        include: {
          liens: {
            select: {
              type: true,
              serieLiee: {
                select: {
                  titre: true,
                  editions: {
                    orderBy: { nom: "asc" },
                    select: {
                      id: true,
                      slug: true,
                      nom: true,
                      tomesParus: true,
                      editionTerminee: true,
                      suivis: {
                        where: { utilisateurId },
                        select: { statut: true, suivie: true },
                      },
                      volumes: {
                        orderBy: { numero: "asc" },
                        select: {
                          numero: true,
                          couvertureUrl: true,
                          isbn: true,
                          possessions: possession,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          editions: {
            orderBy: { nom: "asc" },
            select: {
              slug: true,
              nom: true,
              editeur: true,
              tomesParus: true,
              editionTerminee: true,
              suivis: { where: { utilisateurId }, select: { statut: true, suivie: true } },
              volumes: {
                orderBy: { numero: "asc" },
                select: {
                  numero: true,
                  couvertureUrl: true,
                  isbn: true,
                  possessions: possession,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!edition) {
    return null;
  }

  const suivi = edition.suivis[0];

  if (!suivi) {
    return null;
  }

  const vignettes = await vignettesParIsbn([
    ...edition.serie.editions.flatMap((autre) => autre.volumes.map((volume) => volume.isbn)),
    ...edition.serie.liens.flatMap((lien) =>
      lien.serieLiee.editions.flatMap((autre) => autre.volumes.map((volume) => volume.isbn)),
    ),
  ]);

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
    statut: suivi.statut,
    suivie: suivi.suivie,
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
      possede: estPossede(volume),
      couvertureUrl: volume.couvertureUrl,
      prixCentimes: volume.prixCentimes,
    })),
    autresEditions: edition.serie.editions
      .filter((autre) => autre.slug !== edition.slug)
      .map((autre) => {
        const possedes = volumesPossedes(autre.volumes);
        const dernier = possedes.at(-1) ?? null;
        return {
          slug: autre.slug,
          nom: autre.nom,
          editeur: autre.editeur,
          tomesParus: autre.tomesParus,
          possedes: possedes.length,
          editionTerminee: autre.editionTerminee,
          desaturee: estDesaturee(autre.suivis[0]),
          couvertureUrl:
            couvertureDeProgression(possedes) ??
            couvertureDIdentification(autre.volumes, vignettes),
          dernierNumeroPossede: dernier?.numero ?? null,
        };
      }),
    seriesLiees: edition.serie.liens
      .map((lien) => {
        const principale = lien.serieLiee.editions
          .map((autre) => ({
            edition: autre,
            possedes: volumesPossedes(autre.volumes),
          }))
          .sort((a, b) => b.possedes.length - a.possedes.length)
          .at(0);
        if (!principale) {
          return null;
        }
        const dernier = principale.possedes.at(-1) ?? null;
        return {
          slug: principale.edition.slug,
          titre: lien.serieLiee.titre,
          type: lien.type,
          nom: principale.edition.nom,
          tomesParus: principale.edition.tomesParus,
          possedes: principale.possedes.length,
          editionTerminee: principale.edition.editionTerminee,
          desaturee: estDesaturee(principale.edition.suivis[0]),
          couvertureUrl:
            couvertureDeProgression(principale.possedes) ??
            couvertureDIdentification(principale.edition.volumes, vignettes),
          dernierNumeroPossede: dernier?.numero ?? null,
        };
      })
      .filter((liee): liee is NonNullable<typeof liee> => liee !== null)
      .sort(
        (a, b) => ORDRE_LIENS_SERIE.indexOf(a.type) - ORDRE_LIENS_SERIE.indexOf(b.type),
      ),
  };
}

export async function chargerEtatEdition(slug: string): Promise<EtatEdition | null> {
  const utilisateurId = await idUtilisateurCourant();

  const suivi = await prisma.suiviEdition.findFirst({
    where: { utilisateurId, edition: { slug } },
    select: {
      statut: true,
      suivie: true,
      edition: {
        select: {
          slug: true,
          nom: true,
          editionTerminee: true,
          serie: { select: { titre: true } },
        },
      },
    },
  });

  if (!suivi) {
    return null;
  }

  return {
    slug: suivi.edition.slug,
    nom: suivi.edition.nom,
    titre: suivi.edition.serie.titre,
    statut: suivi.statut,
    editionTerminee: suivi.edition.editionTerminee,
    suivie: suivi.suivie,
  };
}

export async function chargerEspaceCollection(): Promise<EspaceCollection> {
  const utilisateurId = await idUtilisateurCourant();

  const suivis = await prisma.suiviEdition.findMany({
    where: { utilisateurId },
    select: {
      statut: true,
      suivie: true,
      ajouteeLe: true,
      edition: {
        select: {
          slug: true,
          nom: true,
          editeur: true,
          tomesParus: true,
          editionTerminee: true,
          couvertureUrl: true,
          prixDefautCentimes: true,
          serie: {
            select: { titre: true, couvertureUrl: true, _count: { select: { editions: true } } },
          },
          volumes: {
            orderBy: { numero: "asc" },
            select: {
              numero: true,
              couvertureUrl: true,
              isbn: true,
              prixCentimes: true,
              possessions: selectionPossession(utilisateurId),
            },
          },
        },
      },
    },
  });

  const vignettes = await vignettesParIsbn(
    suivis.flatMap((suivi) => suivi.edition.volumes.map((volume) => volume.isbn)),
  );

  const lignes: LigneCollection[] = [];
  const vendues: LigneCollection[] = [];
  const editionsManquantes: EditionManquante[] = [];
  const souhaitees: LigneWishList[] = [];

  let valeurCentimes = 0;
  let tomesSansPrix = 0;

  for (const suivi of suivis) {
    const edition = suivi.edition;
    const possedes = volumesPossedes(edition.volumes);
    const parus = edition.volumes.filter((volume) => volume.numero <= edition.tomesParus);
    const parusPossedes = volumesPossedes(parus);

    if (suivi.statut !== "VENDUE") {
      for (const volume of possedes) {
        const prix = volume.prixCentimes ?? edition.prixDefautCentimes;
        if (prix === null) {
          tomesSansPrix += 1;
        } else {
          valeurCentimes += prix;
        }
      }
    }

    const ligne: LigneCollection = {
      slug: edition.slug,
      titre: edition.serie.titre,
      nom: edition.nom,
      editeur: edition.editeur,
      tomesParus: edition.tomesParus,
      possedes: possedes.length,
      editionTerminee: edition.editionTerminee,
      statut: suivi.statut,
      suivie: suivi.suivie,
      ajouteeLe: suivi.ajouteeLe.getTime(),
      editionsDeLaSerie: edition.serie._count.editions,
      dernierNumeroPossede: possedes.at(-1)?.numero ?? null,
      couvertureUrl:
        couvertureDeProgression(possedes) ??
        couvertureDIdentification(edition.volumes, vignettes) ??
        edition.couvertureUrl ??
        edition.serie.couvertureUrl,
    };

    if (ligne.statut === "VENDUE") {
      vendues.push(ligne);
    } else if (estEnWishList(ligne)) {
      souhaitees.push({
        slug: ligne.slug,
        titre: ligne.titre,
        nom: ligne.nom,
        editeur: ligne.editeur,
        tomesParus: ligne.tomesParus,
        editionTerminee: ligne.editionTerminee,
        couvertureUrl: ligne.couvertureUrl,
        ajouteeLe: ligne.ajouteeLe,
      });
    } else {
      lignes.push(ligne);
    }

    const manquants =
      suivi.suivie && possedes.length > 0
        ? parus.filter((volume) => !estPossede(volume)).map((volume) => volume.numero)
        : [];

    if (manquants.length > 0) {
      editionsManquantes.push({
        slug: ligne.slug,
        titre: ligne.titre,
        nom: ligne.nom,
        editeur: ligne.editeur,
        statut: ligne.statut,
        tomesParus: ligne.tomesParus,
        possedes: parusPossedes.length,
        manquants,
        dernierNumeroPossede: parusPossedes.at(-1)?.numero ?? null,
        couvertureUrl: couvertureDeProgression(parusPossedes) ?? edition.couvertureUrl,
      });
    }
  }

  editionsManquantes.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  souhaitees.sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  return {
    collection: {
      lignes,
      vendues,
      tomesPossedes: lignes.reduce((total, ligne) => total + ligne.possedes, 0),
      nombreEditions: lignes.length,
      valeurCentimes,
      tomesSansPrix,
    },
    manquants: {
      editions: editionsManquantes,
      tomesManquants: editionsManquantes.reduce(
        (total, edition) => total + edition.manquants.length,
        0,
      ),
    },
    wishList: { lignes: souhaitees },
  };
}

export async function chargerPlanning(): Promise<SortiePlanning[]> {
  const utilisateurId = await idUtilisateurCourant();

  const sorties = await prisma.sortie.findMany({
    where: {
      edition: {
        suivis: { some: { utilisateurId, suivie: true } },
        ...auMoinsUnTomePossede(utilisateurId),
      },
    },
    orderBy: [{ date: "asc" }, { numero: "asc" }],
    select: {
      numero: true,
      date: true,
      couvertureUrl: true,
      edition: {
        select: {
          slug: true,
          nom: true,
          editeur: true,
          serie: { select: { titre: true, _count: { select: { editions: true } } } },
        },
      },
    },
  });

  return sorties.map((sortie) => ({
    slug: sortie.edition.slug,
    titre: sortie.edition.serie.titre,
    nom: sortie.edition.nom,
    editeur: sortie.edition.editeur,
    numero: sortie.numero,
    date: sortie.date.toISOString(),
    couvertureUrl: sortie.couvertureUrl,
    editionsDeLaSerie: sortie.edition.serie._count.editions,
  }));
}
