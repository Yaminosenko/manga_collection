import collections
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse

USER_AGENT = "manga-collection/0.1 (application personnelle)"
SRU_ENDPOINT = "https://catalogue.bnf.fr/api/SRU"
SOURCE_BASE = "data/backup.json"
NOTICES_MAX = 50
DELAI_ENTRE_REQUETES = 0.4
RETENUES_MINIMUM = 3
PART_DOMINANTE_MINIMUM = 0.5
LONGUEUR_MOT_SIGNIFIANT = 2

VILLE_FINALE = re.compile(r"\s*\([^)]*\)\s*$")
SUFFIXE_EDITEUR = re.compile(r"\s+(?:éd\.|ed\.|éditions|editions)\s*$", re.I)
MOTS_VIDES = {"the", "le", "la", "les", "de", "du", "des", "of", "a", "an", "and", "et"}


EDITEURS_CANONIQUES = {
    "Éd. Ki-oon": "Ki-oon",
    "Éd. Tonkam": "Tonkam",
    "Pika": "Pika Édition",
    "Pika édition": "Pika Édition",
    "Bamboo édition": "Bamboo Édition",
    "Éditions Akata": "Akata",
    "Dargaud Bénélux-Kana": "Kana",
    "Panini manga": "Panini Manga",
}


def canoniser(editeur):
    return EDITEURS_CANONIQUES.get(editeur, editeur)


def executer_curl(url):
    resultat = subprocess.run(
        ["curl", "-s", "-m", "45", "-A", USER_AGENT, url],
        capture_output=True,
        check=True,
    )
    return resultat.stdout.decode("utf-8", "replace")


def normaliser(texte):
    decompose = unicodedata.normalize("NFKD", (texte or "").lower())
    sans_accent = "".join(c for c in decompose if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]", " ", sans_accent)


def jetons_auteur(auteur):
    jetons = set()
    for partie in re.split(r"[&,/]", auteur or ""):
        for mot in normaliser(partie).split():
            if len(mot) > LONGUEUR_MOT_SIGNIFIANT and mot not in MOTS_VIDES:
                jetons.add(mot)
    return jetons


def variantes_de_recherche(titre):
    nettoye = re.sub(r"[^\w\s'-]", " ", titre, flags=re.UNICODE)
    nettoye = re.sub(r"\s+", " ", nettoye).strip()
    variantes = [nettoye]
    mots = [m for m in nettoye.split() if len(m) > LONGUEUR_MOT_SIGNIFIANT]
    if len(mots) > 2:
        variantes.append(" ".join(mots[:2]))
    if mots:
        variantes.append(mots[0])
    return [v for i, v in enumerate(variantes) if v and v not in variantes[:i]]


def interroger_bnf(terme):
    requete = urllib.parse.urlencode({
        "version": "1.2",
        "operation": "searchRetrieve",
        "query": f'bib.title all "{terme}" and bib.doctype any "a"',
        "recordSchema": "dublincore",
        "maximumRecords": str(NOTICES_MAX),
    })
    try:
        xml = executer_curl(f"{SRU_ENDPOINT}?{requete}")
    except Exception:
        return []
    notices = []
    for bloc in re.findall(r"<srw:recordData>(.*?)</srw:recordData>", xml, re.S):
        editeurs = re.findall(r"<dc:publisher[^>]*>(.*?)</dc:publisher>", bloc, re.S)
        signatures = re.findall(r"<dc:(?:creator|contributor)[^>]*>(.*?)</dc:\w+>", bloc, re.S)
        titre_notice = re.search(r"<dc:title[^>]*>(.*?)</dc:title>", bloc, re.S)
        notices.append({
            "titre": titre_notice.group(1) if titre_notice else "",
            "editeurs": [SUFFIXE_EDITEUR.sub("", VILLE_FINALE.sub("", e)).strip() for e in editeurs],
            "signatures": signatures,
        })
    return notices


def deduire_editeur(titre, auteur):
    attendus = jetons_auteur(auteur)
    for terme in variantes_de_recherche(titre):
        notices = interroger_bnf(terme)
        time.sleep(DELAI_ENTRE_REQUETES)
        if not notices:
            continue
        retenues = [
            n for n in notices
            if attendus & set(normaliser(" ".join(n["signatures"]) + " " + n["titre"]).split())
        ]
        if len(retenues) < RETENUES_MINIMUM:
            continue
        compte = collections.Counter(e for n in retenues for e in n["editeurs"] if e)
        if not compte:
            continue
        editeur, occurrences = compte.most_common(1)[0]
        part = occurrences / sum(compte.values())
        if part < PART_DOMINANTE_MINIMUM:
            return None, len(retenues), part, editeur
        return canoniser(editeur), len(retenues), part, editeur
    return None, 0, 0.0, None


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if not os.path.exists(SOURCE_BASE):
        sys.exit(f"{SOURCE_BASE} absent : lancer npm run db:backup d'abord")

    source = json.load(open(SOURCE_BASE, encoding="utf-8"))
    cibles = [
        (edition["slug"], serie["titre"], serie["auteur"])
        for serie in source["series"]
        for edition in serie["editions"]
    ]

    resultats = {}
    incertains = []
    for index, (slug, titre, auteur) in enumerate(cibles, start=1):
        editeur, retenues, part, dominant = deduire_editeur(titre, auteur)
        if editeur:
            resultats[slug] = editeur
        else:
            incertains.append((slug, titre, retenues, part, dominant))
        print(f"  {index:>3}/{len(cibles)}  {slug[:34]:34} {editeur or '—'}")
        sys.stdout.flush()

    json.dump(resultats, open("data/publishers.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)

    print(f"\nediteurs trouves      : {len(resultats)} / {len(cibles)}")
    print(f"laisses vides         : {len(incertains)}")
    repartition = collections.Counter(resultats.values())
    print(f"editeurs distincts    : {len(repartition)}")
    for nom, n in repartition.most_common(12):
        print(f"    {n:>3}  {nom}")
    if incertains:
        print("\nnon conclus :")
        for slug, titre, retenues, part, dominant in incertains:
            detail = f"{retenues} notices retenues, dominant {dominant} a {part:.0%}" if retenues else "aucune notice"
            print(f"    {slug[:34]:34} {detail}")


main()
