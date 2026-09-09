export function sansAccent(texte: string): string {
  return texte.normalize("NFKD").replace(/\p{Diacritic}/gu, "");
}

export function normaliserPourCatalogue(texte: string): string {
  return sansAccent(texte)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
