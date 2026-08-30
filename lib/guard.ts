import { cookies } from "next/headers";
import { roleDuJeton } from "./auth";
import type { Role } from "./auth";
import { COOKIE_ACCES, LIBELLE_ACCES_REFUSE, MENTION_INVITE_LECTURE } from "./constants";

export async function roleCourant(): Promise<Role | null> {
  const magasin = await cookies();
  return roleDuJeton(magasin.get(COOKIE_ACCES)?.value);
}

export async function estProprietaire(): Promise<boolean> {
  return (await roleCourant()) === "proprietaire";
}

export async function exigerAcces(): Promise<void> {
  if ((await roleCourant()) === null) {
    throw new Error(LIBELLE_ACCES_REFUSE);
  }
}

export async function exigerProprietaire(): Promise<void> {
  if ((await roleCourant()) !== "proprietaire") {
    throw new Error(MENTION_INVITE_LECTURE);
  }
}
