"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jetonPour } from "./auth";
import { COOKIE_ACCES, DUREE_ACCES_SECONDES, LIBELLE_ACCES_REFUSE } from "./constants";
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

  const magasin = await cookies();
  magasin.set(COOKIE_ACCES, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_ACCES_SECONDES,
  });

  redirect("/");
}
