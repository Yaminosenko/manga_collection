import re
from PIL import Image, ImageDraw

SOURCE_TOKENS = "app/globals.css"
DESTINATION = "public"
TAILLES = (192, 512)
TAILLE_APPLE = 180
PART_ZONE_SURE = 0.62
PART_RAYON_FOND = 0.22
NOMBRE_TRANCHES = 3
PART_ESPACEMENT = 0.16


def lire_token(nom):
    contenu = open(SOURCE_TOKENS, encoding="utf-8").read()
    trouve = re.search(rf"--color-{nom}:\s*(#[0-9a-fA-F]{{6}})", contenu)
    if not trouve:
        raise SystemExit(f"token --color-{nom} introuvable dans {SOURCE_TOKENS}")
    return trouve.group(1)


def dessiner(taille, fond, tranches):
    facteur = 4
    image = Image.new("RGBA", (taille * facteur, taille * facteur), (0, 0, 0, 0))
    pinceau = ImageDraw.Draw(image)
    cote = taille * facteur

    pinceau.rounded_rectangle(
        (0, 0, cote - 1, cote - 1),
        radius=int(cote * PART_RAYON_FOND),
        fill=fond,
    )

    zone = cote * PART_ZONE_SURE
    origine = (cote - zone) / 2
    espacement = zone * PART_ESPACEMENT / (NOMBRE_TRANCHES - 1)
    largeur = (zone - espacement * (NOMBRE_TRANCHES - 1)) / NOMBRE_TRANCHES

    for index in range(NOMBRE_TRANCHES):
        gauche = origine + index * (largeur + espacement)
        retrait = zone * 0.12 * index
        pinceau.rounded_rectangle(
            (gauche, origine + retrait, gauche + largeur, origine + zone),
            radius=int(largeur * 0.22),
            fill=tranches[index % len(tranches)],
        )

    return image.resize((taille, taille), Image.LANCZOS)


def main():
    fond = lire_token("bg")
    tranches = [lire_token("accent"), lire_token("accent-400"), lire_token("accent-700")]

    for taille in TAILLES:
        chemin = f"{DESTINATION}/icon-{taille}.png"
        dessiner(taille, fond, tranches).save(chemin, "PNG", optimize=True)
        print(f"  {chemin}")

    chemin_apple = "app/apple-icon.png"
    dessiner(TAILLE_APPLE, fond, tranches).save(chemin_apple, "PNG", optimize=True)
    print(f"  {chemin_apple}")


main()
