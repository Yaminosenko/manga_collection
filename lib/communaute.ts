import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { COMPTES_CLASSEMENT_MAX } from "@/lib/constants";
import { identifiantVisible, normaliserIdentifiant } from "@/lib/domain";

export type LigneCommunaute = {
  identifiant: string;
  nomVisible: string;
  tomesPossedes: number;
  nombreEditions: number;
};

export type CompteVisite = {
  id: string;
  identifiant: string;
  nomVisible: string;
};

type LigneClassement = {
  identifiant: string;
  affiche: string | null;
  tomes: number;
  editions: number;
};

function echapperLike(terme: string): string {
  return terme.replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
}

export async function classerComptes(terme: string): Promise<LigneCommunaute[]> {
  const requete = normaliserIdentifiant(terme);
  const filtre =
    requete === ""
      ? Prisma.empty
      : Prisma.sql`AND u.identifiant LIKE ${`%${echapperLike(requete)}%`} ESCAPE '\\'`;

  const lignes = await prisma.$queryRaw<LigneClassement[]>`
    WITH comptes AS (
      SELECT u.id AS id,
             u.identifiant AS identifiant,
             u."identifiantAffiche" AS affiche
        FROM "Utilisateur" u
       WHERE u.identifiant IS NOT NULL
         AND u.visible
         ${filtre}
    ),
    par_suivi AS (
      SELECT s."utilisateurId" AS uid,
             s.suivie AS suivie,
             COUNT(p.id) FILTER (WHERE p.possede) AS possedes
        FROM "SuiviEdition" s
        JOIN comptes c ON c.id = s."utilisateurId"
        LEFT JOIN "Volume" v ON v."editionId" = s."editionId"
        LEFT JOIN "Possession" p
               ON p."volumeId" = v.id AND p."utilisateurId" = s."utilisateurId"
       WHERE s.statut <> 'VENDUE'
       GROUP BY s.id, s."utilisateurId", s.suivie
    )
    SELECT c.identifiant AS identifiant,
           c.affiche AS affiche,
           COALESCE(SUM(t.possedes), 0)::int AS tomes,
           COUNT(t.uid) FILTER (WHERE t.possedes > 0 OR NOT t.suivie)::int AS editions
      FROM comptes c
      LEFT JOIN par_suivi t ON t.uid = c.id
     GROUP BY c.id, c.identifiant, c.affiche
     ORDER BY tomes DESC, c.identifiant ASC
     LIMIT ${COMPTES_CLASSEMENT_MAX}`;

  return lignes.map((ligne) => ({
    identifiant: ligne.identifiant,
    nomVisible: identifiantVisible(ligne.affiche, ligne.identifiant) ?? ligne.identifiant,
    tomesPossedes: ligne.tomes,
    nombreEditions: ligne.editions,
  }));
}

export async function compteParIdentifiant(identifiant: string): Promise<CompteVisite | null> {
  const recherche = normaliserIdentifiant(identifiant);
  if (recherche === "") {
    return null;
  }

  const compte = await prisma.utilisateur.findUnique({
    where: { identifiant: recherche },
    select: { id: true, identifiant: true, identifiantAffiche: true, visible: true },
  });

  if (compte === null || compte.identifiant === null || !compte.visible) {
    return null;
  }

  return {
    id: compte.id,
    identifiant: compte.identifiant,
    nomVisible: identifiantVisible(compte.identifiantAffiche, compte.identifiant) ?? compte.identifiant,
  };
}
