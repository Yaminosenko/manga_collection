import { exigerAcces } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import type { CompteAffiche } from "@/lib/domain";

export async function chargerCompteCourant(): Promise<CompteAffiche> {
  const { utilisateurId, role } = await exigerAcces();
  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: { identifiant: true, email: true, nom: true },
  });

  return { ...utilisateur, proprietaire: role === "PROPRIETAIRE" };
}
