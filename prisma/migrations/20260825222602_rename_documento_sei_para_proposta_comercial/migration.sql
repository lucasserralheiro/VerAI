/*
  Warnings:

  - You are about to drop the `DocumentoSei` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DocumentoSei" DROP CONSTRAINT "DocumentoSei_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentoSei" DROP CONSTRAINT "DocumentoSei_uploadedById_fkey";

-- DropTable
DROP TABLE "DocumentoSei";

-- CreateTable
CREATE TABLE "PropostaComercial" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "caminhoOriginal" TEXT NOT NULL,
    "conteudoMarkdown" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "mensagemErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaComercial_pkey" PRIMARY KEY ("id")
);
