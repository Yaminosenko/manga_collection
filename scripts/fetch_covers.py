import io
import json
import os
import subprocess
import sys
import time
import unicodedata
import urllib.parse
from difflib import SequenceMatcher
from PIL import Image

USER_AGENT = "manga-collection/0.1 (application personnelle non commerciale, autorisee)"
ANILIST_ENDPOINT = "https://graphql.anilist.co"
MANGADEX_API = "https://api.mangadex.org"
MANGADEX_UPLOADS = "https://uploads.mangadex.org/covers"

REQUETES_PAR_SECONDE = 3.0
LARGEUR, HAUTEUR = 256, 360
QUALITE_WEBP = 82
RACINE_COUVERTURES = "public/covers"
FICHIER_IDS = "data/mangadex_ids.json"
FICHIER_MANIFESTE = "data/covers.json"
SOURCE_COLLECTION = "data/backup.json"
NOM_EDITION_SIMPLE = "Edition simple"
LANGUES_PAR_PREFERENCE = ("fr", "ja")
RESULTATS_RECHERCHE = 10
LOT_COUVERTURES = 100
SEUIL_SIMILARITE = 0.86
CANDIDATS_A_VERIFIER = 4
PENALITE_SATELLITE = 0.30
ECART_SCORE_NEGLIGEABLE = 0.02

RECHERCHES_MANUELLES = {
    "je-suis-un-assassin-et-je-surpasse-le-heros":
        "Assassin de Aru Ore no Sutetasu ga Yuusha Yori mo Akiraka ni Tsuyoi Nodaga",
    "kaijin-reijoh": "Kaijin Reijou",
    "mirai-nikki-le-journal-du-futur": "Mirai Nikki",
    "nier-automata-op-pearl-harbor":
        "NieR: Automata: YoRHa Shinjuwan Kouka Sakusen Kiroku",
    "saga-of-tany-the-evil-youjo-senki": "Youjo Senki",
    "saint-seiya-the-lost-canvas-chronicles": "Saint Seiya: The Lost Canvas Gaiden",
    "uqholder": "UQ HOLDER!",
    "why-nobody-remember-my-world": "Naze Boku no Sekai o Daremo Oboeteinai no ka?",
    "pandora-heart-8-5": "Pandora Hearts",
    "yusei-no-last-boss": "Yasei no Last Boss ga Arawareta!",
}

VOLUMES_MANUELS = {
    "pandora-heart-8-5": {1: "8.5"},
}
MARQUEURS_SATELLITE = (
    "pre-serialization",
    "fan colored",
    "colored",
    "doujinshi",
    "anthology",
    "databook",
    "artbook",
    "spin-off",
    "parody",
)

_dernier_appel = [0.0]


def patienter():
    ecart = time.monotonic() - _dernier_appel[0]
    minimum = 1.0 / REQUETES_PAR_SECONDE
    if ecart < minimum:
        time.sleep(minimum - ecart)
    _dernier_appel[0] = time.monotonic()


def curl(url, binaire=False, corps=None, secondes=45):
    patienter()
    commande = ["curl", "-s", "--fail", "-m", str(secondes), "-A", USER_AGENT]
    if corps:
        commande += ["-X", "POST", "-H", "Content-Type: application/json", "-d", corps]
    resultat = subprocess.run(commande + [url], capture_output=True)
    if resultat.returncode != 0 or not resultat.stdout:
        raise RuntimeError(f"echec curl (code {resultat.returncode})")
    return resultat.stdout if binaire else resultat.stdout.decode("utf-8", "replace")


def normaliser(texte):
    decompose = unicodedata.normalize("NFKD", (texte or "").lower())
    sans_accent = "".join(c for c in decompose if not unicodedata.combining(c))
    return "".join(c for c in sans_accent if c.isalnum())


REQUETE_ANILIST = (
    "query($r:String){Page(perPage:1){media(search:$r,type:MANGA)"
    "{title{romaji english native}}}}"
)


def titres_anilist(titre):
    try:
        charge = json.loads(curl(
            ANILIST_ENDPOINT,
            corps=json.dumps({"query": REQUETE_ANILIST, "variables": {"r": titre}}),
        ))
        media = (charge.get("data") or {}).get("Page", {}).get("media") or []
        if not media:
            return []
        titres = media[0]["title"]
        return [titres.get("romaji"), titres.get("native"), titres.get("english")]
    except Exception:
        return []


def noms_du_manga(manga):
    noms = list(manga["attributes"]["title"].values())
    for alternatif in manga["attributes"].get("altTitles", []):
        noms += list(alternatif.values())
    return [nom for nom in noms if nom]


def similarite(gauche, droite):
    return SequenceMatcher(None, gauche, droite).ratio()


def score_du_manga(manga, cibles):
    normalises = [normaliser(nom) for nom in noms_du_manga(manga)]
    meilleur = 0.0
    for candidat in normalises:
        for cible in cibles:
            if not candidat or not cible:
                continue
            meilleur = max(meilleur, similarite(candidat, cible))
    return meilleur


def est_fiche_satellite(manga):
    titres = " ".join(noms_du_manga(manga)).lower()
    return any(marqueur in titres for marqueur in MARQUEURS_SATELLITE)


def compter_couvertures(identifiant):
    try:
        par_langue = couvertures_par_langue(identifiant)
    except Exception:
        return 0
    numeros = set()
    for langue in LANGUES_PAR_PREFERENCE:
        for tomes in par_langue.get(langue, {}).values():
            numeros |= set(tomes)
    return len(numeros)


def trouver_manga(titre, slug=None):
    recherche = RECHERCHES_MANUELLES.get(slug, titre)
    termes = [terme for terme in [recherche] + titres_anilist(recherche) if terme]
    cibles = {normaliser(terme) for terme in [titre] + termes if terme}
    candidats = {}

    for terme in termes:
        requete = urllib.parse.urlencode({
            "title": terme,
            "limit": RESULTATS_RECHERCHE,
            "order[relevance]": "desc",
        })
        try:
            charge = json.loads(curl(f"{MANGADEX_API}/manga?{requete}"))
        except Exception:
            continue
        for manga in charge.get("data", []):
            score = score_du_manga(manga, cibles)
            if score < SEUIL_SIMILARITE:
                continue
            penalite = PENALITE_SATELLITE if est_fiche_satellite(manga) else 0.0
            retenu = score - penalite
            if retenu > candidats.get(manga["id"], -1.0):
                candidats[manga["id"]] = retenu

    if not candidats:
        return None

    ordonnes = sorted(candidats.items(), key=lambda paire: paire[1], reverse=True)
    meilleur_score = ordonnes[0][1]
    tetes = [
        identifiant
        for identifiant, score in ordonnes[:CANDIDATS_A_VERIFIER]
        if meilleur_score - score <= ECART_SCORE_NEGLIGEABLE
    ]
    if len(tetes) == 1:
        return tetes[0]

    return max(tetes, key=compter_couvertures)


def decouper_volume(brut):
    tete, _, suffixe = str(brut).strip().partition(".")
    try:
        return suffixe, int(tete)
    except ValueError:
        return None


def couvertures_par_langue(identifiant):
    par_langue, decalage, total = {}, 0, 1
    while decalage < total:
        requete = urllib.parse.urlencode({
            "manga[]": identifiant,
            "limit": LOT_COUVERTURES,
            "offset": decalage,
        })
        charge = json.loads(curl(f"{MANGADEX_API}/cover?{requete}"))
        total = charge.get("total", 0)
        for couverture in charge.get("data", []):
            attributs = couverture["attributes"]
            brut = attributs.get("volume")
            if not brut:
                continue
            decoupe = decouper_volume(brut)
            if decoupe is None:
                continue
            famille, numero = decoupe
            familles = par_langue.setdefault(attributs.get("locale"), {})
            familles.setdefault(famille, {}).setdefault(numero, attributs["fileName"])
        decalage += LOT_COUVERTURES
    return par_langue


def volumes_designes(familles, correspondance):
    choisis = {}
    for tome, brut in correspondance.items():
        decoupe = decouper_volume(brut)
        if decoupe is None:
            continue
        famille, numero = decoupe
        fichier = familles.get(famille, {}).get(numero)
        if fichier:
            choisis[tome] = fichier
    return choisis


def famille_retenue(familles, tomes_parus):
    if not familles:
        return {}

    def rang(paire):
        famille, tomes = paire
        taille_exacte = 0 if len(tomes) == tomes_parus else 1
        manquants = len([n for n in range(1, tomes_parus + 1) if n not in tomes])
        return (taille_exacte, manquants, famille != "")

    return min(familles.items(), key=rang)[1]


def enregistrer(brut, chemin):
    image = Image.open(io.BytesIO(brut)).convert("RGB")
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
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    image.save(chemin, "WEBP", quality=QUALITE_WEBP, method=6)


def charger_json(chemin, defaut):
    try:
        return json.load(open(chemin, encoding="utf-8"))
    except Exception:
        return defaut


def editions_visees():
    source = json.load(open(SOURCE_COLLECTION, encoding="utf-8"))
    visees = []
    for serie in source["series"]:
        for edition in serie["editions"]:
            nom_sans_accent = unicodedata.normalize("NFKD", edition["nom"])
            nom_sans_accent = "".join(
                c for c in nom_sans_accent if not unicodedata.combining(c))
            if nom_sans_accent == NOM_EDITION_SIMPLE:
                visees.append((edition["slug"], serie["titre"], edition["tomesParus"]))
    return visees


def main():
    cibles = editions_visees()
    identifiants = charger_json(FICHIER_IDS, {})
    manifeste = charger_json(FICHIER_MANIFESTE, {})
    sans_correspondance, sans_couverture = [], []
    telecharges = poids_total = 0

    for index, (slug, titre, tomes_parus) in enumerate(cibles, start=1):
        attendus = list(range(1, tomes_parus + 1))
        deja = {
            numero for numero in attendus
            if os.path.exists(f"{RACINE_COUVERTURES}/{slug}/{numero}.webp")
        }
        if len(deja) == tomes_parus:
            manifeste[slug] = sorted(deja)
            print(f"  {index:>3}/{len(cibles)}  {slug[:32]:32} complet ({tomes_parus})")
            sys.stdout.flush()
            continue

        if not identifiants.get(slug):
            identifiants[slug] = trouver_manga(titre, slug)
            json.dump(identifiants, open(FICHIER_IDS, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=2, sort_keys=True)
        identifiant = identifiants[slug]
        if not identifiant:
            sans_correspondance.append(slug)
            print(f"  {index:>3}/{len(cibles)}  {slug[:32]:32} aucune correspondance")
            sys.stdout.flush()
            continue

        try:
            par_famille = couvertures_par_langue(identifiant)
            correspondance = VOLUMES_MANUELS.get(slug)
            par_langue = {
                langue: (
                    volumes_designes(familles, correspondance)
                    if correspondance
                    else famille_retenue(familles, tomes_parus)
                )
                for langue, familles in par_famille.items()
            }
        except Exception as erreur:
            sans_correspondance.append(slug)
            print(f"  {index:>3}/{len(cibles)}  {slug[:32]:32} echec liste ({erreur})")
            sys.stdout.flush()
            continue

        obtenus = set(deja)
        for numero in attendus:
            if numero in deja:
                continue
            fichier = None
            for langue in LANGUES_PAR_PREFERENCE:
                if numero in par_langue.get(langue, {}):
                    fichier = par_langue[langue][numero]
                    break
            if not fichier:
                continue
            chemin = f"{RACINE_COUVERTURES}/{slug}/{numero}.webp"
            try:
                brut = curl(f"{MANGADEX_UPLOADS}/{identifiant}/{fichier}.512.jpg",
                            binaire=True)
                enregistrer(brut, chemin)
            except Exception:
                continue
            obtenus.add(numero)
            telecharges += 1
            poids_total += os.path.getsize(chemin)

        manifeste[slug] = sorted(obtenus)
        json.dump(manifeste, open(FICHIER_MANIFESTE, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2, sort_keys=True)
        if not obtenus:
            sans_couverture.append(slug)
        print(f"  {index:>3}/{len(cibles)}  {slug[:32]:32} {len(obtenus)}/{tomes_parus}")
        sys.stdout.flush()

    couverts = sum(len(v) for v in manifeste.values())
    attendus_total = sum(t for _, _, t in cibles)
    print(f"\ntelecharges cette passe    : {telecharges}")
    if telecharges:
        print(f"poids moyen                : {poids_total / telecharges / 1024:.1f} Ko")
    print(f"couvertures totales        : {couverts} / {attendus_total} "
          f"({couverts / attendus_total:.0%})")
    print(f"sans correspondance        : {len(sans_correspondance)}")
    for slug in sans_correspondance:
        print(f"    {slug}")
    print(f"sans aucune couverture     : {len(sans_couverture)}")
    for slug in sans_couverture:
        print(f"    {slug}")


main()
