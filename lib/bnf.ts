import { URL_SRU_BNF } from "@/lib/constants";

const NOTICES_MAX = 50;
const LONGUEUR_MOT_SIGNIFIANT = 3;
const MOTS_VIDES = new Set(["the", "le", "la", "les", "de", "du", "des", "of", "a", "an", "and", "et"]);

const MARQUEURS_AUTRE_EDITION = [
  "prestige",
  "collector",
  "coffret",
  "integrale",
  "perfect",
  "deluxe",
  "double",
  "artbook",
  "guide",
  "coloriage",
  "calendrier",
  "roman",
];

function sansAccent(texte: string): string {
  return texte.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

function normaliser(texte: string): string {
  return sansAccent(texte).toLowerCase();
}

function jetonsAuteur(auteur: string): string[] {
  return [...new Set(normaliser(auteur).split(/[^\p{L}\p{N}]+/u))].filter(
    (mot) => mot.length >= LONGUEUR_MOT_SIGNIFIANT && !MOTS_VIDES.has(mot),
  );
}

function porteAutreEdition(titreNotice: string): boolean {
  const parentheses = [...normaliser(titreNotice).matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  return parentheses.some((contenu) =>
    MARQUEURS_AUTRE_EDITION.some((marqueur) => contenu.includes(marqueur)),
  );
}

function centimes(brut: string): number | null {
  const trouve = brut.match(/(\d+)[,.](\d{2})/);
  return trouve ? Number(trouve[1]) * 100 + Number(trouve[2]) : null;
}

function sousChamp(bloc: string, tag: string, code: string): string | null {
  const champ = bloc.match(
    new RegExp(`<[^>]*datafield[^>]*tag="${tag}"[\\s\\S]*?</[^>]*datafield>`),
  );
  if (!champ) return null;
  const valeur = champ[0].match(
    new RegExp(`code="${code}"[^>]*>([\\s\\S]*?)</[^>]*subfield>`),
  );
  return valeur ? valeur[1].trim() : null;
}

export async function chercherPrixDefautCentimes(
  titre: string,
  auteur: string,
): Promise<number | null> {
  const requete = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query: `bib.title all "${titre}" and bib.doctype any "a"`,
    recordSchema: "unimarcxchange",
    maximumRecords: String(NOTICES_MAX),
  });

  let xml: string;
  try {
    const reponse = await fetch(`${URL_SRU_BNF}?${requete}`, { cache: "no-store" });
    if (!reponse.ok) return null;
    xml = await reponse.text();
  } catch {
    return null;
  }

  const jetons = jetonsAuteur(auteur);
  const releves = new Map<number, number>();

  for (const bloc of xml.match(/<srw:recordData>[\s\S]*?<\/srw:recordData>/g) ?? []) {
    const contexte = normaliser(bloc.replace(/<[^>]+>/g, " "));
    if (jetons.length > 0 && !jetons.some((jeton) => contexte.includes(jeton))) continue;

    const titreNotice = sousChamp(bloc, "200", "a");
    if (titreNotice && porteAutreEdition(titreNotice)) continue;

    const prixBrut = sousChamp(bloc, "010", "d");
    if (!prixBrut) continue;
    const prix = centimes(prixBrut);
    if (prix === null) continue;

    releves.set(prix, (releves.get(prix) ?? 0) + 1);
  }

  if (releves.size === 0) return null;

  return [...releves.entries()].sort((gauche, droite) => droite[1] - gauche[1])[0][0];
}

export type NoticeBnf = {
  isbn: string;
  titre: string;
  editeur: string | null;
  annee: string | null;
  format: string | null;
  prixCentimes: number | null;
};

function nettoyerEditeur(brut: string | null): string | null {
  if (!brut) return null;
  return brut.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
}

export async function chercherParIsbn(isbn: string): Promise<NoticeBnf | null> {
  const requete = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query: `bib.isbn all "${isbn}"`,
    recordSchema: "unimarcxchange",
    maximumRecords: "1",
  });

  let xml: string;
  try {
    const reponse = await fetch(`${URL_SRU_BNF}?${requete}`, { cache: "no-store" });
    if (!reponse.ok) return null;
    xml = await reponse.text();
  } catch {
    return null;
  }

  const bloc = xml.match(/<srw:recordData>[\s\S]*?<\/srw:recordData>/)?.[0];
  if (!bloc) return null;

  const titre = sousChamp(bloc, "200", "a");
  if (!titre) return null;

  const complement = sousChamp(bloc, "200", "h") ?? sousChamp(bloc, "200", "i");
  const prixBrut = sousChamp(bloc, "010", "d");

  return {
    isbn,
    titre: complement ? `${titre} ${complement}` : titre,
    editeur: nettoyerEditeur(sousChamp(bloc, "214", "c") ?? sousChamp(bloc, "210", "c")),
    annee: (sousChamp(bloc, "214", "d") ?? sousChamp(bloc, "210", "d") ?? "").match(/\d{4}/)?.[0] ?? null,
    format: sousChamp(bloc, "215", "a"),
    prixCentimes: prixBrut ? centimes(prixBrut) : null,
  };
}
