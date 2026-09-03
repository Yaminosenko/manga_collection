export async function enFile<T>(taches: (() => Promise<T>)[], concurrence: number): Promise<T[]> {
  const resultats: T[] = [];
  let index = 0;

  async function ouvrier() {
    while (index < taches.length) {
      const rang = index;
      index += 1;
      resultats[rang] = await taches[rang]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrence, taches.length) }, ouvrier));
  return resultats;
}
