"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { candidatParEan, candidatParGroupe, rechercherCandidats, tomesDuGroupe } from "@/lib/catalogue";
import { enrichirDepuisTomes } from "@/lib/enrichissement";
import { chercherParIsbn, chercherPrixDefautCentimes } from "@/lib/bnf";
import { creerDepuisCandidat, creerSerieAvecEdition } from "@/lib/creation";
import { promouvoirSortie } from "@/lib/promotion";
import { exigerProprietaire } from "@/lib/guard";
import { idUtilisateurCourant } from "@/lib/utilisateur";
import { estPossede, selectionPossession } from "@/lib/possession";
import {
  ACTION_AJOUTER,
  LIBELLE_CANDIDAT_INCOMPLET,
  LIBELLE_PRIX_INVALIDE,
  LIBELLE_STATUT_INVALIDE,
  LIBELLE_TOMES_PARUS_INVALIDE,
  LONGUEUR_RECHERCHE_MIN,
  RESULTATS_RECHERCHE_MAX,
  STATUTS_EDITION,
  TOMES_PARUS_MAX,
} from "@/lib/constants";
import { isbnValide } from "@/lib/domain";
import type {
  CandidatPrepare,
  EtatCreation,
  ResultatRecherche,
  ResultatScan,
} from "@/lib/domain";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

function revaliderEdition(slug: string): void {
  revalidatePath(`/edition/${slug}`);
  revalidatePath(`/edition/${slug}/tomes`);
  revalidatePath(`/edition/${slug}/etat`);
  revalidatePath("/");
  revalidatePath("/manquants");
  revalidatePath("/wishlist");
}

export async function marquerSortieObtenue(slug: string, numero: number): Promise<void> {
  await exigerProprietaire();
  await promouvoirSortie(slug, numero, await idUtilisateurCourant(), new Date());
  revaliderEdition(slug);
  revalidatePath("/planning");
}

async function editionSuivie(slug: string): Promise<{ utilisateurId: string; editionId: string }> {
  const utilisateurId = await idUtilisateurCourant();
  const edition = await prisma.edition.findUnique({ where: { slug }, select: { id: true } });
  if (!edition) {
    throw new Error(`Édition ${slug} introuvable`);
  }
  return { utilisateurId, editionId: edition.id };
}

export async function definirStatut(slug: string, statut: StatutEdition): Promise<void> {
  await exigerProprietaire();
  const { utilisateurId, editionId } = await editionSuivie(slug);
  await prisma.suiviEdition.update({
    where: { utilisateurId_editionId: { utilisateurId, editionId } },
    data: { statut },
  });
  revaliderEdition(slug);
}

export async function definirParution(
  slug: string,
  editionTerminee: boolean | null,
): Promise<void> {
  await exigerProprietaire();
  await prisma.edition.update({ where: { slug }, data: { editionTerminee } });
  revaliderEdition(slug);
}

export async function definirSuivie(slug: string, suivie: boolean): Promise<void> {
  await exigerProprietaire();
  const { utilisateurId, editionId } = await editionSuivie(slug);
  await prisma.suiviEdition.update({
    where: { utilisateurId_editionId: { utilisateurId, editionId } },
    data: { suivie },
  });
  revaliderEdition(slug);
  revalidatePath("/planning");
}

export async function basculerTome(
  slug: string,
  numero: number,
  possede: boolean,
): Promise<void> {
  await exigerProprietaire();

  const volume = await prisma.volume.findFirst({
    where: { numero, edition: { slug } },
    select: { id: true },
  });

  if (!volume) {
    throw new Error(`Tome ${numero} introuvable pour l'édition ${slug}`);
  }

  const utilisateurId = await idUtilisateurCourant();

  await prisma.possession.upsert({
    where: { utilisateurId_volumeId: { utilisateurId, volumeId: volume.id } },
    create: { utilisateurId, volumeId: volume.id, possede },
    update: { possede },
  });

  revaliderEdition(slug);
}

export async function definirTousLesTomes(slug: string, possede: boolean): Promise<void> {
  await exigerProprietaire();

  const edition = await prisma.edition.findUnique({
    where: { slug },
    select: { tomesParus: true, volumes: { select: { id: true, numero: true } } },
  });

  if (!edition) {
    throw new Error(`Édition ${slug} introuvable`);
  }

  const utilisateurId = await idUtilisateurCourant();

  const identifiants = edition.volumes
    .filter((volume) => volume.numero <= edition.tomesParus)
    .map((volume) => volume.id);

  await prisma.possession.createMany({
    data: identifiants.map((volumeId) => ({ utilisateurId, volumeId, possede })),
    skipDuplicates: true,
  });
  await prisma.possession.updateMany({
    where: { utilisateurId, volumeId: { in: identifiants } },
    data: { possede },
  });

  revaliderEdition(slug);
}

export async function rechercherAuCatalogue(terme: string): Promise<ResultatRecherche> {
  await exigerProprietaire();

  const requete = terme.trim();
  if (requete.length < LONGUEUR_RECHERCHE_MIN) {
    return { locales: [], candidats: [] };
  }

  const utilisateurId = await idUtilisateurCourant();

  if (isbnValide(requete.replace(/[^0-9]/g, ""))) {
    const candidat = await candidatParEan(requete.replace(/[^0-9]/g, ""));
    return { locales: [], candidats: candidat ? [candidat] : [] };
  }

  const [editions, candidats] = await Promise.all([
    prisma.edition.findMany({
      where: {
        suivis: { some: { utilisateurId } },
        OR: [
          { serie: { titre: { contains: requete, mode: "insensitive" } } },
          { serie: { alias: { has: requete } } },
          { nom: { contains: requete, mode: "insensitive" } },
        ],
      },
      take: RESULTATS_RECHERCHE_MAX,
      select: {
        slug: true,
        nom: true,
        editeur: true,
        tomesParus: true,
        serie: { select: { titre: true } },
        volumes: { select: { possessions: selectionPossession(utilisateurId) } },
      },
    }),
    rechercherCandidats(requete),
  ]);

  return {
    locales: editions.map((edition) => ({
      slug: edition.slug,
      titre: edition.serie.titre,
      nom: edition.nom,
      editeur: edition.editeur,
      tomesParus: edition.tomesParus,
      possedes: edition.volumes.filter(estPossede).length,
    })),
    candidats,
  };
}

export async function preparerCandidat(
  serieNormalise: string,
  marqueurNormalise: string | null,
): Promise<CandidatPrepare | null> {
  await exigerProprietaire();

  const candidat = await candidatParGroupe(serieNormalise, marqueurNormalise);
  if (!candidat) {
    return null;
  }

  const { tomes, annonces } = await tomesDuGroupe(serieNormalise, marqueurNormalise);
  const enrichi = await enrichirDepuisTomes(tomes);

  return {
    candidat,
    auteur: enrichi.auteurs.join(", "),
    editeur: enrichi.editeur ?? candidat.editeur,
    prixDefautCentimes: enrichi.prixDefautCentimes,
    tomesConnus: tomes.length,
    tomesAvecEan: tomes.filter((tome) => tome.ean !== null).length,
    annonces: annonces.length,
  };
}

export async function ajouterCandidat(
  _precedent: EtatCreation,
  donnees: FormData,
): Promise<EtatCreation> {
  await exigerProprietaire();

  const serieNormalise = lireTexte(donnees, "serieNormalise");
  const marqueurBrut = lireTexte(donnees, "marqueurNormalise");
  const titre = lireTexte(donnees, "titre");
  const auteur = lireTexte(donnees, "auteur");
  const nom = lireTexte(donnees, "nom");
  const editeur = lireTexte(donnees, "editeur");
  const prixBrut = lireTexte(donnees, "prixDefaut");
  const tomesParus = Number(lireTexte(donnees, "tomesParus"));
  const statut = lireTexte(donnees, "statut");
  const editionTerminee = donnees.get("editionTerminee") === "on";
  const ouvrirLesTomes = donnees.get("action") === ACTION_AJOUTER;

  if (serieNormalise === "" || titre === "" || auteur === "" || nom === "") {
    return { erreur: LIBELLE_CANDIDAT_INCOMPLET };
  }
  if (!estStatutEdition(statut)) {
    return { erreur: LIBELLE_STATUT_INVALIDE };
  }
  if (!Number.isInteger(tomesParus) || tomesParus < 1 || tomesParus > TOMES_PARUS_MAX) {
    return { erreur: LIBELLE_TOMES_PARUS_INVALIDE };
  }
  if (prixBrut !== "" && lireCentimes(prixBrut) === null) {
    return { erreur: LIBELLE_PRIX_INVALIDE };
  }

  const editionSlug = await creerDepuisCandidat({
    serieNormalise,
    marqueurNormalise: marqueurBrut === "" ? null : marqueurBrut,
    titre,
    titreVo: null,
    auteur,
    genres: [],
    nom,
    editeur: editeur || null,
    tomesParus,
    prixDefautCentimes: lireCentimes(prixBrut),
    editionTerminee,
    statut,
  });

  revalidatePath("/");
  revalidatePath("/manquants");
  revalidatePath("/wishlist");
  revalidatePath("/planning");
  redirect(ouvrirLesTomes ? `/edition/${editionSlug}/tomes` : `/edition/${editionSlug}`);
}
function estStatutEdition(valeur: string): valeur is StatutEdition {
  return (STATUTS_EDITION as readonly string[]).includes(valeur);
}

function lireTexte(donnees: FormData, champ: string): string {
  return String(donnees.get(champ) ?? "").trim();
}

function lireCentimes(brut: string): number | null {
  if (brut === "") {
    return null;
  }
  const valeur = Number(brut.replace(",", "."));
  return Number.isFinite(valeur) && valeur >= 0 ? Math.round(valeur * 100) : null;
}


function racineDuTitre(titreNotice: string): string {
  return titreNotice.replace(/[\s.:,-]*\d{1,3}\s*$/, "").trim();
}

export async function resoudreIsbn(brut: string): Promise<ResultatScan | null> {
  await exigerProprietaire();

  const isbn = brut.replace(/[^0-9]/g, "");
  if (!isbnValide(isbn)) {
    return null;
  }

  const utilisateurId = await idUtilisateurCourant();

  const volume = await prisma.volume.findFirst({
    where: { isbn },
    select: {
      numero: true,
      possessions: selectionPossession(utilisateurId),
      edition: { select: { slug: true, nom: true, serie: { select: { titre: true } } } },
    },
  });
  if (volume) {
    return {
      type: "tome",
      isbn,
      slug: volume.edition.slug,
      titre: volume.edition.serie.titre,
      nom: volume.edition.nom,
      numero: volume.numero,
      possede: estPossede(volume),
    };
  }

  const sortie = await prisma.sortie.findFirst({
    where: { isbn },
    select: {
      numero: true,
      date: true,
      edition: { select: { slug: true, serie: { select: { titre: true } } } },
    },
  });
  if (sortie) {
    return {
      type: "annonce",
      isbn,
      slug: sortie.edition.slug,
      titre: sortie.edition.serie.titre,
      numero: sortie.numero,
      date: sortie.date.toISOString(),
    };
  }

  const candidat = await candidatParEan(isbn);
  if (candidat) {
    const prepare = await preparerCandidat(candidat.serieNormalise, candidat.marqueurNormalise);
    if (prepare) {
      return { type: "catalogue", isbn, prepare };
    }
  }

  const notice = await chercherParIsbn(isbn);
  if (!notice) {
    return { type: "inconnu", isbn };
  }

  return {
    type: "notice",
    isbn,
    titreNotice: notice.titre,
    editeur: notice.editeur,
    annee: notice.annee,
    candidats: await rechercherCandidats(racineDuTitre(notice.titre)),
  };
}

export async function chercherPrix(titre: string, auteur: string): Promise<number | null> {
  await exigerProprietaire();

  if (titre.trim() === "") {
    return null;
  }

  return chercherPrixDefautCentimes(titre.trim(), auteur.trim());
}

export async function creerEdition(
  _precedent: EtatCreation,
  donnees: FormData,
): Promise<EtatCreation> {
  await exigerProprietaire();

  const titre = lireTexte(donnees, "titre");
  const auteur = lireTexte(donnees, "auteur");
  const nom = lireTexte(donnees, "nom");
  const editeur = lireTexte(donnees, "editeur");
  const prixBrut = lireTexte(donnees, "prixDefaut");
  const tomesParus = Number(lireTexte(donnees, "tomesParus"));
  const statut = lireTexte(donnees, "statut");
  const editionTerminee = donnees.get("editionTerminee") === "on";

  if (titre === "" || auteur === "" || nom === "") {
    return { erreur: "Titre, auteur et nom d’édition sont obligatoires." };
  }
  if (!estStatutEdition(statut)) {
    return { erreur: LIBELLE_STATUT_INVALIDE };
  }
  if (!Number.isInteger(tomesParus) || tomesParus < 1 || tomesParus > TOMES_PARUS_MAX) {
    return { erreur: LIBELLE_TOMES_PARUS_INVALIDE };
  }
  if (prixBrut !== "" && lireCentimes(prixBrut) === null) {
    return { erreur: "Le prix par défaut n’est pas un nombre valide." };
  }

  const editionSlug = await creerSerieAvecEdition({
    titre,
    titreVo: lireTexte(donnees, "titreVo") || null,
    auteur,
    genres: lireTexte(donnees, "genres")
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean),
    nom,
    editeur: editeur || null,
    tomesParus,
    prixDefautCentimes: lireCentimes(prixBrut),
    statut,
    editionTerminee,
  });

  revalidatePath("/");
  revalidatePath("/manquants");
  revalidatePath("/wishlist");
  redirect(`/edition/${editionSlug}`);
}
