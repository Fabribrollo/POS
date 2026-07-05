-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Variante" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productoId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "talle" TEXT,
    "sku" TEXT,
    "codigoBarras" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Variante_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Variante" ("activo", "codigoBarras", "color", "createdAt", "id", "nombre", "productoId", "sku", "talle", "updatedAt") SELECT "activo", "codigoBarras", "color", "createdAt", "id", "nombre", "productoId", "sku", "talle", "updatedAt" FROM "Variante";
DROP TABLE "Variante";
ALTER TABLE "new_Variante" RENAME TO "Variante";
CREATE UNIQUE INDEX "Variante_sku_key" ON "Variante"("sku");
CREATE UNIQUE INDEX "Variante_codigoBarras_key" ON "Variante"("codigoBarras");
CREATE INDEX "Variante_productoId_idx" ON "Variante"("productoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

