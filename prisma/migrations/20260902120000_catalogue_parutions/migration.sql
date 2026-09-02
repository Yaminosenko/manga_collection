-- CreateTable
CREATE TABLE "ParutionCatalogue" (
    "id" TEXT NOT NULL,
    "ean" TEXT,
    "titreBrut" TEXT NOT NULL,
    "serieTitre" TEXT NOT NULL,
    "serieNormalise" TEXT NOT NULL,
    "marqueurEdition" TEXT,
    "numero" INTEGER,
    "editeur" TEXT,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParutionCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParutionCatalogue_ean_idx" ON "ParutionCatalogue"("ean");

-- CreateIndex
CREATE INDEX "ParutionCatalogue_serieNormalise_idx" ON "ParutionCatalogue"("serieNormalise");

-- CreateIndex
CREATE UNIQUE INDEX "ParutionCatalogue_titreBrut_date_key" ON "ParutionCatalogue"("titreBrut", "date");
