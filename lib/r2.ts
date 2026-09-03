import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const REGION_R2 = "auto";
const PAGE_LISTE = 1000;

export const CACHE_UN_AN_SECONDES = 31_536_000;
export const TYPE_IMAGE = "image/webp";

function exiger(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`${nom} manquante dans .env : voir .env.example`);
  }
  return valeur;
}

export function bucket(): string {
  return exiger("R2_BUCKET");
}

export function basePublique(): string {
  return exiger("R2_PUBLIC_BASE").replace(/\/+$/, "");
}

export function urlPublique(chemin: string): string {
  return `${basePublique()}/${chemin}`;
}

let client: S3Client | null = null;

export function clientR2(): S3Client {
  if (!client) {
    client = new S3Client({
      region: REGION_R2,
      endpoint: exiger("R2_ENDPOINT"),
      credentials: {
        accessKeyId: exiger("R2_ACCESS_KEY_ID"),
        secretAccessKey: exiger("R2_SECRET_ACCESS_KEY"),
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
  }
  return client;
}

export async function deposer(chemin: string, contenu: Buffer): Promise<string> {
  await clientR2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: chemin,
      Body: contenu,
      ContentType: TYPE_IMAGE,
      CacheControl: `public, max-age=${CACHE_UN_AN_SECONDES}`,
    }),
  );
  return urlPublique(chemin);
}

export async function listerObjets(prefixe: string): Promise<{ chemins: Set<string>; pages: number }> {
  const chemins = new Set<string>();
  let suite: string | undefined;
  let pages = 0;

  do {
    const page = await clientR2().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefixe,
        MaxKeys: PAGE_LISTE,
        ContinuationToken: suite,
      }),
    );
    pages += 1;
    for (const objet of page.Contents ?? []) {
      if (objet.Key) chemins.add(objet.Key);
    }
    suite = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (suite);

  return { chemins, pages };
}
