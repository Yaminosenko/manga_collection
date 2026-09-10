"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { candidatParEan, candidatParGroupe, rechercherCandidats, tomesDuGroupe } from "@/lib/catalogue";
import { enrichirDepuisTomes, enrichirSerieParTitre } from "@/lib/enrichissement";
import { chercherParIsbn } from "@/lib/bnf";
import { creerDepuisCandidat } from "@/lib/creation";
import { promouvoirSortie } from "@/lib/promotion";
import { exigerProprietaire } from "@/lib/guard";
import { idUtilisateurCourant } from "@/lib/utilisateur";
import { estPossede, selectionPossession } from "@/lib/possession";
import { rebondir } from "@/lib/rebond";
import { normaliserAlias } from "@/lib/normalisation";
import {
  CANDIDATS_RECHERCHE_MAX,
  LIBELLE_AUTEUR_INCONNU,
  LIBELLE_CANDIDAT_INTROUVABLE,
  LONGUEUR_RECHERCHE_MIN,
  RESULTATS_RECHERCHE_MAX,
  STATUT_A_LA_CREATION,
} from "@/lib/constants";
import { isbnValide } from "@/lib/domain";
import type {
  CandidatEdition,
  CandidatPrepare,
  ResultatLocal,
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
    return { locales: [], candidats: [], termeResolu: null };
  }

  const utilisateurId = await idUtilisateurCourant();

  if (isbnValide(requete.replace(/[^0-9]/g, ""))) {
    const candidat = await candidatParEan(requete.replace(/[^0-9]/g, ""));
    return { locales: [], candidats: candidat ? [candidat] : [], termeResolu: null };
  }

  const [locales, candidats] = await Promise.all([
    editionsLocales(utilisateurId, requete),
    rechercherCandidats(requete),
  ]);

  if (locales.length > 0 || candidats.length > 0) {
    return { locales, candidats, termeResolu: null };
  }

  return parRebond(utilisateurId, requete);
}

async function editionsLocales(utilisateurId: string, requete: string): Promise<ResultatLocal[]> {
  const editions = await prisma.edition.findMany({
    where: {
      suivis: { some: { utilisateurId } },
      OR: [
        { serie: { titre: { contains: requete, mode: "insensitive" } } },
        { serie: { aliasNormalises: { has: normaliserAlias(requete) } } },
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
  });

  return editions.map((edition) => ({
    slug: edition.slug,
    titre: edition.serie.titre,
    nom: edition.nom,
    editeur: edition.editeur,
    tomesParus: edition.tomesParus,
    possedes: edition.volumes.filter(estPossede).length,
  }));
}

async function parRebond(utilisateurId: string, requete: string): Promise<ResultatRecherche> {
  const rebond = await rebondir(requete);
  if (rebond.titres.length === 0) {
    return { locales: [], candidats: [], termeResolu: null };
  }

  const parSlug = new Map<string, ResultatLocal>();
  const parGroupe = new Map<string, CandidatEdition>();
  let termeResolu: string | null = null;

  for (const titre of rebond.titres) {
    const [locales, candidats] = await Promise.all([
      editionsLocales(utilisateurId, titre),
      rechercherCandidats(titre),
    ]);

    for (const locale of locales) {
      parSlug.set(locale.slug, locale);
      termeResolu ??= titre;
    }
    for (const candidat of candidats) {
      const cle = `${candidat.serieNormalise} ${candidat.marqueurNormalise ?? ""}`;
      if (parGroupe.has(cle)) continue;
      parGroupe.set(cle, candidat);
      termeResolu ??= titre;
    }
    if (parGroupe.size >= CANDIDATS_RECHERCHE_MAX) break;
  }

  return {
    locales: [...parSlug.values()].slice(0, RESULTATS_RECHERCHE_MAX),
    candidats: [...parGroupe.values()].slice(0, CANDIDATS_RECHERCHE_MAX),
    termeResolu,
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

async function marquerTomeParIsbn(editionSlug: string, isbn: string): Promise<void> {
  const volume = await prisma.volume.findFirst({
    where: { isbn, edition: { slug: editionSlug } },
    select: { id: true },
  });
  if (!volume) {
    return;
  }
  const utilisateurId = await idUtilisateurCourant();
  await prisma.possession.upsert({
    where: { utilisateurId_volumeId: { utilisateurId, volumeId: volume.id } },
    create: { utilisateurId, volumeId: volume.id, possede: true },
    update: { possede: true },
  });
}

export async function ajouterCandidatDirect(
  serieNormalise: string,
  marqueurNormalise: string | null,
  isbnPossede: string | null,
): Promise<void> {
  await exigerProprietaire();

  const prepare = await preparerCandidat(serieNormalise, marqueurNormalise);
  if (!prepare) {
    throw new Error(LIBELLE_CANDIDAT_INTROUVABLE);
  }

  const { candidat } = prepare;

  if (candidat.slugEnCollection !== null) {
    redirect(`/edition/${candidat.slugEnCollection}`);
  }

  const serie = await enrichirSerieParTitre(candidat.titre);
  const auteur = prepare.auteur === "" ? serie.auteur : prepare.auteur;

  const editionSlug = await creerDepuisCandidat({
    serieNormalise,
    marqueurNormalise,
    titre: candidat.titre,
    titreVo: serie.titreVo,
    auteur: auteur === "" ? LIBELLE_AUTEUR_INCONNU : auteur,
    genres: serie.genres,
    themes: serie.themes,
    cible: serie.cible,
    alias: serie.alias,
    idMangaBaka: serie.idMangaBaka,
    nom: candidat.nom,
    editeur: prepare.editeur,
    tomesParus: candidat.tomesParus,
    prixDefautCentimes: prepare.prixDefautCentimes,
    editionTerminee: candidat.editionTerminee,
    statut: STATUT_A_LA_CREATION,
  });

  if (isbnPossede !== null) {
    await marquerTomeParIsbn(editionSlug, isbnPossede);
  }

  revalidatePath("/");
  revalidatePath("/manquants");
  revalidatePath("/wishlist");
  revalidatePath("/planning");
  redirect(`/edition/${editionSlug}`);
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

