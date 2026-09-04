"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { rechercherSurAniList } from "@/lib/anilist";
import { chercherParIsbn, chercherPrixDefautCentimes } from "@/lib/bnf";
import { slugifier } from "@/lib/slug";
import { creerSerieAvecEdition } from "@/lib/creation";
import { promouvoirSortie } from "@/lib/promotion";
import { exigerProprietaire } from "@/lib/guard";
import {
  LIBELLE_STATUT_INVALIDE,
  LIBELLE_TOMES_PARUS_INVALIDE,
  LONGUEUR_RECHERCHE_MIN,
  RESULTATS_RECHERCHE_MAX,
  STATUTS_EDITION,
  TOMES_PARUS_MAX,
} from "@/lib/constants";
import { isbnValide } from "@/lib/domain";
import type { EtatCreation, ResultatRecherche, ResultatScan } from "@/lib/domain";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

function revaliderEdition(slug: string): void {
  revalidatePath(`/edition/${slug}`);
  revalidatePath(`/edition/${slug}/tomes`);
  revalidatePath(`/edition/${slug}/etat`);
  revalidatePath("/");
  revalidatePath("/manquants");
}

export async function marquerSortieObtenue(slug: string, numero: number): Promise<void> {
  await exigerProprietaire();
  await promouvoirSortie(slug, numero, true, new Date());
  revaliderEdition(slug);
  revalidatePath("/planning");
}

export async function definirStatut(slug: string, statut: StatutEdition): Promise<void> {
  await exigerProprietaire();
  await prisma.edition.update({ where: { slug }, data: { statut } });
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

export async function definirTermineeForcee(slug: string, forcee: boolean): Promise<void> {
  await exigerProprietaire();
  await prisma.edition.update({ where: { slug }, data: { termineeForcee: forcee } });
  revaliderEdition(slug);
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

  await prisma.possession.upsert({
    where: { volumeId: volume.id },
    create: { volumeId: volume.id, possede },
    update: { possede },
  });

  revaliderEdition(slug);
}

export async function marquerRepartitionVerifiee(slug: string): Promise<void> {
  await exigerProprietaire();
  await prisma.edition.updateMany({
    where: { slug, aVerifier: true },
    data: { aVerifier: false },
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

  const identifiants = edition.volumes
    .filter((volume) => volume.numero <= edition.tomesParus)
    .map((volume) => volume.id);

  await prisma.possession.createMany({
    data: identifiants.map((volumeId) => ({ volumeId, possede })),
    skipDuplicates: true,
  });
  await prisma.possession.updateMany({
    where: { volumeId: { in: identifiants } },
    data: { possede },
  });

  revaliderEdition(slug);
}

export async function rechercherSeries(terme: string): Promise<ResultatRecherche> {
  await exigerProprietaire();

  const requete = terme.trim();
  if (requete.length < LONGUEUR_RECHERCHE_MIN) {
    return { locales: [], distantes: [], indisponible: false };
  }

  const [editions, distante] = await Promise.all([
    prisma.edition.findMany({
      where: {
        OR: [
          { serie: { titre: { contains: requete, mode: "insensitive" } } },
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
        volumes: { select: { possession: { select: { possede: true } } } },
      },
    }),
    rechercherSurAniList(requete),
  ]);

  const titresLocaux = new Set(
    (await prisma.serie.findMany({ select: { titre: true, titreVo: true } })).flatMap((serie) =>
      [serie.titre, serie.titreVo].filter((titre): titre is string => titre !== null).map(slugifier),
    ),
  );

  return {
    locales: editions.map((edition) => ({
      slug: edition.slug,
      titre: edition.serie.titre,
      nom: edition.nom,
      editeur: edition.editeur,
      tomesParus: edition.tomesParus,
      possedes: edition.volumes.filter((volume) => volume.possession?.possede).length,
    })),
    distantes: distante.resultats.map((resultat) => ({
      ...resultat,
      dejaEnCollection:
        titresLocaux.has(slugifier(resultat.titre)) ||
        (resultat.titreVo !== null && titresLocaux.has(slugifier(resultat.titreVo))),
    })),
    indisponible: distante.indisponible,
  };
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

function normaliserTitre(texte: string): string {
  return texte
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function racineDuTitre(titreNotice: string): string {
  return normaliserTitre(titreNotice.replace(/[\s.:,-]*\d{1,3}\s*$/, ""));
}

export async function resoudreIsbn(brut: string): Promise<ResultatScan | null> {
  await exigerProprietaire();

  const isbn = brut.replace(/[^0-9]/g, "");
  if (!isbnValide(isbn)) {
    return null;
  }

  const volume = await prisma.volume.findFirst({
    where: { isbn },
    select: {
      numero: true,
      possession: { select: { possede: true } },
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
      possede: volume.possession?.possede ?? false,
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

  const notice = await chercherParIsbn(isbn);
  if (!notice) {
    return { type: "inconnu", isbn };
  }

  const racine = racineDuTitre(notice.titre);
  const editions = await prisma.edition.findMany({
    select: { slug: true, serie: { select: { titre: true } } },
  });
  const correspondance =
    editions.find((edition) => normaliserTitre(edition.serie.titre) === racine) ?? null;

  return {
    type: "notice",
    isbn,
    titreNotice: notice.titre,
    editeur: notice.editeur,
    annee: notice.annee,
    slugProbable: correspondance?.slug ?? null,
    titreProbable: correspondance?.serie.titre ?? null,
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
  redirect(`/edition/${editionSlug}`);
}
