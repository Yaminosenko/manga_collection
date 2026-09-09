-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "ParutionCatalogue_serieNormalise_trgm_idx" ON "ParutionCatalogue" USING GIN ("serieNormalise" gin_trgm_ops);
