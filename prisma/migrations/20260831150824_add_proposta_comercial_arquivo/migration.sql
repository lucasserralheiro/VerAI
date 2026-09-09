/*
  Warnings:

  - You are about to drop the column `caminhoOriginal` on the `PropostaComercial` table. Cada arquivo agora tem seu próprio `caminhoOriginal` na nova tabela `PropostaComercialArquivo`. Propostas já existentes perdem a referência ao PDF original (o conteúdo em Markdown já convertido continua intacto).

*/
-- AlterTable
ALTER TABLE "PropostaComercial" DROP COLUMN "caminhoOriginal";

-- CreateTable
CREATE TABLE "PropostaComercialArquivo" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "caminhoOriginal" TEXT NOT NULL,
    "conteudoExtraido" TEXT,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaComercialArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaComercialArquivo_propostaId_idx" ON "PropostaComercialArquivo"("propostaId");

-- AddForeignKey
ALTER TABLE "PropostaComercialArquivo" ADD CONSTRAINT "PropostaComercialArquivo_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
