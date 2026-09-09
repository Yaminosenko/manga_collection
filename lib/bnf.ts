import { DELAI_APPEL_EXTERNE_MS, URL_SRU_BNF } from "@/lib/constants";

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

function litteralCql(valeur: string): string {
  return valeur.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
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
  const recherche = litteralCql(titre);
  if (recherche === "") {
    return null;
  }

  const requete = new URLSearchParams({
    version: "1.2",
    operation: "searchRetrieve",
    query: `bib.title all "${recherche}" and bib.doctype any "a"`,
    recordSchema: "unimarcxchange",
    maximumRecords: String(NOTICES_MAX),
  });

  let xml: string;
  try {
    const reponse = await fetch(`${URL_SRU_BNF}?${requete}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_APPEL_EXTERNE_MS),
    });
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
  auteurs: string[];
  editeur: string | null;
  annee: string | null;
  format: string | null;
  prixCentimes: number | null;
};

const CODE_FONCTION_AUTEUR = "070";
const TAGS_AUTEUR = ["700", "701"];

function champsRepetes(bloc: string, tag: string): string[] {
  const ouverture = `<mxc:datafield tag="${tag}"`;
  const fermeture = "</mxc:datafield>";
  const trouves: string[] = [];
  let position = 0;
  for (;;) {
    const debut = bloc.indexOf(ouverture, position);
    if (debut === -1) break;
    const fin = bloc.indexOf(fermeture, debut);
    if (fin === -1) break;
    trouves.push(bloc.slice(debut, fin));
    position = fin + fermeture.length;
  }
  return trouves;
}

function valeurSousChamp(champ: string, code: string): string | null {
  const ouverture = `<mxc:subfield code="${code}">`;
  const debut = champ.indexOf(ouverture);
  if (debut === -1) return null;
  const fin = champ.indexOf("</mxc:subfield>", debut);
  return fin === -1 ? null : champ.slice(debut + ouverture.length, fin).trim() || null;
}

function auteursDeLaNotice(bloc: string): string[] {
  const noms: string[] = [];
  for (const tag of TAGS_AUTEUR) {
    for (const champ of champsRepetes(bloc, tag)) {
      if (valeurSousChamp(champ, "4") !== CODE_FONCTION_AUTEUR) continue;
      const nom = valeurSousChamp(champ, "a");
      if (!nom) continue;
      const prenom = valeurSousChamp(champ, "b");
      noms.push(prenom ? `${prenom} ${nom}` : nom);
    }
  }
  return [...new Set(noms)];
}

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
    const reponse = await fetch(`${URL_SRU_BNF}?${requete}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(DELAI_APPEL_EXTERNE_MS),
    });
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
    auteurs: auteursDeLaNotice(bloc),
    editeur: nettoyerEditeur(sousChamp(bloc, "214", "c") ?? sousChamp(bloc, "210", "c")),
    annee: (sousChamp(bloc, "214", "d") ?? sousChamp(bloc, "210", "d") ?? "").match(/\d{4}/)?.[0] ?? null,
    format: sousChamp(bloc, "215", "a"),
    prixCentimes: prixBrut ? centimes(prixBrut) : null,
  };
}
