-- AlterTable
ALTER TABLE "Possession" ADD COLUMN "utilisateurId" TEXT;

-- BackfillUtilisateur
UPDATE "Possession" SET "utilisateurId" = 'f087527f-bbda-41d2-ba57-0671ca0169fe';

-- AlterTable
ALTER TABLE "Possession" ALTER COLUMN "utilisateurId" SET NOT NULL;

-- DropIndex
DROP INDEX "Possession_volumeId_key";

-- DropIndex
DROP INDEX "Possession_possede_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Possession_utilisateurId_volumeId_key" ON "Possession"("utilisateurId", "volumeId");

-- CreateIndex
CREATE INDEX "Possession_utilisateurId_possede_idx" ON "Possession"("utilisateurId", "possede");

-- AddForeignKey
ALTER TABLE "Possession" ADD CONSTRAINT "Possession_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
