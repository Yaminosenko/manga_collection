import { DELAI_APPEL_EXTERNE_MS, URL_SRU_BNF } from "@/lib/constants";

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
