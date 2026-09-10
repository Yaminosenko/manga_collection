-- AlterTable
ALTER TABLE "Serie" ADD COLUMN "aliasNormalises" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Serie" ADD COLUMN "idMangaBaka" INTEGER;

-- CreateIndex
CREATE INDEX "Serie_aliasNormalises_idx" ON "Serie" USING GIN ("aliasNormalises");

-- CreateTable
CREATE TABLE "AliasRecherche" (
    "normalise" TEXT NOT NULL,
    "terme" TEXT NOT NULL,
    "titres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "idMangaBaka" INTEGER,
    "utilisations" INTEGER NOT NULL DEFAULT 1,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AliasRecherche_pkey" PRIMARY KEY ("normalise")
);
