ALTER TABLE "Utilisateur" ADD COLUMN "identifiantAffiche" TEXT;

UPDATE "Utilisateur" SET "identifiantAffiche" = "identifiant" WHERE "identifiant" IS NOT NULL;
