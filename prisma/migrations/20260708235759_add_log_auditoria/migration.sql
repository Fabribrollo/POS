-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" INTEGER,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER,
    "detalle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidad_entidadId_idx" ON "LogAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "LogAuditoria_accion_idx" ON "LogAuditoria"("accion");

-- CreateIndex
CREATE INDEX "LogAuditoria_createdAt_idx" ON "LogAuditoria"("createdAt");
