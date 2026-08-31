-- CreateEnum
CREATE TYPE "TypeLienSerie" AS ENUM ('PREQUELLE', 'SUITE', 'SERIE_MERE', 'HORS_SERIE', 'SPIN_OFF', 'GUIDE', 'AUTRE');

-- CreateTable
CREATE TABLE "LienSerie" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "serieLieeId" TEXT NOT NULL,
    "type" "TypeLienSerie" NOT NULL,

    CONSTRAINT "LienSerie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LienSerie_serieId_idx" ON "LienSerie"("serieId");

-- CreateIndex
CREATE UNIQUE INDEX "LienSerie_serieId_serieLieeId_key" ON "LienSerie"("serieId", "serieLieeId");

-- AddForeignKey
ALTER TABLE "LienSerie" ADD CONSTRAINT "LienSerie_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Serie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienSerie" ADD CONSTRAINT "LienSerie_serieLieeId_fkey" FOREIGN KEY ("serieLieeId") REFERENCES "Serie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
