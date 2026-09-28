-- AlterTable
ALTER TABLE "PropostaComercialArquivo" ADD COLUMN "arquivoClienteId" TEXT;

-- CreateIndex
CREATE INDEX "PropostaComercialArquivo_arquivoClienteId_idx" ON "PropostaComercialArquivo"("arquivoClienteId");

-- AddForeignKey
ALTER TABLE "PropostaComercialArquivo" ADD CONSTRAINT "PropostaComercialArquivo_arquivoClienteId_fkey" FOREIGN KEY ("arquivoClienteId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
