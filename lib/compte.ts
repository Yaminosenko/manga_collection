import { exigerAcces } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { identifiantVisible } from "@/lib/domain";
import type { CompteAffiche } from "@/lib/domain";

export async function chargerCompteCourant(): Promise<CompteAffiche> {
  const { utilisateurId, role } = await exigerAcces();
  const utilisateur = await prisma.utilisateur.findUniqueOrThrow({
    where: { id: utilisateurId },
    select: {
      identifiant: true,
      identifiantAffiche: true,
      email: true,
      nom: true,
      visible: true,
    },
  });

  return {
    identifiant: identifiantVisible(
      utilisateur.identifiantAffiche,
      utilisateur.identifiant,
    ),
    email: utilisateur.email,
    nom: utilisateur.nom,
    proprietaire: role === "PROPRIETAIRE",
    visible: utilisateur.visible,
  };
}
