import {
  BUDGET_COUVERTURES_MS,
  HAUTEUR_COUVERTURE,
  JOURS_AVANT_NOUVEL_ESSAI,
  LARGEUR_COUVERTURE,
  MILLISECONDES_PAR_JOUR,
  NOM_EDITION_PAR_DEFAUT,
  PLAFOND_COUVERTURES_PAR_PASSAGE,
  PREFIXE_OBJETS_COUVERTURES,
  SOURCE_COUVERTURE_BNF,
  SOURCE_COUVERTURE_MANGADEX,
} from "@/lib/constants";
import { dimensionsImage, telechargerCouvertureBnf } from "@/lib/couverture-bnf";
import type { ReponseCouverture } from "@/lib/couverture-bnf";
import {
  couverturesMangaDex,
  resoudreMangaDex,
  telechargerCouvertureMangaDex,
} from "@/lib/couverture-mangadex";
import { prisma } from "@/lib/prisma";
import { cheminDepuisUrl, copierObjet, deposer } from "@/lib/r2";

const HAUTEUR_MINIMALE = 60;
const ECART_TOMES_TOLERE = 2;

function numerotationComparable(nom: string, tomesParus: number, tomesMangaDex: number): boolean {
  if (nom !== NOM_EDITION_PAR_DEFAUT) return false;
  if (tomesMangaDex === 0) return false;
  return tomesMangaDex <= tomesParus * ECART_TOMES_TOLERE;
}

type Candidat = {
  id: string;
  numero: number;
  isbn: string | null;
  couvertureTentatives: number;
  edition: {
    slug: string;
    nom: string;
    tomesParus: number;
    serie: {
      id: string;
      titre: string;
      titreVo: string | null;
      idMangaDex: string | null;
    };
  };
};

type Vignette = {
  couvertureUrl: string;
  source: string | null;
  largeur: number | null;
  hauteur: number | null;
  recupereeLe: Date;
};

export type BilanCouvertures = {
  examines: number;
  obtenues: number;
  parVignette: number;
  parBnf: number;
  parMangaDex: number;
  absentes: number;
  injoignables: number;
  restants: number;
};

function vignetteALaCote(vignette: Vignette): boolean {
  if (vignette.largeur === null || vignette.hauteur === null) return false;
  if (vignette.largeur > LARGEUR_COUVERTURE || vignette.hauteur > HAUTEUR_COUVERTURE) return false;
  return vignette.largeur === LARGEUR_COUVERTURE || vignette.hauteur === HAUTEUR_COUVERTURE;
}

async function vignettesExploitables(isbns: string[]): Promise<Map<string, Vignette>> {
  if (isbns.length === 0) return new Map();

  const lignes = await prisma.vignetteCatalogue.findMany({
    where: { ean: { in: isbns }, couvertureUrl: { not: null } },
    select: { ean: true, couvertureUrl: true, source: true, largeur: true, hauteur: true, recupereeLe: true },
  });

  return new Map(
    lignes.flatMap((ligne) =>
      ligne.couvertureUrl === null
        ? []
        : [[ligne.ean, { ...ligne, couvertureUrl: ligne.couvertureUrl }] as const],
    ),
  );
}

function delaiAvantNouvelEssai(tentatives: number): number {
  const dernier = JOURS_AVANT_NOUVEL_ESSAI[JOURS_AVANT_NOUVEL_ESSAI.length - 1] ?? 0;
  const jours = JOURS_AVANT_NOUVEL_ESSAI[tentatives] ?? dernier;
  return jours * MILLISECONDES_PAR_JOUR;
}

function estDuPourUnEssai(candidat: Candidat, tenteeLe: Date | null, maintenant: Date): boolean {
  if (tenteeLe === null) return true;
  return maintenant.getTime() - tenteeLe.getTime() >= delaiAvantNouvelEssai(candidat.couvertureTentatives);
}

function imageExploitable(reponse: ReponseCouverture): boolean {
  if (reponse.etat !== "image") return false;
  const mesure = dimensionsImage(reponse.image.octets);
  return mesure === null || mesure.hauteur >= HAUTEUR_MINIMALE;
}

async function identifiantMangaDex(
  serie: Candidat["edition"]["serie"],
  resolus: Map<string, string | null>,
): Promise<string | null> {
  if (serie.idMangaDex !== null) return serie.idMangaDex;

  const dejaResolu = resolus.get(serie.id);
  if (dejaResolu !== undefined) return dejaResolu;

  const identifiant = await resoudreMangaDex(serie);
  resolus.set(serie.id, identifiant);
  return identifiant;
}

async function retenirIdentifiant(
  serie: Candidat["edition"]["serie"],
  identifiant: string,
  retenus: Set<string>,
) {
  if (serie.idMangaDex === identifiant || retenus.has(serie.id)) return;
  await prisma.serie.update({ where: { id: serie.id }, data: { idMangaDex: identifiant } });
  retenus.add(serie.id);
}

async function poser(candidat: Candidat, reponse: ReponseCouverture, source: string, maintenant: Date) {
  if (reponse.etat !== "image") return null;

  const chemin =
    `${PREFIXE_OBJETS_COUVERTURES}/${candidat.edition.slug}/` +
    `${candidat.numero}.${reponse.image.extension}`;
  const url = await deposer(chemin, reponse.image.octets, reponse.image.type);

  await prisma.volume.update({
    where: { id: candidat.id },
    data: {
      couvertureUrl: url,
      sourceCouverture: source,
      couvertureRecupereeLe: maintenant,
      couvertureTenteeLe: maintenant,
      couvertureTentatives: { increment: 1 },
    },
  });

  return url;
}

async function reprendre(candidat: Candidat, vignette: Vignette, maintenant: Date): Promise<boolean> {
  const source = cheminDepuisUrl(vignette.couvertureUrl);
  if (source === null) return false;

  const point = source.lastIndexOf(".");
  if (point === -1) return false;

  const chemin =
    `${PREFIXE_OBJETS_COUVERTURES}/${candidat.edition.slug}/` +
    `${candidat.numero}.${source.slice(point + 1)}`;

  let url: string;
  try {
    url = await copierObjet(source, chemin);
  } catch {
    return false;
  }

  await prisma.volume.update({
    where: { id: candidat.id },
    data: {
      couvertureUrl: url,
      sourceCouverture: vignette.source,
      couvertureRecupereeLe: vignette.recupereeLe,
      couvertureTenteeLe: maintenant,
      couvertureTentatives: { increment: 1 },
    },
  });

  return true;
}

export async function acquerirCouverturesManquantes(
  maintenant: Date = new Date(),
  budgetMs: number = BUDGET_COUVERTURES_MS,
  plafond: number = PLAFOND_COUVERTURES_PAR_PASSAGE,
): Promise<BilanCouvertures> {
  const echeance = Date.now() + budgetMs;
  const delaiMinimal = (JOURS_AVANT_NOUVEL_ESSAI[0] ?? 0) * MILLISECONDES_PAR_JOUR;
  const seuil = new Date(maintenant.getTime() - delaiMinimal);

  const bruts = await prisma.volume.findMany({
    where: {
      couvertureUrl: null,
      OR: [{ couvertureTenteeLe: null }, { couvertureTenteeLe: { lt: seuil } }],
    },
    orderBy: [{ couvertureTenteeLe: { sort: "asc", nulls: "first" } }, { numero: "asc" }],
    take: plafond,
    select: {
      id: true,
      numero: true,
      isbn: true,
      couvertureTentatives: true,
      couvertureTenteeLe: true,
      edition: {
        select: {
          slug: true,
          nom: true,
          tomesParus: true,
          serie: {
            select: { id: true, titre: true, titreVo: true, idMangaDex: true },
          },
        },
      },
    },
  });

  const candidats = bruts.filter((brut) =>
    estDuPourUnEssai(brut, brut.couvertureTenteeLe, maintenant),
  );

  const vignettes = await vignettesExploitables(
    candidats.map((candidat) => candidat.isbn).filter((isbn): isbn is string => isbn !== null),
  );

  const bilan: BilanCouvertures = {
    examines: 0,
    obtenues: 0,
    parVignette: 0,
    parBnf: 0,
    parMangaDex: 0,
    absentes: 0,
    injoignables: 0,
    restants: 0,
  };

  const couverturesParSerie = new Map<string, Map<number, string>>();
  const identifiantsParSerie = new Map<string, string | null>();
  const identifiantsRetenus = new Set<string>();

  for (const candidat of candidats) {
    if (Date.now() >= echeance) break;
    bilan.examines += 1;

    let obtenue = false;
    let injoignable = false;

    const vignette = candidat.isbn === null ? undefined : vignettes.get(candidat.isbn);
    if (vignette !== undefined && vignetteALaCote(vignette)) {
      obtenue = await reprendre(candidat, vignette, maintenant);
      if (obtenue) bilan.parVignette += 1;
    }

    if (!obtenue && candidat.isbn !== null) {
      const reponse = await telechargerCouvertureBnf(candidat.isbn);
      if (imageExploitable(reponse)) {
        await poser(candidat, reponse, SOURCE_COUVERTURE_BNF, maintenant);
        bilan.parBnf += 1;
        obtenue = true;
      } else if (reponse.etat === "injoignable") {
        injoignable = true;
      }
    }

    if (!obtenue && candidat.edition.nom === NOM_EDITION_PAR_DEFAUT) {
      const serie = candidat.edition.serie;
      const identifiant = await identifiantMangaDex(serie, identifiantsParSerie);
      if (identifiant !== null) {
        let fichiers = couverturesParSerie.get(identifiant);
        if (!fichiers) {
          fichiers = await couverturesMangaDex(identifiant);
          couverturesParSerie.set(identifiant, fichiers);
        }
        const tomesMangaDex = Math.max(0, ...fichiers.keys());
        const comparable = numerotationComparable(
          candidat.edition.nom,
          candidat.edition.tomesParus,
          tomesMangaDex,
        );
        if (comparable) {
          await retenirIdentifiant(serie, identifiant, identifiantsRetenus);
        }
        const fichier = comparable ? fichiers.get(candidat.numero) : undefined;
        if (fichier !== undefined) {
          const reponse = await telechargerCouvertureMangaDex(identifiant, fichier);
          if (imageExploitable(reponse)) {
            await poser(candidat, reponse, SOURCE_COUVERTURE_MANGADEX, maintenant);
            bilan.parMangaDex += 1;
            obtenue = true;
          } else if (reponse.etat === "injoignable") {
            injoignable = true;
          }
        }
      }
    }

    if (obtenue) {
      bilan.obtenues += 1;
      continue;
    }

    if (injoignable) {
      bilan.injoignables += 1;
      await prisma.volume.update({
        where: { id: candidat.id },
        data: { couvertureTenteeLe: maintenant },
      });
      continue;
    }

    bilan.absentes += 1;
    await prisma.volume.update({
      where: { id: candidat.id },
      data: {
        couvertureTenteeLe: maintenant,
        couvertureTentatives: { increment: 1 },
      },
    });
  }

  bilan.restants = await prisma.volume.count({ where: { couvertureUrl: null } });
  return bilan;
}
