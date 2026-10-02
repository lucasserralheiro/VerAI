CREATE TABLE "AnexoAssistente" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "chaveR2" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ocr" BOOLEAN NOT NULL DEFAULT false,
    "paginas" INTEGER NOT NULL DEFAULT 0,
    "ficha" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnexoAssistente_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaginaAnexoAssistente" (
    "id" TEXT NOT NULL,
    "anexoId" TEXT NOT NULL,
    "pagina" INTEGER,
    "texto" TEXT NOT NULL,
    CONSTRAINT "PaginaAnexoAssistente_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnexoAssistente_conversaId_createdAt_idx" ON "AnexoAssistente"("conversaId", "createdAt");
CREATE INDEX "PaginaAnexoAssistente_anexoId_pagina_idx" ON "PaginaAnexoAssistente"("anexoId", "pagina");
ALTER TABLE "AnexoAssistente" ADD CONSTRAINT "AnexoAssistente_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaAssistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaginaAnexoAssistente" ADD CONSTRAINT "PaginaAnexoAssistente_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "AnexoAssistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
