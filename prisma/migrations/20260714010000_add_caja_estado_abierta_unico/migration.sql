-- AlterTable
ALTER TABLE "Caja" ADD COLUMN "estadoAbierta" BOOLEAN;

-- Backfill: la caja que ya está ABIERTA (si hay alguna) pasa a tener
-- estadoAbierta true, las cerradas quedan en NULL (default de la columna).
UPDATE "Caja" SET "estadoAbierta" = true WHERE "estado" = 'ABIERTA';

-- CreateIndex
CREATE UNIQUE INDEX "Caja_estadoAbierta_key" ON "Caja"("estadoAbierta");
