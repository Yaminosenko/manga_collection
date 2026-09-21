import {
  AGENT_UTILISATEUR,
  API_MANGADEX,
  CLASSIFICATIONS_MANGADEX,
  DELAI_MANGADEX_MS,
  DEPOT_MANGADEX,
  LANGUES_COUVERTURE,
  LOT_COUVERTURES_MANGADEX,
  MARQUEURS_SATELLITE,
  RESULTATS_RECHERCHE_MANGADEX,
  VIGNETTE_MANGADEX,
} from "@/lib/constants";
import type { ReponseCouverture } from "@/lib/couverture-bnf";
import { formesNormalisees, normaliserAlias } from "@/lib/normalisation";

type Manga = {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles?: Record<string, string>[];
  };
};

type Couverture = {
  attributes: { volume: string | null; locale: string | null; fileName: string };
};

export type SerieAApparier = {
  titre: string;
  titreVo: string | null;
};

async function interroger<T>(chemin: string): Promise<T | null> {
  try {
    const reponse = await fetch(`${API_MANGADEX}${chemin}`, {
      headers: { "User-Agent": AGENT_UTILISATEUR },
      signal: AbortSignal.timeout(DELAI_MANGADEX_MS),
    });
    if (!reponse.ok) return null;
    return (await reponse.json()) as T;
  } catch {
    return null;
  }
}

function nomsDuManga(manga: Manga): string[] {
  const noms = Object.values(manga.attributes.title);
  for (const alternatif of manga.attributes.altTitles ?? []) {
    noms.push(...Object.values(alternatif));
  }
  return noms.filter((nom) => nom && nom.length > 0);
}

function estFicheSatellite(manga: Manga): boolean {
  const titres = nomsDuManga(manga).join(" ").toLowerCase();
  return MARQUEURS_SATELLITE.some((marqueur) => titres.includes(marqueur));
}

function correspondExactement(manga: Manga, formes: Set<string>): boolean {
  return nomsDuManga(manga).some((nom) => formes.has(normaliserAlias(nom)));
}

export async function resoudreMangaDex(serie: SerieAApparier): Promise<string | null> {
  const formes = new Set(formesNormalisees(serie.titre, serie.titreVo, []));
  if (formes.size === 0) return null;

  const termes = [serie.titre, ...(serie.titreVo ? [serie.titreVo] : [])];
  const retenus = new Map<string, Manga>();

  for (const terme of termes) {
    const parametres = new URLSearchParams({
      title: terme,
      limit: String(RESULTATS_RECHERCHE_MANGADEX),
    });
    for (const classification of CLASSIFICATIONS_MANGADEX) {
      parametres.append("contentRating[]", classification);
    }
    const charge = await interroger<{ data: Manga[] }>(`/manga?${parametres}`);
    for (const manga of charge?.data ?? []) {
      if (estFicheSatellite(manga)) continue;
      if (!correspondExactement(manga, formes)) continue;
      retenus.set(manga.id, manga);
    }
  }

  if (retenus.size === 0) return null;
  if (retenus.size === 1) return [...retenus.keys()][0] ?? null;

  let meilleur: { id: string; couvertures: number } | null = null;
  for (const id of retenus.keys()) {
    const couvertures = (await couverturesMangaDex(id)).size;
    if (!meilleur || couvertures > meilleur.couvertures) {
      meilleur = { id, couvertures };
    }
  }
  return meilleur?.id ?? null;
}

export async function couverturesMangaDex(idMangaDex: string): Promise<Map<number, string>> {
  const parLangue = new Map<string, Map<number, string>>();
  let decalage = 0;
  let total = 1;

  while (decalage < total) {
    const parametres = new URLSearchParams({
      "manga[]": idMangaDex,
      limit: String(LOT_COUVERTURES_MANGADEX),
      offset: String(decalage),
    });
    const charge = await interroger<{ data: Couverture[]; total: number }>(
      `/cover?${parametres}`,
    );
    if (!charge) break;
    total = charge.total ?? 0;

    for (const couverture of charge.data ?? []) {
      const { volume, locale, fileName } = couverture.attributes;
      if (!volume || !locale) continue;
      const [tete, suffixe] = volume.trim().split(".");
      if (suffixe !== undefined) continue;
      const numero = Number.parseInt(tete ?? "", 10);
      if (!Number.isInteger(numero)) continue;

      const tomes = parLangue.get(locale) ?? new Map<number, string>();
      if (!tomes.has(numero)) tomes.set(numero, fileName);
      parLangue.set(locale, tomes);
    }

    decalage += LOT_COUVERTURES_MANGADEX;
  }

  const retenues = new Map<number, string>();
  for (const langue of [...LANGUES_COUVERTURE].reverse()) {
    for (const [numero, fichier] of parLangue.get(langue) ?? []) {
      retenues.set(numero, fichier);
    }
  }
  return retenues;
}

export async function telechargerCouvertureMangaDex(
  idMangaDex: string,
  fichier: string,
): Promise<ReponseCouverture> {
  try {
    const reponse = await fetch(
      `${DEPOT_MANGADEX}/${idMangaDex}/${fichier}${VIGNETTE_MANGADEX}`,
      {
        headers: { "User-Agent": AGENT_UTILISATEUR },
        signal: AbortSignal.timeout(DELAI_MANGADEX_MS),
      },
    );
    if (reponse.status === 404) return { etat: "absente" };
    if (!reponse.ok) return { etat: "injoignable", cause: `http ${reponse.status}` };

    return {
      etat: "image",
      image: {
        octets: Buffer.from(await reponse.arrayBuffer()),
        type: "image/jpeg",
        extension: "jpg",
      },
    };
  } catch (erreur) {
    return { etat: "injoignable", cause: erreur instanceof Error ? erreur.name : "inconnue" };
  }
}
