import json
import re
import subprocess
import time
import unicodedata
import urllib.parse

USER_AGENT = "manga-collection/0.1 (application personnelle)"
SRU_ENDPOINT = "https://catalogue.bnf.fr/api/SRU"
ANILIST_ENDPOINT = "https://graphql.anilist.co"

SOURCE_BASE = "data/backup.json"
SOURCE_ANILIST = "data/anilist.json"
FICHIER_MANIFESTE = "data/publication.json"

NOM_EDITION_SIMPLE = "Edition simple"
NOTICES_MAX = 100
DELAI_BNF = 0.4
LOT_ANILIST = 50
DELAI_ANILIST = 2.2
NUMERO_MAXIMUM = 300
MOTS_VIDES = {"the", "le", "la", "les", "de", "du", "des", "of", "a", "an", "and", "et"}
LONGUEUR_MOT_SIGNIFIANT = 3

MOTIFS_NUMERO = (
    re.compile(r"[Tt]ome\s*(\d{1,3})(?!\s*[.,]\s*\d)"),
    re.compile(r"[Vv]ol\.?\s*(\d{1,3})(?!\s*[.,]\s*\d)"),
    re.compile(r"\bT\.?\s*(\d{1,3})(?!\s*[.,]\s*\d)"),
    re.compile(r"[.:]\s*(\d{1,3})(?!\s*[.,]\s*\d)"),
)

MARQUEURS_AUTRE_EDITION = (
    "prestige",
    "collector",
    "coffret",
    "integrale",
    "perfect",
    "deluxe",
    "double",
    "hokage",
    "edition",
)

REQUETE_ANILIST = (
    "query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:MANGA)"
    "{id volumes status}}}"
)


def sans_accent(texte):
    decompose = unicodedata.normalize("NFKD", texte or "")
    return "".join(c for c in decompose if not unicodedata.combining(c))


def normaliser(texte):
    return sans_accent(texte).lower()


def curl(url, corps=None):
    commande = ["curl", "-s", "--fail", "-m", "45", "-A", USER_AGENT]
    if corps:
        commande += ["-X", "POST", "-H", "Content-Type: application/json", "-d", corps]
    resultat = subprocess.run(commande + [url], capture_output=True)
    if resultat.returncode != 0 or not resultat.stdout:
        raise RuntimeError(f"echec curl (code {resultat.returncode})")
    return resultat.stdout.decode("utf-8", "replace")


def jetons_auteur(auteur):
    mots = re.split(r"[^\wÀ-ÿ]+", normaliser(auteur))
    return {m for m in mots if len(m) >= LONGUEUR_MOT_SIGNIFIANT and m not in MOTS_VIDES}


def porte_autre_edition(titre):
    parentheses = re.findall(r"\(([^)]*)\)", normaliser(titre))
    return any(
        marqueur in contenu for contenu in parentheses for marqueur in MARQUEURS_AUTRE_EDITION
    )


def numero_du_titre(titre):
    sans_parentheses = re.sub(r"\([^)]*\)", "", titre)
    for motif in MOTIFS_NUMERO:
        trouve = motif.search(sans_parentheses)
        if trouve:
            valeur = int(trouve.group(1))
            if 1 <= valeur <= NUMERO_MAXIMUM:
                return valeur
    return None


def interroger_bnf(titre):
    requete = urllib.parse.urlencode({
        "version": "1.2",
        "operation": "searchRetrieve",
        "query": f'bib.title all "{titre}" and bib.doctype any "a"',
        "recordSchema": "dublincore",
        "maximumRecords": str(NOTICES_MAX),
    })
    time.sleep(DELAI_BNF)
    xml = curl(f"{SRU_ENDPOINT}?{requete}")
    notices = []
    for bloc in re.findall(r"<srw:recordData>(.*?)</srw:recordData>", xml, re.S):
        titre_notice = re.search(r"<dc:title[^>]*>(.*?)</dc:title>", bloc, re.S)
        signatures = re.findall(r"<dc:(?:creator|contributor)[^>]*>(.*?)</dc:\w+>", bloc, re.S)
        dates = re.findall(r"<dc:date[^>]*>(.*?)</dc:date>", bloc, re.S)
        notices.append({
            "titre": titre_notice.group(1).strip() if titre_notice else "",
            "signatures": " ".join(signatures),
            "annee": dates[0] if dates else None,
        })
    return notices


def tomes_parus_bnf(titre, auteur):
    try:
        notices = interroger_bnf(titre)
    except Exception as erreur:
        return {"erreur": str(erreur)}

    jetons = jetons_auteur(auteur)
    numeros, annees, retenues = {}, {}, 0

    for notice in notices:
        contexte = normaliser(f"{notice['signatures']} {notice['titre']}")
        if jetons and not any(jeton in contexte for jeton in jetons):
            continue
        if porte_autre_edition(notice["titre"]):
            continue
        retenues += 1
        numero = numero_du_titre(notice["titre"])
        if numero is None:
            continue
        numeros[numero] = notice["titre"]
        if notice["annee"]:
            annees[numero] = notice["annee"]

    if not numeros:
        return {"notices": len(notices), "retenues": retenues, "maximum": None}

    maximum = max(numeros)
    return {
        "notices": len(notices),
        "retenues": retenues,
        "lus": len(numeros),
        "maximum": maximum,
        "trous": [n for n in range(1, maximum + 1) if n not in numeros],
        "annee_du_dernier": annees.get(maximum),
        "titre_du_dernier": numeros[maximum],
    }


def anilist_par_identifiants(identifiants):
    resultats = {}
    for debut in range(0, len(identifiants), LOT_ANILIST):
        lot = identifiants[debut:debut + LOT_ANILIST]
        time.sleep(DELAI_ANILIST)
        charge = json.loads(curl(
            ANILIST_ENDPOINT,
            corps=json.dumps({"query": REQUETE_ANILIST, "variables": {"ids": lot}}),
        ))
        for media in (charge.get("data") or {}).get("Page", {}).get("media") or []:
            resultats[media["id"]] = {
                "volumes": media.get("volumes"),
                "statut": media.get("status"),
            }
    return resultats


def editions_visees():
    base = json.load(open(SOURCE_BASE, encoding="utf-8"))
    visees = []
    for serie in base["series"]:
        for edition in serie["editions"]:
            if sans_accent(edition["nom"]) == NOM_EDITION_SIMPLE:
                visees.append((serie, edition))
    return visees


def main():
    anilist = json.load(open(SOURCE_ANILIST, encoding="utf-8"))
    cibles = editions_visees()

    identifiants = sorted({
        anilist[serie["slug"]]["id"]
        for serie, _ in cibles
        if anilist.get(serie["slug"])
    })
    print(f"{len(identifiants)} identifiants AniList a interroger")
    metadonnees = anilist_par_identifiants(identifiants)
    print(f"{len(metadonnees)} reponses AniList\n")

    manifeste = {}
    for index, (serie, edition) in enumerate(cibles, start=1):
        correspondance = anilist.get(serie["slug"])
        japonais = metadonnees.get(correspondance["id"]) if correspondance else None
        bnf = tomes_parus_bnf(serie["titre"], serie["auteur"])

        manifeste[edition["slug"]] = {
            "titre": serie["titre"],
            "tomesParusEnBase": edition["tomesParus"],
            "bnf": bnf,
            "anilist": japonais,
        }
        json.dump(manifeste, open(FICHIER_MANIFESTE, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2, sort_keys=True)

        maximum = bnf.get("maximum")
        ecart = "" if maximum is None else f" ecart {maximum - edition['tomesParus']:+d}"
        print(f"  {index:>3}/{len(cibles)}  {edition['slug'][:34]:34} "
              f"base {edition['tomesParus']:>3} | bnf {str(maximum):>4}{ecart}")

    print(f"\nmanifeste ecrit dans {FICHIER_MANIFESTE}")


if __name__ == "__main__":
    main()
