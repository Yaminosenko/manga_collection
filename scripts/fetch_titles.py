import collections
import difflib
import html
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse

from import_planning import TITRES_MANUELS

USER_AGENT = "manga-collection/0.1 (application personnelle)"
SRU_ENDPOINT = "https://catalogue.bnf.fr/api/SRU"
SOURCE_BASE = "data/backup.json"
SOURCE_ANILIST = "data/anilist.json"
FICHIER_MANIFESTE = "data/titles.json"
NOTICES_MAX = 50
DELAI_ENTRE_REQUETES = 0.4
RETENUES_MINIMUM = 3
PART_DOMINANTE_MINIMUM = 0.4
LONGUEUR_MOT_SIGNIFIANT = 2
LONGUEUR_TETE_MINIMUM = 4
EXEMPLES_NOTICES = 3
SEUIL_FAUTE_DE_FRAPPE = 0.85

MOTS_VIDES = {"the", "le", "la", "les", "de", "du", "des", "of", "a", "an", "and", "et"}

RECHERCHES_MANUELLES = {
    "marimashita-iruma-kun": "Mairimashita Iruma-kun",
    "saga-of-tany-the-evil-youjo-senki": "Tanya the evil",
    "uqholder": "UQ Holder",
}

MARQUEUR_VOLUME = re.compile(
    r"\s*(?:[.:]|\s[-–]\s)\s*(?:vol\.?|t\.?|tome|n[°o])?\s*\d{1,3}\b.*$",
    re.I,
)
PARENTHESE_FINALE = re.compile(r"\s*\([^)]*\)\s*$")
ESPACES = re.compile(r"\s+")


def sans_accent(texte):
    decompose = unicodedata.normalize("NFKD", texte or "")
    return "".join(c for c in decompose if not unicodedata.combining(c))


def normaliser(texte):
    return ESPACES.sub(" ", re.sub(r"[^a-z0-9 ]", " ", sans_accent(texte or "").lower())).strip()


def executer_curl(url):
    resultat = subprocess.run(
        ["curl", "-s", "-m", "45", "-A", USER_AGENT, url],
        capture_output=True,
        check=True,
    )
    return resultat.stdout.decode("utf-8", "replace")


def jetons_auteur(auteur):
    jetons = set()
    for partie in re.split(r"[&,/]", auteur or ""):
        for mot in normaliser(partie).split():
            if len(mot) > LONGUEUR_MOT_SIGNIFIANT and mot not in MOTS_VIDES:
                jetons.add(mot)
    return jetons


def variantes_de_recherche(titre):
    nettoye = ESPACES.sub(" ", re.sub(r"[^\w\s'-]", " ", titre, flags=re.UNICODE)).strip()
    variantes = [nettoye]
    mots = [m for m in nettoye.split() if len(m) > LONGUEUR_MOT_SIGNIFIANT]
    if len(mots) > 2:
        variantes.append(" ".join(mots[:2]))
    if mots:
        variantes.append(mots[0])
    return [v for i, v in enumerate(variantes) if v and v not in variantes[:i]]


def tete_de_serie(titre_notice):
    titre = ESPACES.sub(" ", html.unescape(titre_notice or "").strip())
    coupe = MARQUEUR_VOLUME.sub("", titre).strip()
    if coupe != titre and len(coupe) >= LONGUEUR_TETE_MINIMUM:
        titre = coupe
    for separateur in (". ", " : ", " - "):
        position = titre.find(separateur)
        if position >= LONGUEUR_TETE_MINIMUM:
            titre = titre[:position]
            break
    return PARENTHESE_FINALE.sub("", titre).strip(" .:-")


def titre_sans_volume(titre_notice):
    titre = ESPACES.sub(" ", html.unescape(titre_notice or "").strip())
    coupe = MARQUEUR_VOLUME.sub("", titre).strip()
    if coupe and len(coupe) >= LONGUEUR_TETE_MINIMUM:
        titre = coupe
    return PARENTHESE_FINALE.sub("", titre).strip(" .:-")


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
        titre = re.search(r"<dc:title[^>]*>(.*?)</dc:title>", bloc, re.S)
        signatures = re.findall(r"<dc:(?:creator|contributor)[^>]*>(.*?)</dc:\w+>", bloc, re.S)
        if titre:
            notices.append({"titre": titre.group(1).strip(), "signatures": signatures})
    return notices


def titre_bnf(titre_local, auteur, terme_manuel=None):
    attendus = jetons_auteur(auteur)
    termes = [terme_manuel] if terme_manuel else variantes_de_recherche(titre_local)
    for terme in termes:
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
        compte = collections.Counter(tete_de_serie(n["titre"]) for n in retenues)
        compte.pop("", None)
        if not compte:
            continue
        titre, occurrences = compte.most_common(1)[0]
        part = occurrences / sum(compte.values())
        if part < PART_DOMINANTE_MINIMUM:
            continue
        complets = collections.Counter(titre_sans_volume(n["titre"]) for n in retenues)
        complets.pop("", None)
        exemples = [html.unescape(n["titre"]) for n in retenues[:EXEMPLES_NOTICES]]
        return {
            "titre": titre,
            "complet": complets.most_common(1)[0][0] if complets else titre,
            "notices": len(retenues),
            "part": round(part, 2),
            "exemples": exemples,
        }
    return None


def premiere_majuscule(titre):
    return titre[0].upper() + titre[1:] if titre else titre


def similarite(gauche, droite):
    return difflib.SequenceMatcher(None, normaliser(gauche), normaliser(droite)).ratio()


def proposer(actuel, manuel, bnf, recherche_manuelle=False):
    if manuel:
        return manuel, "manuel"
    if recherche_manuelle and bnf:
        return premiere_majuscule(bnf["titre"]), "bnf+recherche"
    if (
        bnf
        and normaliser(bnf["titre"]) != normaliser(actuel)
        and similarite(bnf["titre"], actuel) >= SEUIL_FAUTE_DE_FRAPPE
    ):
        return premiere_majuscule(bnf["titre"]), "bnf"
    return actuel, "actuel"


def ecarter_collisions(manifeste):
    titres_actuels = collections.Counter(normaliser(e["actuel"]) for e in manifeste.values())
    ecartes = []

    for slug, entree in manifeste.items():
        if not entree["changementOrthographe"]:
            continue
        cible = normaliser(entree["propose"])
        occupe_par_une_autre = titres_actuels[cible] > 0 and cible != normaliser(entree["actuel"])
        deja_propose = any(
            autre is not entree
            and autre["changementOrthographe"]
            and normaliser(autre["propose"]) == cible
            for autre in manifeste.values()
        )
        if occupe_par_une_autre or deja_propose:
            entree["propose"] = entree["actuel"]
            entree["source"] = "collision"
            entree["changementOrthographe"] = False
            ecartes.append(slug)

    return ecartes


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if not os.path.exists(SOURCE_BASE):
        sys.exit(f"{SOURCE_BASE} absent : lancer npm run db:backup d'abord")

    with open(SOURCE_BASE, encoding="utf-8") as flux:
        series = json.load(flux)["series"]
    anilist = {}
    if os.path.exists(SOURCE_ANILIST):
        with open(SOURCE_ANILIST, encoding="utf-8") as flux:
            anilist = json.load(flux)

    manifeste = {}
    orthographe = 0
    accents = 0

    for rang, serie in enumerate(series, 1):
        slug = serie["slug"]
        actuel = serie["titre"]
        manuel = TITRES_MANUELS.get(slug)
        if not manuel:
            for edition in serie["editions"]:
                manuel = manuel or TITRES_MANUELS.get(edition["slug"])
        romaji = (anilist.get(slug) or {}).get("romaji")

        recherche = RECHERCHES_MANUELLES.get(slug)
        bnf = titre_bnf(actuel, serie["auteur"], recherche)
        propose, source = proposer(actuel, manuel, bnf, recherche is not None)

        changement = normaliser(propose) != normaliser(actuel)
        casse = not changement and propose != actuel

        manifeste[slug] = {
            "actuel": actuel,
            "propose": propose,
            "source": source,
            "changementOrthographe": changement,
            "candidats": {
                "manuel": manuel,
                "bnf": bnf["titre"] if bnf else None,
                "bnfComplet": bnf["complet"] if bnf else None,
                "anilist": romaji,
            },
            "notices": bnf["notices"] if bnf else 0,
            "part": bnf["part"] if bnf else None,
            "exemples": bnf["exemples"] if bnf else [],
        }
        if changement:
            orthographe += 1
        elif casse:
            accents += 1

        print(f"[{rang}/{len(series)}] {actuel} -> {propose} ({source})", flush=True)

    collisions = ecarter_collisions(manifeste)
    orthographe = sum(1 for e in manifeste.values() if e["changementOrthographe"])

    ordonne = dict(sorted(
        manifeste.items(),
        key=lambda paire: (not paire[1]["changementOrthographe"], paire[0]),
    ))
    with open(FICHIER_MANIFESTE, "w", encoding="utf-8") as flux:
        json.dump(ordonne, flux, ensure_ascii=False, indent=2)
        flux.write("\n")

    print()
    print(f"Series lues            : {len(series)}")
    print(f"Orthographe changee    : {orthographe}")
    print(f"Casse seule changee    : {accents}")
    print(f"Collisions ecartees    : {len(collisions)}")
    print(f"Sans correspondance    : {sum(1 for e in manifeste.values() if e['source'] == 'actuel')}")
    print(f"Manifeste              : {FICHIER_MANIFESTE}")
    print()
    print("Relire le manifeste avant npm run titles:apply. Les slugs ne changent jamais.")


if __name__ == "__main__":
    main()
