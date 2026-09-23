-- CreateEnum
CREATE TYPE "CategoriaArquivo" AS ENUM ('PROPOSTA_COMERCIAL', 'PROPOSTA_ADITIVO', 'TERMO_CONTRATO', 'TERMO_ADITIVO', 'MEDICAO', 'FATURA_NF', 'PLANILHA', 'OFICIO_SEI', 'RELATORIO_GERADO', 'OUTRO');

-- CreateEnum
CREATE TYPE "OrigemArquivo" AS ENUM ('upload', 'gerado', 'migrado');

-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "arquivoId" TEXT;

-- CreateTable
CREATE TABLE "ArquivoCliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contratoId" TEXT,
    "competenciaAno" INTEGER,
    "competenciaMes" INTEGER,
    "categoria" "CategoriaArquivo" NOT NULL,
    "nome" TEXT NOT NULL,
    "extensao" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "urlBlob" TEXT NOT NULL,
    "origem" "OrigemArquivo" NOT NULL,
    "enviadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removidoEm" TIMESTAMP(3),

    CONSTRAINT "ArquivoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoArquivo" (
    "id" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArquivoCliente_clienteId_createdAt_idx" ON "ArquivoCliente"("clienteId", "createdAt");

-- CreateIndex
CREATE INDEX "ArquivoCliente_clienteId_categoria_idx" ON "ArquivoCliente"("clienteId", "categoria");

-- CreateIndex
CREATE INDEX "ArquivoCliente_contratoId_idx" ON "ArquivoCliente"("contratoId");

-- CreateIndex
CREATE INDEX "AcessoArquivo_arquivoId_idx" ON "AcessoArquivo"("arquivoId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArquivoCliente" ADD CONSTRAINT "ArquivoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArquivoCliente" ADD CONSTRAINT "ArquivoCliente_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArquivoCliente" ADD CONSTRAINT "ArquivoCliente_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoArquivo" ADD CONSTRAINT "AcessoArquivo_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoArquivo" ADD CONSTRAINT "AcessoArquivo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Mesmo conteúdo no mesmo cliente é um registro só (spec §3.4 regra 1). Parcial: um arquivo
-- removido (lógico) não impede reenviar o mesmo conteúdo.
CREATE UNIQUE INDEX "ArquivoCliente_clienteId_sha256_ativo_key"
  ON "ArquivoCliente" ("clienteId", "sha256")
  WHERE "removidoEm" IS NULL;
