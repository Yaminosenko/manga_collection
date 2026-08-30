-- CreateTable
CREATE TABLE "Sortie" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isbn" TEXT,

    CONSTRAINT "Sortie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sortie_date_idx" ON "Sortie"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Sortie_editionId_numero_key" ON "Sortie"("editionId", "numero");

-- AddForeignKey
ALTER TABLE "Sortie" ADD CONSTRAINT "Sortie_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
