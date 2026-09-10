export function sansAccent(texte: string): string {
  return texte.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

export function normaliserPourCatalogue(texte: string): string {
  return sansAccent(texte)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const LETTRE_LATINE_ACCENTUEE = /(\p{Script=Latin})\p{Mn}+/gu;

export function normaliserAlias(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(LETTRE_LATINE_ACCENTUEE, "$1")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function similarite(gauche: string, droite: string): number {
  if (gauche === droite) return 1;
  if (gauche.length === 0 || droite.length === 0) return 0;

  let precedente = Array.from({ length: droite.length + 1 }, (_, index) => index);
  for (let i = 1; i <= gauche.length; i += 1) {
    const courante = [i];
    for (let j = 1; j <= droite.length; j += 1) {
      const cout = gauche[i - 1] === droite[j - 1] ? 0 : 1;
      courante[j] = Math.min(
        (courante[j - 1] ?? 0) + 1,
        (precedente[j] ?? 0) + 1,
        (precedente[j - 1] ?? 0) + cout,
      );
    }
    precedente = courante;
  }

  return 1 - (precedente[droite.length] ?? 0) / Math.max(gauche.length, droite.length);
}

export function aliasAffichables(
  titre: string,
  titreVo: string | null,
  venus: string[],
): string[] {
  const vus = new Set([normaliserAlias(titre)]);
  const retenus: string[] = [];

  for (const candidat of [titreVo ?? "", ...venus]) {
    const normalise = normaliserAlias(candidat);
    if (normalise === "" || vus.has(normalise)) continue;
    vus.add(normalise);
    retenus.push(candidat);
  }

  return retenus;
}

export function formesNormalisees(
  titre: string,
  titreVo: string | null,
  alias: string[],
): string[] {
  return [
    ...new Set(
      [titre, titreVo ?? "", ...alias].map(normaliserAlias).filter((forme) => forme !== ""),
    ),
  ];
}
