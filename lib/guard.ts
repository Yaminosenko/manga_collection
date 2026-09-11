import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sessionDuJeton } from "./auth";
import { prisma } from "./prisma";
import { CHEMIN_ACCES, COOKIE_ACCES, MENTION_RESERVE_PROPRIETAIRE } from "./constants";
import type { RoleUtilisateur } from "./generated/prisma/enums";

export type SessionCourante = {
  utilisateurId: string;
  role: RoleUtilisateur;
};

export const sessionCourante = cache(async (): Promise<SessionCourante | null> => {
  const magasin = await cookies();
  const session = sessionDuJeton(magasin.get(COOKIE_ACCES)?.value, new Date());
  if (!session) {
    return null;
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: session.utilisateurId },
    select: { id: true, role: true, versionJeton: true },
  });

  if (!utilisateur || utilisateur.versionJeton !== session.versionJeton) {
    return null;
  }

  return { utilisateurId: utilisateur.id, role: utilisateur.role };
});

export async function exigerAcces(): Promise<SessionCourante> {
  const session = await sessionCourante();
  if (!session) {
    redirect(CHEMIN_ACCES);
  }
  return session;
}

export async function exigerProprietaire(): Promise<SessionCourante> {
  const session = await exigerAcces();
  if (session.role !== "PROPRIETAIRE") {
    throw new Error(MENTION_RESERVE_PROPRIETAIRE);
  }
  return session;
}

export async function estProprietaire(): Promise<boolean> {
  return (await sessionCourante())?.role === "PROPRIETAIRE";
}
