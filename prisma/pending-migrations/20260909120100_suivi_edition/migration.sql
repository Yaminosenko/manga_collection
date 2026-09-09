-- CreateTable
CREATE TABLE "SuiviEdition" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "statut" "StatutEdition" NOT NULL,
    "suivie" BOOLEAN NOT NULL DEFAULT true,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuiviEdition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuiviEdition_utilisateurId_editionId_key" ON "SuiviEdition"("utilisateurId", "editionId");

-- CreateIndex
CREATE INDEX "SuiviEdition_utilisateurId_idx" ON "SuiviEdition"("utilisateurId");

-- CreateIndex
CREATE INDEX "SuiviEdition_utilisateurId_suivie_idx" ON "SuiviEdition"("utilisateurId", "suivie");

-- AddForeignKey
ALTER TABLE "SuiviEdition" ADD CONSTRAINT "SuiviEdition_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviEdition" ADD CONSTRAINT "SuiviEdition_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BackfillSuiviEdition
INSERT INTO "SuiviEdition" ("id", "utilisateurId", "editionId", "statut", "suivie", "ajouteeLe")
SELECT
    gen_random_uuid(),
    'f087527f-bbda-41d2-ba57-0671ca0169fe',
    "Edition"."id",
    "Edition"."statut",
    ("Edition"."statut" = 'EN_COURS' AND "Edition"."termineeForcee" = false),
    "Edition"."ajouteeLe"
FROM "Edition";

-- AlterTable
ALTER TABLE "Edition" ADD COLUMN "creeeParId" TEXT;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_creeeParId_fkey" FOREIGN KEY ("creeeParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "Edition_statut_idx";

-- AlterTable
ALTER TABLE "Edition"
    DROP COLUMN "statut",
    DROP COLUMN "termineeForcee",
    DROP COLUMN "raisonCompletion",
    DROP COLUMN "aVerifier",
    DROP COLUMN "ajouteeLe";
