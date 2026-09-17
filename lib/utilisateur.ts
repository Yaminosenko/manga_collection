import { exigerAcces } from "@/lib/guard";

export async function idUtilisateurCourant(): Promise<string> {
  return (await exigerAcces()).utilisateurId;
}
