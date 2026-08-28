"""Convertit l'export CSV du Google Sheet en JSON normalise, pret a seeder.

Usage: python scripts/import_sheet.py data/export.csv data/collection.json
"""

import csv
import json
import re
import sys
import unicodedata
from collections import OrderedDict

STATUTS = {
    "FINI": "TERMINEE_SHEET",
    "EN COURS": "EN_COURS",
    "ABANDONNER": "ABANDONNEE",
    "PAUSE": "EN_PAUSE",
    "VENDU": "VENDUE",
}

MARQUEURS_EDITION = OrderedDict([
    ("PRESTIGE EDITION", "Édition Prestige"),
    ("PERFECT EDITION", "Perfect Edition"),
    ("EDITION DOUBLE", "Édition double"),
    ("TOME UNITS", "Tomes unitaires"),
])

SEPARATEURS_GENRES = re.compile(r"[,\-–/]")
SEPARATEURS_TITRE = re.compile(r"\s+[-–]\s+")


class LigneInvalideError(ValueError):
    pass


def slugifier(texte):
    sans_accent = unicodedata.normalize("NFKD", texte).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", sans_accent.lower())).strip("-")


def lire_nombre(brut, champ, titre):
    valeur = (brut or "").replace(",", ".").strip()
    if not valeur:
        raise LigneInvalideError(f"{titre}: champ '{champ}' vide")
    try:
        return float(valeur)
    except ValueError:
        raise LigneInvalideError(f"{titre}: champ '{champ}' non numerique ({brut!r})")


def decouper_liste(brut):
    morceaux = (m.strip() for m in SEPARATEURS_GENRES.split(brut or ""))
    return [m for m in morceaux if m and len(m) > 1]


def separer_titre_et_edition(titre_brut):
    """Isole le format quand le titre porte un marqueur d'edition explicite.

    Un suffixe non reconnu (spin-off comme 'MY HERO ACADEMIA - Smash') reste
    dans le titre : c'est une oeuvre distincte, pas une autre edition.
    """
    titre_majuscule = titre_brut.upper()
    for marqueur, nom_edition in MARQUEURS_EDITION.items():
        if marqueur not in titre_majuscule:
            continue
        position = titre_majuscule.index(marqueur)
        titre_serie = SEPARATEURS_TITRE.split(titre_brut[:position])[0].strip(" -–")
        return titre_serie or titre_brut, nom_edition
    return titre_brut, "Édition simple"


def convertir_ligne(ligne):
    titre_brut = ligne["MANGA"].strip()
    statut_brut = ligne["SITUATION COLLECTION"].strip().upper()
    if statut_brut not in STATUTS:
        raise LigneInvalideError(f"{titre_brut}: statut inconnu ({statut_brut!r})")

    tomes_parus = int(lire_nombre(ligne["NOMBRE TOTAL DE TOMES"], "NOMBRE TOTAL DE TOMES", titre_brut))
    tomes_possedes = int(lire_nombre(ligne["BIBLIOTHEQUE"], "BIBLIOTHEQUE", titre_brut))
    if tomes_possedes > tomes_parus:
        raise LigneInvalideError(f"{titre_brut}: {tomes_possedes} possedes pour {tomes_parus} parus")

    titre_serie, nom_edition = separer_titre_et_edition(titre_brut)
    statut = STATUTS[statut_brut]
    est_complete = tomes_possedes == tomes_parus

    return {
        "serie": {
            "slug": slugifier(titre_serie),
            "titre": titre_serie,
            "auteur": ligne["AUTEUR"].strip(),
            "genres": decouper_liste(ligne["GENRE / TAGS"]),
            "themes": decouper_liste(ligne["THEME"]),
            "cible": ligne["CIBLES"].strip() or None,
        },
        "edition": {
            "slug": slugifier(titre_brut),
            "titreSource": titre_brut,
            "nom": nom_edition,
            "editeur": None,
            "tomesParus": tomes_parus,
            "editionTerminee": None,
            "prixDefaut": round(lire_nombre(ligne["PRIX TOME"], "PRIX TOME", titre_brut), 2),
            "statut": "VENDUE" if statut == "VENDUE" else ("EN_COURS" if statut == "TERMINEE_SHEET" else statut),
            "termineeForcee": statut == "TERMINEE_SHEET" and not est_complete,
            "raisonCompletion": "Reprise du Google Sheet : marquee FINI malgre des tomes manquants." if statut == "TERMINEE_SHEET" and not est_complete else None,
            "aVerifier": not est_complete and statut != "VENDUE",
            "slugMangaNews": None,
        },
        "volumes": [{"numero": n, "possede": n <= tomes_possedes} for n in range(1, tomes_parus + 1)],
    }


def regrouper_par_serie(entrees):
    series = OrderedDict()
    for entree in entrees:
        slug = entree["serie"]["slug"]
        if slug not in series:
            series[slug] = dict(entree["serie"], editions=[])
        edition = dict(entree["edition"], volumes=entree["volumes"])
        series[slug]["editions"].append(edition)
    return list(series.values())


def main(chemin_csv, chemin_json):
    with open(chemin_csv, encoding="utf-8-sig", newline="") as flux:
        lignes = [l for l in csv.DictReader(flux) if l.get("MANGA", "").strip()]

    entrees, rejets = [], []
    for ligne in lignes:
        try:
            entrees.append(convertir_ligne(ligne))
        except LigneInvalideError as erreur:
            rejets.append(str(erreur))

    series = regrouper_par_serie(entrees)
    editions = [e for s in series for e in s["editions"]]
    volumes_possedes = sum(1 for e in editions for v in e["volumes"] if v["possede"])

    with open(chemin_json, "w", encoding="utf-8") as flux:
        json.dump({"series": series}, flux, ensure_ascii=False, indent=2)

    print(f"Lignes lues            : {len(lignes)}")
    print(f"Series                 : {len(series)}")
    print(f"Editions               : {len(editions)}")
    print(f"Tomes possedes         : {volumes_possedes}")
    print(f"Editions a verifier    : {sum(1 for e in editions if e['aVerifier'])}")
    print(f"Completions forcees    : {sum(1 for e in editions if e['termineeForcee'])}")
    print(f"Series multi-editions  : {sum(1 for s in series if len(s['editions']) > 1)}")
    print(f"Ecrit dans             : {chemin_json}")
    if rejets:
        print(f"\n{len(rejets)} ligne(s) rejetee(s) :")
        for rejet in rejets:
            print(f"  - {rejet}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: python scripts/import_sheet.py <export.csv> <collection.json>")
    main(sys.argv[1], sys.argv[2])
