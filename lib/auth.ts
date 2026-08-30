import { createHmac, timingSafeEqual } from "node:crypto";
import { COOKIE_ACCES, MESSAGE_JETON } from "./constants";

function motDePasse(): string | undefined {
  const valeur = process.env["ACCESS_PASSWORD"];
  return valeur && valeur.length > 0 ? valeur : undefined;
}

export function accesConfigure(): boolean {
  return motDePasse() !== undefined;
}

function signer(secret: string): string {
  return createHmac("sha256", secret).update(MESSAGE_JETON).digest("hex");
}

export function jetonPour(saisie: string): string | null {
  const secret = motDePasse();
  if (!secret) return null;
  const attendu = Buffer.from(signer(secret));
  const propose = Buffer.from(signer(saisie));
  if (attendu.length !== propose.length) return null;
  return timingSafeEqual(attendu, propose) ? attendu.toString() : null;
}

export function jetonValide(jeton: string | undefined): boolean {
  const secret = motDePasse();
  if (!secret || !jeton) return false;
  const attendu = Buffer.from(signer(secret));
  const propose = Buffer.from(jeton);
  return attendu.length === propose.length && timingSafeEqual(attendu, propose);
}

export { COOKIE_ACCES };
