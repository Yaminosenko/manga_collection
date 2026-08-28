-- CreateEnum
CREATE TYPE "StatutEdition" AS ENUM ('EN_COURS', 'ABANDONNEE', 'EN_PAUSE', 'VENDUE');

-- CreateTable
CREATE TABLE "Serie" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "titreVo" TEXT,
    "auteur" TEXT NOT NULL,
    "genres" TEXT[],
    "themes" TEXT[],
    "cible" TEXT,
    "couvertureUrl" TEXT,

    CONSTRAINT "Serie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "editeur" TEXT,
    "tomesParus" INTEGER NOT NULL,
    "editionTerminee" BOOLEAN,
    "prixDefautCentimes" INTEGER,
    "statut" "StatutEdition" NOT NULL,
    "termineeForcee" BOOLEAN NOT NULL DEFAULT false,
    "raisonCompletion" TEXT,
    "aVerifier" BOOLEAN NOT NULL DEFAULT false,
    "slugMangaNews" TEXT,
    "couvertureUrl" TEXT,
    "ajouteeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "isbn" TEXT,
    "dateSortie" TIMESTAMP(3),
    "prixCentimes" INTEGER,
    "couvertureUrl" TEXT,

    CONSTRAINT "Volume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Possession" (
    "id" TEXT NOT NULL,
    "volumeId" TEXT NOT NULL,
    "possede" BOOLEAN NOT NULL DEFAULT false,
    "dateAchat" TIMESTAMP(3),
    "prixPayeCentimes" INTEGER,
    "etat" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "note" INTEGER,

    CONSTRAINT "Possession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Serie_slug_key" ON "Serie"("slug");

-- CreateIndex
CREATE INDEX "Serie_titre_idx" ON "Serie"("titre");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_slug_key" ON "Edition"("slug");

-- CreateIndex
CREATE INDEX "Edition_serieId_idx" ON "Edition"("serieId");

-- CreateIndex
CREATE INDEX "Edition_statut_idx" ON "Edition"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Volume_editionId_numero_key" ON "Volume"("editionId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Possession_volumeId_key" ON "Possession"("volumeId");

-- CreateIndex
CREATE INDEX "Possession_possede_idx" ON "Possession"("possede");

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volume" ADD CONSTRAINT "Volume_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Possession" ADD CONSTRAINT "Possession_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
