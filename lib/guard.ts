import { cookies } from "next/headers";
import { jetonValide } from "./auth";
import { COOKIE_ACCES, LIBELLE_ACCES_REFUSE } from "./constants";

export async function exigerAcces(): Promise<void> {
  const magasin = await cookies();
  if (!jetonValide(magasin.get(COOKIE_ACCES)?.value)) {
    throw new Error(LIBELLE_ACCES_REFUSE);
  }
}
