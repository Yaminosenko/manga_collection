"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { rechercherSurAniList } from "@/lib/anilist";
import { slugifier } from "@/lib/slug";
import { creerSerieAvecEdition } from "@/lib/creation";
import { exigerAcces } from "@/lib/guard";
import { LONGUEUR_RECHERCHE_MIN, RESULTATS_RECHERCHE_MAX } from "@/lib/constants";
import type { EtatCreation, ResultatRecherche } from "@/lib/domain";
import type { StatutEdition } from "@/lib/generated/prisma/enums";

async function marquerVerifiee(slug: string): Promise<void> {
  await prisma.edition.updateMany({
    where: { slug, aVerifier: true },
    data: { aVerifier: false },
  });
}

function revaliderEdition(slug: string): void {
  revalidatePath(`/edition/${slug}`);
  revalidatePath(`/edition/${slug}/tomes`);
}

export async function basculerTome(
  slug: string,
  numero: number,
  possede: boolean,
): Promise<void> {
  await exigerAcces();

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

  await marquerVerifiee(slug);
  revaliderEdition(slug);
}

export async function definirTousLesTomes(slug: string, possede: boolean): Promise<void> {
  await exigerAcces();

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

  await prisma.possession.updateMany({
    where: { volumeId: { in: identifiants } },
    data: { possede },
  });

  await marquerVerifiee(slug);
  revaliderEdition(slug);
}

export async function rechercherSeries(terme: string): Promise<ResultatRecherche> {
  await exigerAcces();

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

export async function creerEdition(
  _precedent: EtatCreation,
  donnees: FormData,
): Promise<EtatCreation> {
  await exigerAcces();

  const titre = lireTexte(donnees, "titre");
  const auteur = lireTexte(donnees, "auteur");
  const nom = lireTexte(donnees, "nom");
  const editeur = lireTexte(donnees, "editeur");
  const prixBrut = lireTexte(donnees, "prixDefaut");
  const tomesParus = Number(lireTexte(donnees, "tomesParus"));
  const statut = lireTexte(donnees, "statut") as StatutEdition;
  const editionTerminee = donnees.get("editionTerminee") === "on";

  if (titre === "" || auteur === "" || nom === "") {
    return { erreur: "Titre, auteur et nom d’édition sont obligatoires." };
  }
  if (!Number.isInteger(tomesParus) || tomesParus < 1) {
    return { erreur: "Le nombre de tomes parus doit être un entier supérieur à zéro." };
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
