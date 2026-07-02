-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ItemVenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "varianteId" INTEGER,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "costoUnitario" DECIMAL NOT NULL DEFAULT 0,
    "descuento" DECIMAL NOT NULL DEFAULT 0,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "ItemVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItemVenta_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "Variante" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ItemVenta" ("cantidad", "descuento", "id", "precioUnitario", "productoId", "subtotal", "varianteId", "ventaId") SELECT "cantidad", "descuento", "id", "precioUnitario", "productoId", "subtotal", "varianteId", "ventaId" FROM "ItemVenta";
DROP TABLE "ItemVenta";
ALTER TABLE "new_ItemVenta" RENAME TO "ItemVenta";
CREATE INDEX "ItemVenta_ventaId_idx" ON "ItemVenta"("ventaId");
CREATE INDEX "ItemVenta_productoId_idx" ON "ItemVenta"("productoId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
