"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jetonInvite, jetonPour } from "./auth";
import {
  CHEMIN_ACCES,
  COOKIE_ACCES,
  DUREE_ACCES_SECONDES,
  LIBELLE_ACCES_REFUSE,
} from "./constants";
import type { EtatAcces } from "./domain";

export async function deverrouiller(
  _precedent: EtatAcces,
  donnees: FormData,
): Promise<EtatAcces> {
  const saisie = donnees.get("motDePasse");
  const jeton = typeof saisie === "string" ? jetonPour(saisie) : null;

  if (!jeton) {
    return { erreur: LIBELLE_ACCES_REFUSE };
  }

  await poserCookie(jeton);
  redirect("/");
}

async function poserCookie(jeton: string) {
  const magasin = await cookies();
  magasin.set(COOKIE_ACCES, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_ACCES_SECONDES,
  });
}

export async function entrerEnInvite() {
  const jeton = jetonInvite();
  if (!jeton) {
    return;
  }
  await poserCookie(jeton);
  redirect("/");
}

export async function quitterInvite() {
  const magasin = await cookies();
  magasin.delete(COOKIE_ACCES);
  redirect(CHEMIN_ACCES);
}
