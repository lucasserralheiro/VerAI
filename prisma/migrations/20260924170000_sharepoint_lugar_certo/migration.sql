-- AlterEnum
ALTER TYPE "CategoriaArquivo" ADD VALUE 'PUBLICACAO_DOC';

-- AlterTable
ALTER TABLE "ArquivoSharepoint" ADD COLUMN     "contratoId" TEXT,
ADD COLUMN     "historicoId" TEXT;

-- AlterTable
ALTER TABLE "HistoricoContrato" ADD COLUMN     "propostaArquivoId" TEXT,
ADD COLUMN     "propostaDoSharepoint" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termoArquivoId" TEXT,
ADD COLUMN     "termoDoSharepoint" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ArquivoSharepoint_contratoId_idx" ON "ArquivoSharepoint"("contratoId");

-- CreateIndex
CREATE INDEX "ArquivoSharepoint_historicoId_idx" ON "ArquivoSharepoint"("historicoId");

-- CreateIndex
CREATE INDEX "HistoricoContrato_propostaArquivoId_idx" ON "HistoricoContrato"("propostaArquivoId");

-- CreateIndex
CREATE INDEX "HistoricoContrato_termoArquivoId_idx" ON "HistoricoContrato"("termoArquivoId");

-- AddForeignKey
ALTER TABLE "HistoricoContrato" ADD CONSTRAINT "HistoricoContrato_propostaArquivoId_fkey" FOREIGN KEY ("propostaArquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoContrato" ADD CONSTRAINT "HistoricoContrato_termoArquivoId_fkey" FOREIGN KEY ("termoArquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArquivoSharepoint" ADD CONSTRAINT "ArquivoSharepoint_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArquivoSharepoint" ADD CONSTRAINT "ArquivoSharepoint_historicoId_fkey" FOREIGN KEY ("historicoId") REFERENCES "HistoricoContrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
