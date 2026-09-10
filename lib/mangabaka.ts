import {
  ALIAS_PAR_SERIE_MAX,
  BRANCHES_THEMES_MANGABAKA,
  CIBLES_MANGABAKA,
  DELAI_APPEL_EXTERNE_MS,
  NIVEAU_THEME_MAX,
  POIDS_TAGS_DECROISSANT,
  POIDS_THEMES_RETENUS,
  RESULTATS_MANGABAKA_MAX,
  TAGS_PROMUS_EN_GENRE,
  THEMES_PAR_SERIE_MAX,
  TYPES_LIEN_MANGABAKA,
  URL_MANGABAKA,
} from "@/lib/constants";
import { normaliserAlias } from "@/lib/normalisation";

type TitreDistant = {
  language: string | null;
  traits: string[] | null;
  title: string;
  note: string | null;
  is_primary: boolean | null;
};

type TagDistant = {
  name: string;
  name_path: string;
  level: number;
  weight: string | null;
  is_genre: boolean;
  is_spoiler: boolean;
};

type RelationDistante = {
  to_series_id: number;
  relation_type: string;
};

type SerieDistante = {
  id: number;
  state: string | null;
  merged_with: number | null;
  canonical_url: string | null;
  authors: string[] | null;
  artists: string[] | null;
  published: { start_date: string | null } | null;
  status: string | null;
  type: string | null;
  final_volume: number | null;
  titles: TitreDistant[] | null;
  tags: TagDistant[] | null;
  relationships: RelationDistante[] | null;
};

export type Titre = {
  langue: string | null;
  titre: string;
  note: string | null;
  officiel: boolean;
};

export type SerieMangaBaka = {
  id: number;
  titre: string;
  titreFr: string | null;
  titreVo: string | null;
  auteur: string;
  genres: string[];
  themes: string[];
  cible: string | null;
  alias: string[];
  titres: Titre[];
  volumesJaponais: number | null;
  annee: number | null;
  urlCanonique: string | null;
};

export type LienMangaBaka = { id: number; type: string };

export type ReponseMangaBaka<T> = { valeur: T; indisponible: boolean };

function texte(valeur: string | null | undefined): string | null {
  const propre = valeur?.trim();
  return propre === undefined || propre === "" ? null : propre;
}

function titresDe(serie: SerieDistante): Titre[] {
  return (serie.titles ?? [])
    .map((entree) => ({
      langue: texte(entree.language),
      titre: texte(entree.title),
      note: texte(entree.note),
      officiel: (entree.traits ?? []).includes("official"),
    }))
    .filter((entree): entree is Titre => entree.titre !== null);
}

function premierTitre(titres: Titre[], predicat: (titre: Titre) => boolean): string | null {
  return titres.find(predicat)?.titre ?? null;
}

function titreFrancais(titres: Titre[]): string | null {
  return premierTitre(titres, (titre) => titre.langue?.startsWith("fr") === true);
}

function titreOriginal(titres: Titre[]): string | null {
  return (
    premierTitre(titres, (titre) => titre.langue === "ja") ??
    premierTitre(titres, (titre) => titre.langue === "ja-Latn")
  );
}

function titreAffichable(titres: Titre[]): string {
  return (
    titreFrancais(titres) ??
    premierTitre(titres, (titre) => titre.langue === "en" && titre.officiel) ??
    premierTitre(titres, (titre) => titre.langue === "en") ??
    premierTitre(titres, (titre) => titre.langue === "ja-Latn") ??
    titres[0]?.titre ??
    ""
  );
}

export function aliasDe(titres: Titre[]): string[] {
  const vus = new Set<string>();
  const retenus: string[] = [];

  for (const entree of titres) {
    const normalise = normaliserAlias(entree.titre);
    if (normalise === "" || vus.has(normalise)) continue;
    vus.add(normalise);
    retenus.push(entree.titre);
    if (retenus.length >= ALIAS_PAR_SERIE_MAX) break;
  }

  return retenus;
}

function branche(chemin: string): string {
  return chemin.split(" > ")[0] ?? "";
}

function rangDuPoids(tag: TagDistant): number {
  const rang = POIDS_TAGS_DECROISSANT.indexOf(tag.weight ?? "");
  return rang === -1 ? POIDS_TAGS_DECROISSANT.length : rang;
}

function genresDe(tags: TagDistant[]): string[] {
  return [
    ...new Set(
      tags
        .filter((tag) => tag.is_genre || TAGS_PROMUS_EN_GENRE.includes(tag.name))
        .map((tag) => tag.name),
    ),
  ];
}

function themesDe(tags: TagDistant[]): string[] {
  const genres = new Set(genresDe(tags));

  return [
    ...new Set(
      tags
        .filter(
          (tag) =>
            !tag.is_spoiler &&
            !genres.has(tag.name) &&
            POIDS_THEMES_RETENUS.includes(tag.weight ?? "") &&
            tag.level <= NIVEAU_THEME_MAX &&
            BRANCHES_THEMES_MANGABAKA.includes(branche(tag.name_path)),
        )
        .sort((gauche, droite) => rangDuPoids(gauche) - rangDuPoids(droite))
        .map((tag) => tag.name),
    ),
  ].slice(0, THEMES_PAR_SERIE_MAX);
}

function cibleDe(tags: TagDistant[]): string | null {
  const principale = tags
    .filter((tag) => tag.name in CIBLES_MANGABAKA)
    .sort((gauche, droite) => rangDuPoids(gauche) - rangDuPoids(droite))[0];
  return principale ? CIBLES_MANGABAKA[principale.name] ?? null : null;
}

function auteurDe(serie: SerieDistante): string {
  const noms = [...(serie.authors ?? []), ...(serie.artists ?? [])]
    .map(texte)
    .filter((nom): nom is string => nom !== null);
  return [...new Set(noms)].join(" & ");
}

export type SerieMangaBakaBrute = SerieDistante;

export function liensDe(serie: SerieMangaBakaBrute): LienMangaBaka[] {
  return (serie.relationships ?? [])
    .map((relation) => ({
      id: relation.to_series_id,
      type: TYPES_LIEN_MANGABAKA[relation.relation_type] ?? null,
    }))
    .filter((lien): lien is LienMangaBaka => lien.type !== null);
}

export function convertir(serie: SerieMangaBakaBrute): SerieMangaBaka {
  const titres = titresDe(serie);
  const tags = serie.tags ?? [];
  const debut = texte(serie.published?.start_date ?? null);

  return {
    id: serie.id,
    titre: titreAffichable(titres),
    titreFr: titreFrancais(titres),
    titreVo: titreOriginal(titres),
    auteur: auteurDe(serie),
    genres: genresDe(tags),
    themes: themesDe(tags),
    cible: cibleDe(tags),
    alias: aliasDe(titres),
    titres,
    volumesJaponais: serie.final_volume,
    annee: debut === null ? null : Number(debut.slice(0, 4)) || null,
    urlCanonique: texte(serie.canonical_url),
  };
}

async function interroger<T>(chemin: string, delaiMs: number): Promise<T | null> {
  const reponse = await fetch(`${URL_MANGABAKA}${chemin}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(delaiMs),
  });

  if (!reponse.ok) {
    throw new Error(`MangaBaka a repondu ${reponse.status}`);
  }

  const charge = (await reponse.json()) as { data?: T };
  return charge.data ?? null;
}

export async function rechercherSurMangaBaka(
  terme: string,
  limite = RESULTATS_MANGABAKA_MAX,
  delaiMs = DELAI_APPEL_EXTERNE_MS,
): Promise<ReponseMangaBaka<SerieMangaBaka[]>> {
  try {
    const trouvees = await interroger<SerieDistante[]>(
      `/series/search?q=${encodeURIComponent(terme)}&limit=${limite}`,
      delaiMs,
    );
    if (trouvees === null) {
      return { valeur: [], indisponible: true };
    }
    return {
      valeur: trouvees
        .filter((serie) => serie.state !== "merged" && serie.merged_with === null)
        .map(convertir),
      indisponible: false,
    };
  } catch {
    return { valeur: [], indisponible: true };
  }
}

export async function serieCompleteParId(
  id: number,
): Promise<ReponseMangaBaka<SerieDistante | null>> {
  try {
    return {
      valeur: await interroger<SerieDistante>(
        `/series/${id}?schema=full`,
        DELAI_APPEL_EXTERNE_MS,
      ),
      indisponible: false,
    };
  } catch {
    return { valeur: null, indisponible: true };
  }
}
