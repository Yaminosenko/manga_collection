import { createHmac, timingSafeEqual } from "node:crypto";
import { COOKIE_ACCES, MESSAGE_JETON, MESSAGE_JETON_INVITE } from "./constants";

export type Role = "proprietaire" | "invite";

function motDePasse(): string | undefined {
  const valeur = process.env["ACCESS_PASSWORD"];
  return valeur && valeur.length > 0 ? valeur : undefined;
}

export function accesConfigure(): boolean {
  return motDePasse() !== undefined;
}

function signer(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

function memeJeton(gauche: string, droite: string): boolean {
  const a = Buffer.from(gauche);
  const b = Buffer.from(droite);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function jetonPour(saisie: string): string | null {
  const secret = motDePasse();
  if (!secret) return null;
  const attendu = signer(secret, MESSAGE_JETON);
  return memeJeton(attendu, signer(saisie, MESSAGE_JETON)) ? attendu : null;
}

export function jetonInvite(): string | null {
  const secret = motDePasse();
  return secret ? signer(secret, MESSAGE_JETON_INVITE) : null;
}

export function roleDuJeton(jeton: string | undefined): Role | null {
  const secret = motDePasse();
  if (!secret || !jeton) return null;
  if (memeJeton(signer(secret, MESSAGE_JETON), jeton)) return "proprietaire";
  if (memeJeton(signer(secret, MESSAGE_JETON_INVITE), jeton)) return "invite";
  return null;
}

export function jetonValide(jeton: string | undefined): boolean {
  return roleDuJeton(jeton) !== null;
}

export { COOKIE_ACCES };
