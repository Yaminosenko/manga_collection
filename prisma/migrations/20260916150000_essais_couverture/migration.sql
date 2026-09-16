ALTER TABLE "Serie" ADD COLUMN "idMangaDex" TEXT;

ALTER TABLE "Volume" ADD COLUMN "couvertureTenteeLe" TIMESTAMP(3);
ALTER TABLE "Volume" ADD COLUMN "couvertureTentatives" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Volume_couvertureUrl_couvertureTenteeLe_idx"
  ON "Volume"("couvertureUrl", "couvertureTenteeLe");
