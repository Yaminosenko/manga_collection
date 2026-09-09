import { prisma } from "@/lib/prisma";
import { roleCourant } from "@/lib/guard";
import { LIBELLE_ACCES_REFUSE, LIBELLE_PROPRIETAIRE_ABSENT } from "@/lib/constants";

export type UtilisateurCourant = {
  id: string;
  lectureSeule: boolean;
};

let idProprietaireMemorise: string | null = null;

export async function idProprietaire(): Promise<string> {
  if (idProprietaireMemorise !== null) {
    return idProprietaireMemorise;
  }
  const proprietaire = await prisma.utilisateur.findFirst({
    where: { role: "PROPRIETAIRE" },
    select: { id: true },
    orderBy: { creeLe: "asc" },
  });
  if (!proprietaire) {
    throw new Error(LIBELLE_PROPRIETAIRE_ABSENT);
  }
  idProprietaireMemorise = proprietaire.id;
  return proprietaire.id;
}

export async function utilisateurCourant(): Promise<UtilisateurCourant> {
  const role = await roleCourant();
  if (role === null) {
    throw new Error(LIBELLE_ACCES_REFUSE);
  }
  return { id: await idProprietaire(), lectureSeule: role !== "proprietaire" };
}

export async function idUtilisateurCourant(): Promise<string> {
  return (await utilisateurCourant()).id;
}
