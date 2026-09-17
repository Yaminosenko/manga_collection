"""Genere les SVG sources et les PNG de l'icone Zenkan, a tous les niveaux de detail."""

import os
import cairosvg

RACINE = os.path.dirname(os.path.abspath(__file__))

PAPIER = "#f4efe4"
ENCRE = "#16130f"
SCEAU = "#9184d9"
FIBRES_CLAIR = "#d8cfbd"
FIBRES_SOMBRE = "#2a251d"

TRAITS = (
    '<path d="M 96 120 C 118 104 168 100 214 100 C 276 100 342 104 396 114 '
    'C 410 117 418 124 416 134 C 414 146 402 152 384 152 C 330 146 268 140 214 142 '
    'C 176 143 142 150 116 162 C 100 168 90 162 89 148 C 88 136 90 126 96 120 Z"/>'
    '<path d="M 404 128 C 412 136 412 150 402 162 C 352 214 292 272 238 322 '
    'C 212 346 190 366 172 382 C 160 392 146 390 138 380 C 130 369 133 356 146 344 '
    'C 166 326 192 302 222 274 C 276 224 336 168 382 126 C 390 119 398 121 404 128 Z"/>'
    '<path d="M 132 358 C 158 348 210 342 264 342 C 322 342 380 348 424 360 '
    'C 438 364 444 374 440 386 C 436 398 424 404 406 401 C 358 391 300 384 250 384 '
    'C 208 384 172 390 148 400 C 132 407 122 400 120 386 C 118 373 122 362 132 358 Z"/>'
)

KASURE = (
    '<path d="M 148 112 C 200 104 268 104 330 108 L 330 114 C 268 110 200 111 150 118 Z"/>'
    '<path d="M 262 300 C 300 262 344 218 380 182 L 388 188 C 352 224 308 268 270 306 Z"/>'
    '<path d="M 210 348 C 268 344 336 348 392 356 L 392 363 C 336 355 268 351 212 355 Z"/>'
    '<path d="M 336 360 C 360 362 384 366 404 370 L 404 376 C 384 372 360 368 336 366 Z"/>'
    '<path d="M 180 356 C 196 354 212 353 226 353 L 226 359 C 212 359 196 360 182 362 Z"/>'
)

ECLABOUSSURES = (
    '<ellipse cx="444" cy="150" rx="5.5" ry="4.4"/>'
    '<ellipse cx="460" cy="171" rx="3.2" ry="2.6"/>'
    '<ellipse cx="436" cy="177" rx="2.2" ry="1.8"/>'
    '<ellipse cx="108" cy="424" rx="4.6" ry="3.6"/>'
    '<ellipse cx="90" cy="406" rx="2.6" ry="2.1"/>'
    '<ellipse cx="128" cy="440" rx="2" ry="1.6"/>'
    '<ellipse cx="74" cy="196" rx="2.8" ry="2.2"/>'
)

FIBRES = (
    '<rect x="48" y="112" width="86" height="1.4"/>'
    '<rect x="292" y="206" width="132" height="1.2"/>'
    '<rect x="86" y="318" width="74" height="1.3"/>'
    '<rect x="320" y="438" width="108" height="1.2"/>'
    '<rect x="164" y="62" width="58" height="1.1"/>'
)

POLICE_CJK = "Noto Serif CJK JP, Noto Serif CJK SC, serif"


def sceau(avec_caracteres, contraste):
    filet = (
        f'<rect x="7" y="7" width="60" height="60" rx="3" fill="none" '
        f'stroke="{contraste}" stroke-width="3.2"/>'
    )
    caracteres = ""
    if avec_caracteres:
        caracteres = (
            f'<text x="37" y="34" text-anchor="middle" font-family="{POLICE_CJK}" '
            f'font-size="25" fill="{contraste}">\u5168</text>'
            f'<text x="37" y="61" text-anchor="middle" font-family="{POLICE_CJK}" '
            f'font-size="25" fill="{contraste}">\u5dfb</text>'
        )
    else:
        filet = ""
    return (
        '<g transform="translate(398, 398)">'
        f'<rect x="0" y="0" width="74" height="74" rx="7" fill="{SCEAU}"/>'
        f'{filet}{caracteres}</g>'
    )


def construire(detail, sombre=False, fond=True, marge=0):
    """detail: 'complet' | 'moyen' | 'minimal'."""
    encre = PAPIER if sombre else ENCRE
    papier = ENCRE if sombre else PAPIER
    fibres = FIBRES_SOMBRE if sombre else FIBRES_CLAIR
    contraste_sceau = ENCRE

    echelle = 1 - 2 * marge
    corps = []
    if detail == "complet":
        corps.append(f'<g fill="{fibres}" opacity="0.5">{FIBRES}</g>')
    corps.append(f'<g fill="{encre}">{TRAITS}</g>')
    if detail in ("complet", "moyen"):
        corps.append(f'<g fill="{papier}" opacity="0.34">{KASURE}</g>')
    if detail == "complet":
        corps.append(f'<g fill="{encre}">{ECLABOUSSURES}</g>')
        corps.append(sceau(True, contraste_sceau))
    elif detail == "moyen":
        corps.append(sceau(False, contraste_sceau))

    interieur = "".join(corps)
    if marge:
        decalage = 512 * marge
        interieur = f'<g transform="translate({decalage},{decalage}) scale({echelle})">{interieur}</g>'

    rect_fond = f'<rect width="512" height="512" fill="{papier}"/>' if fond else ""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
        f'width="512" height="512">{rect_fond}{interieur}</svg>'
    )


def ecrire(chemin, contenu):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as flux:
        flux.write(contenu)


def rendre(source_svg, chemin_png, taille):
    os.makedirs(os.path.dirname(chemin_png), exist_ok=True)
    cairosvg.svg2png(
        bytestring=source_svg.encode("utf-8"),
        write_to=chemin_png,
        output_width=taille,
        output_height=taille,
    )


COMPLET = construire("complet")
MOYEN = construire("moyen")
MINIMAL = construire("minimal")
COMPLET_SOMBRE = construire("complet", sombre=True)
MASKABLE = construire("complet", marge=0.14)
MASKABLE_SOMBRE = construire("complet", sombre=True, marge=0.14)
TRANSPARENT = construire("complet", fond=False)

ecrire(f"{RACINE}/svg/zenkan-icone.svg", COMPLET)
ecrire(f"{RACINE}/svg/zenkan-icone-sombre.svg", COMPLET_SOMBRE)
ecrire(f"{RACINE}/svg/zenkan-icone-moyen.svg", MOYEN)
ecrire(f"{RACINE}/svg/zenkan-icone-minimal.svg", MINIMAL)
ecrire(f"{RACINE}/svg/zenkan-icone-transparent.svg", TRANSPARENT)
ecrire(f"{RACINE}/svg/zenkan-icone-maskable.svg", MASKABLE)

PLAN = [
    (COMPLET, "icons/icon-512.png", 512),
    (COMPLET, "icons/icon-384.png", 384),
    (COMPLET, "icons/icon-192.png", 192),
    (COMPLET, "icons/icon-180.png", 180),
    (COMPLET, "icons/apple-touch-icon.png", 180),
    (MASKABLE, "icons/icon-maskable-512.png", 512),
    (MASKABLE, "icons/icon-maskable-192.png", 192),
    (MASKABLE_SOMBRE, "icons/icon-maskable-512-sombre.png", 512),
    (COMPLET_SOMBRE, "icons/icon-512-sombre.png", 512),
    (COMPLET_SOMBRE, "icons/icon-192-sombre.png", 192),
    (MOYEN, "icons/icon-144.png", 144),
    (MOYEN, "icons/icon-96.png", 96),
    (MOYEN, "icons/icon-72.png", 72),
    (MINIMAL, "icons/icon-48.png", 48),
    (MINIMAL, "icons/favicon-32.png", 32),
    (MINIMAL, "icons/favicon-16.png", 16),
]

for source, nom, taille in PLAN:
    rendre(source, f"{RACINE}/{nom}", taille)

print(f"{len(PLAN)} PNG + 6 SVG generes")
