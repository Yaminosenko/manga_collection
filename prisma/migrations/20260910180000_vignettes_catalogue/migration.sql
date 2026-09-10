-- AlterTable
ALTER TABLE "Volume" ADD COLUMN "couvertureRecupereeLe" TIMESTAMP(3);
ALTER TABLE "Sortie" ADD COLUMN "couvertureRecupereeLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "VignetteCatalogue" (
    "ean" TEXT NOT NULL,
    "couvertureUrl" TEXT,
    "source" TEXT,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "recupereeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VignetteCatalogue_pkey" PRIMARY KEY ("ean")
);

-- CreateIndex
CREATE INDEX "VignetteCatalogue_couvertureUrl_idx" ON "VignetteCatalogue"("couvertureUrl");
