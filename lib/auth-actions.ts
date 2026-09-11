"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hacherMotDePasse, jetonDeSession, motDePasseCorrespond } from "./auth";
import { exigerAcces } from "./guard";
import { prisma } from "./prisma";
import {
  CHEMIN_ACCES,
  CHEMIN_COMPTE,
  COOKIE_ACCES,
  DUREE_ACCES_SECONDES,
  LIBELLE_ACCES_REFUSE,
  LIBELLE_COMPTE_ENREGISTRE,
  LIBELLE_EMAIL_INVALIDE,
  LIBELLE_EMAIL_PRIS,
  LIBELLE_IDENTIFIANT_INVALIDE,
  LIBELLE_IDENTIFIANT_PRIS,
  LIBELLE_MOT_DE_PASSE_ABSENT,
  LIBELLE_MOT_DE_PASSE_ACTUEL_FAUX,
  LIBELLE_MOT_DE_PASSE_COURT,
  LIBELLE_MOT_DE_PASSE_DIFFERENT,
  LIBELLE_SIGNATURE_NON_CONFIGUREE,
} from "./constants";
import {
  emailValide,
  identifiantValide,
  motDePasseAssezLong,
  normaliserEmail,
  normaliserIdentifiant,
} from "./domain";
import type { EtatAcces, EtatCompte, EtatInscription } from "./domain";

const CHAMP_IDENTIFIANT = "identifiant";
const CHAMP_EMAIL = "email";
const CHAMP_NOM = "nom";
const CHAMP_MOT_DE_PASSE = "motDePasse";
const CHAMP_MOT_DE_PASSE_ACTUEL = "motDePasseActuel";
const CHAMP_CONFIRMATION = "confirmation";

function texte(donnees: FormData, champ: string): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur : "";
}

async function poserCookie(utilisateurId: string, versionJeton: number) {
  const jeton = jetonDeSession({ utilisateurId, versionJeton }, new Date());
  if (!jeton) {
    throw new Error(LIBELLE_SIGNATURE_NON_CONFIGUREE);
  }
  const magasin = await cookies();
  magasin.set(COOKIE_ACCES, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_ACCES_SECONDES,
  });
}

export async function seConnecter(
  _precedent: EtatAcces,
  donnees: FormData,
): Promise<EtatAcces> {
  const identifiant = normaliserIdentifiant(texte(donnees, CHAMP_IDENTIFIANT));
  const motDePasse = texte(donnees, CHAMP_MOT_DE_PASSE);

  const utilisateur = identifiant
    ? await prisma.utilisateur.findUnique({
        where: { identifiant },
        select: { id: true, motDePasseHash: true, versionJeton: true },
      })
    : null;

  if (
    !utilisateur?.motDePasseHash ||
    !(await motDePasseCorrespond(motDePasse, utilisateur.motDePasseHash))
  ) {
    return { erreur: LIBELLE_ACCES_REFUSE };
  }

  await poserCookie(utilisateur.id, utilisateur.versionJeton);
  redirect("/");
}

export async function sInscrire(
  _precedent: EtatInscription,
  donnees: FormData,
): Promise<EtatInscription> {
  const identifiant = normaliserIdentifiant(texte(donnees, CHAMP_IDENTIFIANT));
  const email = normaliserEmail(texte(donnees, CHAMP_EMAIL));
  const motDePasse = texte(donnees, CHAMP_MOT_DE_PASSE);
  const saisie = { identifiant, email };

  if (!identifiantValide(identifiant)) {
    return { erreur: LIBELLE_IDENTIFIANT_INVALIDE, ...saisie };
  }
  if (!emailValide(email)) {
    return { erreur: LIBELLE_EMAIL_INVALIDE, ...saisie };
  }
  if (!motDePasseAssezLong(motDePasse)) {
    return { erreur: LIBELLE_MOT_DE_PASSE_COURT, ...saisie };
  }
  if (motDePasse !== texte(donnees, CHAMP_CONFIRMATION)) {
    return { erreur: LIBELLE_MOT_DE_PASSE_DIFFERENT, ...saisie };
  }

  const dejaPris = await prisma.utilisateur.findFirst({
    where: { OR: [{ identifiant }, { email }] },
    select: { identifiant: true },
  });
  if (dejaPris) {
    return {
      erreur:
        dejaPris.identifiant === identifiant
          ? LIBELLE_IDENTIFIANT_PRIS
          : LIBELLE_EMAIL_PRIS,
      ...saisie,
    };
  }

  const cree = await prisma.utilisateur.create({
    data: {
      identifiant,
      email,
      motDePasseHash: await hacherMotDePasse(motDePasse),
    },
    select: { id: true, versionJeton: true },
  });

  await poserCookie(cree.id, cree.versionJeton);
  redirect("/");
}

export async function seDeconnecter() {
  const magasin = await cookies();
  magasin.delete(COOKIE_ACCES);
  redirect(CHEMIN_ACCES);
}

export async function changerIdentite(
  _precedent: EtatCompte,
  donnees: FormData,
): Promise<EtatCompte> {
  const { utilisateurId } = await exigerAcces();
  const identifiant = normaliserIdentifiant(texte(donnees, CHAMP_IDENTIFIANT));
  const email = normaliserEmail(texte(donnees, CHAMP_EMAIL));
  const nom = texte(donnees, CHAMP_NOM).trim();

  if (!identifiantValide(identifiant)) {
    return { erreur: LIBELLE_IDENTIFIANT_INVALIDE, message: null };
  }
  if (!emailValide(email)) {
    return { erreur: LIBELLE_EMAIL_INVALIDE, message: null };
  }

  const dejaPris = await prisma.utilisateur.findFirst({
    where: {
      id: { not: utilisateurId },
      OR: [{ identifiant }, { email }],
    },
    select: { identifiant: true },
  });
  if (dejaPris) {
    return {
      erreur:
        dejaPris.identifiant === identifiant
          ? LIBELLE_IDENTIFIANT_PRIS
          : LIBELLE_EMAIL_PRIS,
      message: null,
    };
  }

  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: { identifiant, email, nom: nom.length > 0 ? nom : null },
  });

  revalidatePath(CHEMIN_COMPTE);
  return { erreur: null, message: LIBELLE_COMPTE_ENREGISTRE };
}

export async function changerMotDePasse(
  _precedent: EtatCompte,
  donnees: FormData,
): Promise<EtatCompte> {
  const { utilisateurId } = await exigerAcces();
  const actuel = texte(donnees, CHAMP_MOT_DE_PASSE_ACTUEL);
  const nouveau = texte(donnees, CHAMP_MOT_DE_PASSE);

  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: { motDePasseHash: true, versionJeton: true },
  });

  if (!utilisateur.motDePasseHash) {
    return { erreur: LIBELLE_MOT_DE_PASSE_ABSENT, message: null };
  }
  if (!(await motDePasseCorrespond(actuel, utilisateur.motDePasseHash))) {
    return { erreur: LIBELLE_MOT_DE_PASSE_ACTUEL_FAUX, message: null };
  }
  if (!motDePasseAssezLong(nouveau)) {
    return { erreur: LIBELLE_MOT_DE_PASSE_COURT, message: null };
  }
  if (nouveau !== texte(donnees, CHAMP_CONFIRMATION)) {
    return { erreur: LIBELLE_MOT_DE_PASSE_DIFFERENT, message: null };
  }

  const versionJeton = utilisateur.versionJeton + 1;
  await prisma.utilisateur.update({
    where: { id: utilisateurId },
    data: { motDePasseHash: await hacherMotDePasse(nouveau), versionJeton },
  });

  await poserCookie(utilisateurId, versionJeton);

  return { erreur: null, message: LIBELLE_COMPTE_ENREGISTRE };
}
