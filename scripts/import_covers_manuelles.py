import io
import json
import os
import re
import sys

from PIL import Image

RACINE_COUVERTURES = "public/covers"
FICHIER_MANIFESTE = "data/covers.json"
FICHIER_ANNONCES = "data/covers-annonces.json"
SOURCE_BASE = "data/backup.json"
LARGEUR, HAUTEUR = 256, 360
QUALITE_WEBP = 82
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff")
MOTIF_NUMERO = re.compile(r"(\d{1,3})")


def enregistrer(chemin_source, chemin_cible):
    image = Image.open(chemin_source).convert("RGB")
    ratio_cible = LARGEUR / HAUTEUR
    largeur, hauteur = image.size
    if largeur / hauteur > ratio_cible:
        nouvelle = int(hauteur * ratio_cible)
        marge = (largeur - nouvelle) // 2
        image = image.crop((marge, 0, marge + nouvelle, hauteur))
    else:
        nouvelle = int(largeur / ratio_cible)
        marge = (hauteur - nouvelle) // 2
        image = image.crop((0, marge, largeur, marge + nouvelle))
    image = image.resize((LARGEUR, HAUTEUR), Image.LANCZOS)
    os.makedirs(os.path.dirname(chemin_cible), exist_ok=True)
    image.save(chemin_cible, "WEBP", quality=QUALITE_WEBP, method=6)


def charger_json(chemin, defaut):
    try:
        return json.load(io.open(chemin, encoding="utf-8"))
    except Exception:
        return defaut


def attendus_par_edition():
    base = charger_json(SOURCE_BASE, {"series": []})
    parus, annonces = {}, {}
    for serie in base["series"]:
        for edition in serie["editions"]:
            parus[edition["slug"]] = {v["numero"] for v in edition["volumes"]}
            annonces[edition["slug"]] = {s["numero"] for s in edition.get("sorties", [])}
    return parus, annonces


def numero_du_fichier(nom):
    trouve = MOTIF_NUMERO.search(os.path.splitext(nom)[0])
    return int(trouve.group(1)) if trouve else None


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage : python scripts/import_covers_manuelles.py <dossier>")
    racine = sys.argv[1]
    if not os.path.isdir(racine):
        raise SystemExit(f"{racine} n'est pas un dossier")

    parus, annonces = attendus_par_edition()
    manifeste = charger_json(FICHIER_MANIFESTE, {})
    manifeste_annonces = charger_json(FICHIER_ANNONCES, {})

    inconnus, ignores, convertis = [], [], 0

    for slug in sorted(os.listdir(racine)):
        dossier = os.path.join(racine, slug)
        if not os.path.isdir(dossier):
            continue
        if slug not in parus:
            inconnus.append(slug)
            continue

        retenus_parus, retenus_annonces = [], []
        for nom in sorted(os.listdir(dossier)):
            if not nom.lower().endswith(EXTENSIONS):
                continue
            numero = numero_du_fichier(nom)
            if numero is None:
                ignores.append(f"{slug}/{nom} : aucun numero lisible")
                continue
            if numero in parus[slug]:
                retenus_parus.append(numero)
            elif numero in annonces[slug]:
                retenus_annonces.append(numero)
            else:
                ignores.append(f"{slug}/{nom} : le tome {numero} n'existe pas en base")
                continue
            try:
                enregistrer(os.path.join(dossier, nom), f"{RACINE_COUVERTURES}/{slug}/{numero}.webp")
                convertis += 1
            except Exception as erreur:
                ignores.append(f"{slug}/{nom} : {erreur}")

        if retenus_parus:
            manifeste[slug] = sorted(set(manifeste.get(slug, [])) | set(retenus_parus))
        if retenus_annonces:
            manifeste_annonces[slug] = sorted(
                set(manifeste_annonces.get(slug, [])) | set(retenus_annonces))
        if retenus_parus or retenus_annonces:
            print(f"  {slug[:40]:40} {len(retenus_parus)} tomes"
                  f"{f' + {len(retenus_annonces)} annonces' if retenus_annonces else ''}")

    json.dump(manifeste, io.open(FICHIER_MANIFESTE, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)
    json.dump(manifeste_annonces, io.open(FICHIER_ANNONCES, "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)

    print(f"\n{convertis} couvertures converties en {LARGEUR}x{HAUTEUR} WebP")
    if inconnus:
        print(f"\ndossiers sans edition correspondante ({len(inconnus)}) :")
        for slug in inconnus:
            print(f"  {slug}")
    if ignores:
        print(f"\nfichiers ecartes ({len(ignores)}) :")
        for ligne in ignores:
            print(f"  {ligne}")
    print("\nenchainer avec : npm run covers:upload")


if __name__ == "__main__":
    main()
