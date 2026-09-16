import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

export async function deposer(
  chemin: string,
  contenu: Buffer,
  type: string = TYPE_IMAGE,
): Promise<string> {
  await clientR2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: chemin,
      Body: contenu,
      ContentType: type,
      CacheControl: `public, max-age=${CACHE_UN_AN_SECONDES}`,
    }),
  );
  return urlPublique(chemin);
}

export function cheminDepuisUrl(url: string): string | null {
  const base = `${basePublique()}/`;
  return url.startsWith(base) ? url.slice(base.length) : null;
}

export async function copierObjet(source: string, destination: string): Promise<string> {
  await clientR2().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      Key: destination,
      CopySource: encodeURI(`${bucket()}/${source}`),
    }),
  );
  return urlPublique(destination);
}

export async function supprimerObjet(chemin: string): Promise<void> {
  await clientR2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: chemin }));
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
