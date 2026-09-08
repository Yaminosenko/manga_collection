import csv
import datetime
import glob
import io
import json
import os
import re
import sys
import unicodedata

DOSSIER_DEFAUT = os.environ.get("PLANNING_DIR", "data/planning")
FICHIER_MANIFESTE = "data/catalogue.json"
FICHIER_CONTROLES = "data/catalogue-controles.json"

PREFIXES_LIVRE = ("978", "979")
LONGUEUR_EAN = 13
ECHANTILLON_CONTROLE = 40

MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12,
}

MARQUEURS_EDITION = (
    "nouvelle edition",
    "coffret",
    "collector",
    "perfect",
    "integrale",
    "prestige",
    "edition double",
    "edition speciale",
    "edition reliee",
    "edition souple",
    "edition limitee",
    "deluxe",
    "artbook",
    "fanbook",
    "roman",
    "light novel",
    "agenda",
    "calendrier",
    "coloriage",
)

ARTICLES_INVERSES = {
    "l": "L'",
    "l'": "L'",
    "le": "Le ",
    "la": "La ",
    "les": "Les ",
}

MOTIF_VOLUME = re.compile(r"\bVol\.\s*(\d{1,3})\b")
MOTIF_SEPARATEUR = re.compile(r"\s+[-–]\s+")
MOTIF_ARTICLE = re.compile(r"^(.*?)\s*\((l'|l|le|la|les)\)\s*$", re.IGNORECASE)


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


def desinverser_segment(segment):
    trouve = MOTIF_ARTICLE.match(segment)
    if not trouve:
        return segment, False
    corps = trouve.group(1).strip()
    if not corps:
        return segment, False
    return ARTICLES_INVERSES[trouve.group(2).lower()] + corps, True


def desinverser(titre):
    segments = MOTIF_SEPARATEUR.split(titre)
    resultats = [desinverser_segment(segment) for segment in segments]
    touche = any(change for _, change in resultats)
    return " - ".join(texte for texte, _ in resultats), touche


def est_marqueur(segment):
    reduit = normaliser(segment)
    return any(normaliser(marqueur) in reduit for marqueur in MARQUEURS_EDITION)


def decouper(titre):
    segments = MOTIF_SEPARATEUR.split(titre)
    if len(segments) >= 2 and est_marqueur(segments[-1]):
        return " - ".join(segments[:-1]).strip(), segments[-1].strip()
    return titre.strip(), None


def lire_ean(brut):
    ean = (brut or "").strip()
    if len(ean) != LONGUEUR_EAN or not ean.isdigit():
        return None, None
    if not ean.startswith(PREFIXES_LIVRE):
        return None, ean
    return ean, None


def lire_fichiers(dossier):
    fichiers = sorted(glob.glob(os.path.join(dossier, "*.csv")), key=str.lower)
    if not fichiers:
        raise SystemExit(f"aucun CSV dans {dossier}")
    lignes = []
    for chemin in fichiers:
        with io.open(chemin, encoding="utf-8-sig", newline="") as fichier:
            lignes += list(csv.DictReader(fichier))
    return fichiers, lignes


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    dossier = sys.argv[1] if len(sys.argv) > 1 else DOSSIER_DEFAUT
    if not os.path.isdir(dossier):
        raise SystemExit(
            f"{dossier} est introuvable. Les CSV manga-news ne sont pas versionnes : "
            "les telecharger, puis passer le dossier en argument ou definir PLANNING_DIR."
        )

    fichiers, lignes = lire_fichiers(dossier)
    print(f"{len(fichiers)} fichiers, {len(lignes)} lignes lues")

    parutions = {}
    doublons = []
    sans_date = 0
    eans_non_livre = []
    desinversions = []
    marqueurs = []
    sans_numero = 0

    for ligne in lignes:
        titre = (ligne.get("Titre") or "").strip()
        date = lire_date(ligne.get("Date"))
        if not titre or date is None:
            sans_date += 1
            continue

        trouve = MOTIF_VOLUME.search(titre)
        numero = int(trouve.group(1)) if trouve else None
        if numero is None:
            sans_numero += 1
        reste = (titre[: trouve.start()] if trouve else titre).strip(" -–")

        racine, marqueur = decouper(reste)
        serie_titre, desinverse = desinverser(racine)
        ean, ean_rejete = lire_ean(ligne.get("Ean"))

        entree = {
            "ean": ean,
            "titreBrut": titre,
            "serieTitre": serie_titre,
            "serieNormalise": normaliser(serie_titre),
            "marqueurEdition": marqueur,
            "numero": numero,
            "editeur": (ligne.get("Editeur") or "").strip() or None,
            "date": date.isoformat(),
        }

        cle = (titre, entree["date"])
        if cle in parutions:
            doublons.append(entree)
            continue
        parutions[cle] = entree

        if ean_rejete:
            eans_non_livre.append({"ean": ean_rejete, "titreBrut": titre, "date": entree["date"]})
        if desinverse:
            desinversions.append({"titreBrut": titre, "serieTitre": serie_titre})
        if marqueur:
            marqueurs.append({"titreBrut": titre, "serieTitre": serie_titre, "marqueurEdition": marqueur})

    liste = sorted(parutions.values(), key=lambda p: (p["date"], p["titreBrut"]))
    json.dump({"parutions": liste}, io.open(FICHIER_MANIFESTE, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    controles = {
        "desinversions": desinversions[:ECHANTILLON_CONTROLE],
        "marqueurs": marqueurs[:ECHANTILLON_CONTROLE],
        "eansNonLivre": eans_non_livre,
        "doublons": doublons,
    }
    json.dump(controles, io.open(FICHIER_CONTROLES, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)

    series = {p["serieNormalise"] for p in liste if p["serieNormalise"]}
    avec_ean = sum(1 for p in liste if p["ean"])
    dates = [p["date"] for p in liste]

    print(f"{len(liste)} parutions retenues, {len(series)} series distinctes")
    print(f"couverture : {min(dates)} -> {max(dates)}")
    print(f"{avec_ean} avec EAN livre ({100 * avec_ean / len(liste):.1f}%), "
          f"{len(eans_non_livre)} EAN non livre mis a null")
    print(f"{sans_numero} lignes sans Vol.N, numero laisse a null")
    print(f"{len(desinversions)} titres desinverses, {len(marqueurs)} marqueurs d'edition detectes")
    if sans_date:
        print(f"{sans_date} lignes ignorees faute de titre ou de date lisible")
    if doublons:
        print(f"{len(doublons)} doublons (titreBrut, date) ecartes -- voir {FICHIER_CONTROLES}")

    print(f"\nmanifeste ecrit dans {FICHIER_MANIFESTE}")
    print(f"controles a relire dans {FICHIER_CONTROLES}")


if __name__ == "__main__":
    main()
