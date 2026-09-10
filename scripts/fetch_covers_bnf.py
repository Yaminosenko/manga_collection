import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from fetch_covers import RACINE_COUVERTURES, SOURCE_COLLECTION, enregistrer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

USER_AGENT = "manga-collection/0.1 (application personnelle non commerciale)"
SERVICE_COUVERTURES = "https://openapi.bnf.fr/couverture/image/image/recupererImage"
PREMIERE_DE_COUVERTURE = 1
LARGEUR_DEMANDEE, HAUTEUR_DEMANDEE = 512, 720
FICHIER_MANIFESTE = "data/covers-bnf.json"
REQUETES_PAR_SECONDE = 2.0
TYPES_IMAGE = ("image/jpeg", "image/png")
SOURCE_BNF = "bnf"
REFAIRE = "--refaire"

dernier_appel = 0.0


def patienter():
    global dernier_appel
    minimum = 1.0 / REQUETES_PAR_SECONDE
    ecart = time.monotonic() - dernier_appel
    if ecart < minimum:
        time.sleep(minimum - ecart)
    dernier_appel = time.monotonic()


def charger_json(chemin, defaut):
    try:
        return json.load(open(chemin, encoding="utf-8"))
    except Exception:
        return defaut


def a_reprendre(entree, refaire):
    if not entree.get("isbn"):
        return False
    if not entree.get("couvertureUrl"):
        return True
    return refaire and entree.get("sourceCouverture") == SOURCE_BNF


def cibles(refaire):
    source = json.load(open(SOURCE_COLLECTION, encoding="utf-8"))
    tomes, annonces = [], []
    for serie in source["series"]:
        for edition in serie["editions"]:
            for volume in edition.get("volumes", []):
                if a_reprendre(volume, refaire):
                    tomes.append((edition["slug"], volume["numero"], volume["isbn"]))
            for sortie in edition.get("sorties", []):
                if a_reprendre(sortie, refaire):
                    annonces.append((edition["slug"], sortie["numero"], sortie["isbn"]))
    return tomes, annonces


def telecharger(isbn):
    patienter()
    requete = urllib.request.Request(
        f"{SERVICE_COUVERTURES}?EAN={isbn}&couverture={PREMIERE_DE_COUVERTURE}"
        f"&taille=originale&largeur={LARGEUR_DEMANDEE}&hauteur={HAUTEUR_DEMANDEE}",
        headers={"User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(requete, timeout=25) as reponse:
            type_contenu = (reponse.headers.get("Content-Type") or "").split(";")[0]
            if type_contenu not in TYPES_IMAGE:
                return None
            return reponse.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return None


def acquerir(lot, manifeste, libelle, refaire):
    obtenues = 0
    absentes = []
    for index, (slug, numero, isbn) in enumerate(lot, start=1):
        chemin = f"{RACINE_COUVERTURES}/{slug}/{numero}.webp"
        if not refaire:
            if numero in manifeste.get(slug, []):
                continue
            if os.path.exists(chemin):
                manifeste.setdefault(slug, []).append(numero)
                continue

        octets = telecharger(isbn)
        if octets is None:
            absentes.append(f"{slug} t.{numero}")
            print(f"  {index:>3}/{len(lot)}  {slug[:34]:34} t.{numero:<3} absente")
            sys.stdout.flush()
            continue

        try:
            enregistrer(octets, chemin)
        except Exception as erreur:
            absentes.append(f"{slug} t.{numero} ({erreur})")
            continue

        manifeste.setdefault(slug, []).append(numero)
        obtenues += 1
        poids = os.path.getsize(chemin) / 1024
        print(f"  {index:>3}/{len(lot)}  {slug[:34]:34} t.{numero:<3} {poids:.0f} Ko")
        sys.stdout.flush()

    print(f"{libelle} : {obtenues} obtenues, {len(absentes)} absentes")
    return absentes


def main():
    refaire = REFAIRE in sys.argv
    tomes, annonces = cibles(refaire)
    manifeste = charger_json(FICHIER_MANIFESTE, {})

    print(f"{len(tomes)} tomes et {len(annonces)} sorties visees")
    print(f"cote demandee a la BnF : {LARGEUR_DEMANDEE}x{HAUTEUR_DEMANDEE} maximum, proportions respectees")
    if refaire:
        print(f"{REFAIRE} : les couvertures deja marquees « {SOURCE_BNF} » sont reprises")
    print()

    absentes = acquerir(tomes, manifeste, "tomes", refaire)
    absentes += acquerir(annonces, manifeste, "sorties annoncees", refaire)

    for slug in manifeste:
        manifeste[slug] = sorted(set(manifeste[slug]))
    json.dump(manifeste, open(FICHIER_MANIFESTE, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)

    total = sum(len(v) for v in manifeste.values())
    print()
    print(f"manifeste : {FICHIER_MANIFESTE}, {total} couvertures")
    if absentes:
        print(f"sans notice illustree a la BnF ({len(absentes)}) :")
        for entree in absentes:
            print(f"    {entree}")
    print()
    print("Relire le manifeste, puis npm run covers:upload.")


if __name__ == "__main__":
    main()
