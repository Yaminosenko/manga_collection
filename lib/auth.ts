import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { COOKIE_ACCES, DUREE_ACCES_SECONDES } from "./constants";

const scrypt = promisify(scryptCallback) as (
  motDePasse: string,
  sel: Buffer,
  longueur: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const ALGORITHME_HACHAGE = "scrypt";
const COUT_HACHAGE = 16_384;
const BLOCS_HACHAGE = 8;
const PARALLELISME_HACHAGE = 1;
const OCTETS_SEL = 16;
const OCTETS_EMPREINTE = 32;
const SEPARATEUR_HACHAGE = "$";
const SEPARATEUR_CHARGE = ":";
const SEPARATEUR_SIGNATURE = ".";
const MILLISECONDES_PAR_SECONDE = 1000;

export type Session = {
  utilisateurId: string;
  versionJeton: number;
};

function secret(): string | undefined {
  const valeur = process.env["SESSION_SECRET"];
  return valeur && valeur.length > 0 ? valeur : undefined;
}

export function signatureConfiguree(): boolean {
  return secret() !== undefined;
}

function signer(cle: string, message: string): string {
  return createHmac("sha256", cle).update(message).digest("hex");
}

function memeChaine(gauche: string, droite: string): boolean {
  const a = Buffer.from(gauche);
  const b = Buffer.from(droite);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function jetonDeSession(session: Session, instant: Date): string | null {
  const cle = secret();
  if (!cle) {
    return null;
  }
  const expiration =
    Math.floor(instant.getTime() / MILLISECONDES_PAR_SECONDE) + DUREE_ACCES_SECONDES;
  const charge = [session.utilisateurId, session.versionJeton, expiration].join(
    SEPARATEUR_CHARGE,
  );
  return `${charge}${SEPARATEUR_SIGNATURE}${signer(cle, charge)}`;
}

export function sessionDuJeton(jeton: string | undefined, instant: Date): Session | null {
  const cle = secret();
  if (!cle || !jeton) {
    return null;
  }

  const coupure = jeton.lastIndexOf(SEPARATEUR_SIGNATURE);
  if (coupure <= 0) {
    return null;
  }

  const charge = jeton.slice(0, coupure);
  const signature = jeton.slice(coupure + SEPARATEUR_SIGNATURE.length);
  if (!memeChaine(signer(cle, charge), signature)) {
    return null;
  }

  const [utilisateurId, version, expiration] = charge.split(SEPARATEUR_CHARGE);
  const versionJeton = Number(version);
  const expireA = Number(expiration);
  if (!utilisateurId || !Number.isInteger(versionJeton) || !Number.isInteger(expireA)) {
    return null;
  }
  if (expireA * MILLISECONDES_PAR_SECONDE <= instant.getTime()) {
    return null;
  }

  return { utilisateurId, versionJeton };
}

export async function hacherMotDePasse(saisie: string): Promise<string> {
  const sel = randomBytes(OCTETS_SEL);
  const empreinte = await scrypt(saisie.normalize("NFKC"), sel, OCTETS_EMPREINTE, {
    N: COUT_HACHAGE,
    r: BLOCS_HACHAGE,
    p: PARALLELISME_HACHAGE,
  });
  return [
    ALGORITHME_HACHAGE,
    COUT_HACHAGE,
    BLOCS_HACHAGE,
    PARALLELISME_HACHAGE,
    sel.toString("hex"),
    empreinte.toString("hex"),
  ].join(SEPARATEUR_HACHAGE);
}

export async function motDePasseCorrespond(saisie: string, hache: string): Promise<boolean> {
  const parties = hache.split(SEPARATEUR_HACHAGE);
  if (parties.length !== 6 || parties[0] !== ALGORITHME_HACHAGE) {
    return false;
  }

  const [, cout, blocs, parallelisme, selHex, empreinteHex] = parties;
  const sel = Buffer.from(selHex, "hex");
  const attendue = Buffer.from(empreinteHex, "hex");
  if (sel.length === 0 || attendue.length === 0) {
    return false;
  }

  const calculee = await scrypt(saisie.normalize("NFKC"), sel, attendue.length, {
    N: Number(cout),
    r: Number(blocs),
    p: Number(parallelisme),
  });

  return timingSafeEqual(attendue, calculee);
}

export { COOKIE_ACCES };
