import { DELAI_APPEL_EXTERNE_MS, RESULTATS_RECHERCHE_MAX, URL_ANILIST } from "@/lib/constants";

export type SerieDistante = {
  id: number;
  titre: string;
  titreVo: string | null;
  auteur: string;
  genres: string[];
  volumesJaponais: number | null;
  annee: number | null;
  couvertureUrl: string | null;
};

export type RechercheDistante = {
  resultats: SerieDistante[];
  indisponible: boolean;
};

const REQUETE = `
query ($recherche: String, $parPage: Int) {
  Page(perPage: $parPage) {
    media(search: $recherche, type: MANGA, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      volumes
      startDate { year }
      genres
      coverImage { large }
      staff(perPage: 6) { edges { role node { name { full } } } }
    }
  }
}`;

type MediaAniList = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  volumes: number | null;
  startDate: { year: number | null } | null;
  genres: string[] | null;
  coverImage: { large: string | null } | null;
  staff: { edges: { role: string | null; node: { name: { full: string | null } } }[] } | null;
};

function extraireAuteur(media: MediaAniList): string {
  const createurs = (media.staff?.edges ?? [])
    .filter((edge) => edge.role !== null && !edge.role.includes("("))
    .map((edge) => edge.node.name.full)
    .filter((nom): nom is string => nom !== null);

  return [...new Set(createurs)].join(" & ");
}

function convertir(media: MediaAniList): SerieDistante {
  return {
    id: media.id,
    titre: media.title.english ?? media.title.romaji ?? media.title.native ?? "",
    titreVo: media.title.native ?? media.title.romaji,
    auteur: extraireAuteur(media),
    genres: media.genres ?? [],
    volumesJaponais: media.volumes,
    annee: media.startDate?.year ?? null,
    couvertureUrl: media.coverImage?.large ?? null,
  };
}

export async function rechercherSurAniList(terme: string): Promise<RechercheDistante> {
  try {
    const reponse = await fetch(URL_ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        query: REQUETE,
        variables: { recherche: terme, parPage: RESULTATS_RECHERCHE_MAX },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_APPEL_EXTERNE_MS),
    });

    if (!reponse.ok) {
      return { resultats: [], indisponible: true };
    }

    const charge = (await reponse.json()) as {
      data?: { Page?: { media?: MediaAniList[] } };
      errors?: unknown[];
    };

    if (charge.errors || !charge.data?.Page?.media) {
      return { resultats: [], indisponible: true };
    }

    return {
      resultats: charge.data.Page.media.filter((media) => media.title.romaji || media.title.english).map(convertir),
      indisponible: false,
    };
  } catch {
    return { resultats: [], indisponible: true };
  }
}
