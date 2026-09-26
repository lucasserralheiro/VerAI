-- Textos oficiais (leis, decretos, regulamentos) consultados pelo assistente
-- (spec docs/superpowers/specs/2026-09-25-assistente-senior-design.md §4.2).
ALTER TYPE "OrigemTrecho" ADD VALUE 'REFERENCIA';

CREATE TABLE "DocumentoReferencia" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "nomeArquivo" TEXT NOT NULL,
  "urlBlob" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "tamanhoBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removidoEm" TIMESTAMP(3),
  CONSTRAINT "DocumentoReferencia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentoReferencia_sha256_key" ON "DocumentoReferencia"("sha256");
