-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('PROPRIETAIRE', 'UTILISATEUR');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "nom" TEXT,
    "role" "RoleUtilisateur" NOT NULL DEFAULT 'UTILISATEUR',
    "aPaye" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- InsertOwner
INSERT INTO "Utilisateur" ("id", "email", "nom", "role")
VALUES ('f087527f-bbda-41d2-ba57-0671ca0169fe', NULL, NULL, 'PROPRIETAIRE');

-- AlterTable
ALTER TABLE "Serie" ADD COLUMN "alias" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- BackfillAlias
UPDATE "Serie" SET "alias" = ARRAY["titreVo"] WHERE "titreVo" IS NOT NULL AND "titreVo" <> '';

-- CreateIndex
CREATE INDEX "Serie_alias_idx" ON "Serie" USING GIN ("alias");
