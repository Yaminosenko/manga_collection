import csv
import datetime
import glob
import io
import json
import os
import re
import sys
import unicodedata

DOSSIER_DEFAUT = "E:/Download/manga_planning_2024-2026"
SOURCE_BASE = "data/backup.json"
FICHIER_MANIFESTE = "data/planning.json"
NOM_EDITION_SIMPLE = "editionsimple"

MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12,
}

MARQUEURS_AUTRE_EDITION = (
    "nouvelle edition",
    "coffret",
    "collector",
    "perfect",
    "integrale",
    "prestige",
    "edition double",
    "edition speciale",
    "deluxe",
    "artbook",
    "fanbook",
    "roman",
    "light novel",
    "agenda",
    "calendrier",
    "coloriage",
)

TITRES_MANUELS = {
    "itchi-the-witch": "Ichi the Witch",
    "les-legendaires-saga": "Légendaires (les) - Saga",
    "nier-automata-op-pearl-harbor": "Nier: Automata - Opération Pearl Harbor",
    "one-puch-man": "One-Punch Man",
    "oriant-samurai-quest": "Orient - Samurai Quest",
    "smoking-behind-the-supermarket": "Smoking behind the Supermarket with You",
    "the-unwanted-unded-adventurer": "The Unwanted Undead Adventurer",
    "why-nobody-remember-my-world": "Why Nobody Remembers My World ?",
    "yusei-no-last-boss": "Yasei no Last Boss",
}

MOTIF_VOLUME = re.compile(r"\bVol\.\s*(\d{1,3})\b")
LONGUEUR_EAN = 13


def sans_accent(texte):
    decompose = unicodedata.normalize("NFKD", texte or "")
    return "".join(c for c in decompose if not unicodedata.combining(c))


def normaliser(texte):
    return re.sub(r"[^a-z0-9]", "", sans_accent(texte).lower())


def lire_date(brut):
    trouve = re.match(r"\s*(\d{1,2})\s+(\S+)\s+(\d{4})", brut or "")
    if not trouve:
        return None
    mois = MOIS.get(sans_accent(trouve.group(2)).lower())
    if not mois:
        return None
    try:
        return datetime.date(int(trouve.group(3)), mois, int(trouve.group(1)))
    except ValueError:
        return None


def porte_autre_edition(titre):
    reduit = normaliser(titre)
    return any(normaliser(marqueur) in reduit for marqueur in MARQUEURS_AUTRE_EDITION)


def editions_simples():
    base = json.load(io.open(SOURCE_BASE, encoding="utf-8"))
    index = {}
    for serie in base["series"]:
        for edition in serie["editions"]:
            if normaliser(edition["nom"]) == NOM_EDITION_SIMPLE:
                fiche = {
                    "slug": edition["slug"],
                    "titre": serie["titre"],
                    "tomesParusEnBase": edition["tomesParus"],
                }
                index[normaliser(serie["titre"])] = fiche
                manuel = TITRES_MANUELS.get(edition["slug"])
                if manuel:
                    index[normaliser(manuel)] = fiche
    return index


def lire_planning(dossier):
    fichiers = sorted(glob.glob(os.path.join(dossier, "*.csv")))
    if not fichiers:
        raise SystemExit(f"aucun CSV dans {dossier}")
    lignes = []
    for chemin in fichiers:
        lignes += list(csv.DictReader(io.open(chemin, encoding="utf-8-sig")))
    return fichiers, lignes


def main():
    dossier = sys.argv[1] if len(sys.argv) > 1 else DOSSIER_DEFAUT
    aujourd_hui = datetime.date.today()
    index = editions_simples()
    fichiers, lignes = lire_planning(dossier)
    print(f"{len(fichiers)} fichiers, {len(lignes)} lignes, {len(index)} editions simples en base")

    manifeste = {}
    a_paraitre = {}
    ignores_marqueur = 0

    for ligne in lignes:
        titre = ligne.get("Titre") or ""
        trouve = MOTIF_VOLUME.search(titre)
        if not trouve:
            continue
        racine = titre[: trouve.start()].strip(" -\u2013")
        if porte_autre_edition(racine):
            ignores_marqueur += 1
            continue
        cible = index.get(normaliser(racine))
        if not cible:
            continue

        date = lire_date(ligne.get("Date"))
        if date is None:
            continue
        numero = int(trouve.group(1))
        ean = (ligne.get("Ean") or "").strip()
        entree = {
            "date": date.isoformat(),
            "isbn": ean if len(ean) == LONGUEUR_EAN and ean.isdigit() else None,
            "editeur": (ligne.get("Editeur") or "").strip() or None,
        }

        if date <= aujourd_hui:
            fiche = manifeste.setdefault(cible["slug"], {
                "titre": cible["titre"],
                "tomesParusEnBase": cible["tomesParusEnBase"],
                "tomes": {},
            })
            fiche["tomes"][str(numero)] = entree
        else:
            a_paraitre.setdefault(cible["slug"], {})[str(numero)] = entree

    for slug, fiche in manifeste.items():
        numeros = [int(n) for n in fiche["tomes"]]
        fiche["maximum"] = max(numeros)
        fiche["aParaitre"] = a_paraitre.get(slug, {})

    for slug, tomes in a_paraitre.items():
        if slug not in manifeste:
            manifeste[slug] = {
                "titre": index[next(k for k, v in index.items() if v["slug"] == slug)]["titre"],
                "tomesParusEnBase": next(v["tomesParusEnBase"] for v in index.values() if v["slug"] == slug),
                "tomes": {},
                "maximum": None,
                "aParaitre": tomes,
            }

    json.dump(manifeste, io.open(FICHIER_MANIFESTE, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)

    tomes = sum(len(f["tomes"]) for f in manifeste.values())
    avec_isbn = sum(1 for f in manifeste.values() for t in f["tomes"].values() if t["isbn"])
    hausses = [(s, f["tomesParusEnBase"], f["maximum"]) for s, f in manifeste.items()
               if f["maximum"] and f["maximum"] > f["tomesParusEnBase"]]
    futurs = sum(len(f["aParaitre"]) for f in manifeste.values())

    print(f"{ignores_marqueur} lignes ecartees par un marqueur d'autre edition")
    print(f"{len(manifeste)} editions appariees, {tomes} tomes dates, {avec_isbn} avec ISBN")
    print(f"{futurs} sorties a venir")
    print(f"\n{len(hausses)} editions ou le planning depasse la base :")
    for slug, base_, maximum in sorted(hausses, key=lambda x: x[1] - x[2]):
        print(f"  {slug[:34]:34} {base_:>3} -> {maximum:>3}  (+{maximum - base_})")
    print(f"\nmanifeste ecrit dans {FICHIER_MANIFESTE}")


if __name__ == "__main__":
    main()
