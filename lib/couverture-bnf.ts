import {
  CODES_ABSENCE_BNF,
  DELAI_BNF_MS,
  HAUTEUR_COUVERTURE,
  LARGEUR_COUVERTURE,
  PREMIERE_DE_COUVERTURE,
  SERVICE_COUVERTURES_BNF,
  TYPES_IMAGE_ACCEPTES,
} from "@/lib/constants";

export type ImageRecuperee = { octets: Buffer; type: string; extension: string };

export type ReponseCouverture =
  | { etat: "image"; image: ImageRecuperee }
  | { etat: "absente" }
  | { etat: "injoignable"; cause: string };

export function urlCouvertureBnf(ean: string): string {
  return (
    `${SERVICE_COUVERTURES_BNF}?EAN=${ean}&couverture=${PREMIERE_DE_COUVERTURE}` +
    `&taille=originale&largeur=${LARGEUR_COUVERTURE}&hauteur=${HAUTEUR_COUVERTURE}`
  );
}

export async function telechargerCouvertureBnf(ean: string): Promise<ReponseCouverture> {
  try {
    const reponse = await fetch(urlCouvertureBnf(ean), {
      signal: AbortSignal.timeout(DELAI_BNF_MS),
      redirect: "follow",
    });

    if (CODES_ABSENCE_BNF.includes(reponse.status)) {
      return { etat: "absente" };
    }
    if (!reponse.ok) {
      return { etat: "injoignable", cause: `http ${reponse.status}` };
    }

    const type = (reponse.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    const extension = TYPES_IMAGE_ACCEPTES[type];
    if (!extension) {
      return { etat: "absente" };
    }

    return {
      etat: "image",
      image: { octets: Buffer.from(await reponse.arrayBuffer()), type, extension },
    };
  } catch (erreur) {
    return { etat: "injoignable", cause: erreur instanceof Error ? erreur.name : "inconnue" };
  }
}

export function dimensionsImage(octets: Buffer): { largeur: number; hauteur: number } | null {
  if (octets.length > 24 && octets.readUInt32BE(0) === 0x89504e47) {
    return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20) };
  }

  let position = 2;
  while (position + 9 < octets.length) {
    if (octets[position] !== 0xff) {
      position += 1;
      continue;
    }
    const marqueur = octets[position + 1] ?? 0;
    const estCadre =
      marqueur >= 0xc0 &&
      marqueur <= 0xcf &&
      marqueur !== 0xc4 &&
      marqueur !== 0xc8 &&
      marqueur !== 0xcc;
    if (estCadre) {
      return {
        largeur: octets.readUInt16BE(position + 7),
        hauteur: octets.readUInt16BE(position + 5),
      };
    }
    position += 2 + octets.readUInt16BE(position + 2);
  }

  return null;
}
