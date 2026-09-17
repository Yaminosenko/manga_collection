export type SuiviLu = { id: string };

export type EditionSuivie = { suivis: SuiviLu[] };

export function selectionSuivi(utilisateurId: string) {
  return { where: { utilisateurId }, select: { id: true }, take: 1 } as const;
}

export function estSuivie(edition: EditionSuivie): boolean {
  return edition.suivis.length > 0;
}
