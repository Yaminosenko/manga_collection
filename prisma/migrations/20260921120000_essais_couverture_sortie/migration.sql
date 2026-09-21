ALTER TABLE "Sortie" ADD COLUMN "couvertureTenteeLe" TIMESTAMP(3);
ALTER TABLE "Sortie" ADD COLUMN "couvertureTentatives" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Sortie_couvertureUrl_couvertureTenteeLe_idx"
  ON "Sortie"("couvertureUrl", "couvertureTenteeLe");
