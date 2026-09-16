ALTER TABLE "Utilisateur" ADD COLUMN "identifiant" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN "motDePasseHash" TEXT;
ALTER TABLE "Utilisateur" ADD COLUMN "versionJeton" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "Utilisateur_identifiant_key" ON "Utilisateur"("identifiant");
