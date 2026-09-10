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
FICHIER_MANIFESTE = "data/covers-bnf.json"
REQUETES_PAR_SECONDE = 2.0
TYPES_IMAGE = ("image/jpeg", "image/png")

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


def cibles():
    source = json.load(open(SOURCE_COLLECTION, encoding="utf-8"))
    tomes, annonces = [], []
    for serie in source["series"]:
        for edition in serie["editions"]:
            for volume in edition.get("volumes", []):
                if not volume.get("couvertureUrl") and volume.get("isbn"):
                    tomes.append((edition["slug"], volume["numero"], volume["isbn"]))
            for sortie in edition.get("sorties", []):
                if not sortie.get("couvertureUrl") and sortie.get("isbn"):
                    annonces.append((edition["slug"], sortie["numero"], sortie["isbn"]))
    return tomes, annonces


def telecharger(isbn):
    patienter()
    requete = urllib.request.Request(
        f"{SERVICE_COUVERTURES}?ISBN={isbn}&couverture=1",
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


def acquerir(lot, manifeste, libelle):
    obtenues = 0
    absentes = []
    for index, (slug, numero, isbn) in enumerate(lot, start=1):
        if numero in manifeste.get(slug, []):
            continue
        chemin = f"{RACINE_COUVERTURES}/{slug}/{numero}.webp"
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
    tomes, annonces = cibles()
    manifeste = charger_json(FICHIER_MANIFESTE, {})

    print(f"{len(tomes)} tomes et {len(annonces)} sorties sans couverture mais avec un ISBN")
    print("La BnF plafonne a 150 px de haut : ces images sont un pis-aller assume.")
    print()

    absentes = acquerir(tomes, manifeste, "tomes")
    absentes += acquerir(annonces, manifeste, "sorties annoncees")

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
