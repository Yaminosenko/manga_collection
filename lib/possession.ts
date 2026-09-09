export type PossessionLue = { possede: boolean };

export type VolumePossede = { possessions: PossessionLue[] };

export function selectionPossession(utilisateurId: string) {
  return { where: { utilisateurId }, select: { possede: true } } as const;
}

export function estPossede(volume: VolumePossede): boolean {
  return volume.possessions[0]?.possede === true;
}

export function volumesPossedes<T extends VolumePossede>(volumes: T[]): T[] {
  return volumes.filter(estPossede);
}
