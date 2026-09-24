-- Termo de confirmação passa a guardar o CO (contrato de operacionalização) a que se refere.
ALTER TABLE "TermoConfirmacao" ADD COLUMN "contratoOperacionalizacaoId" TEXT;

CREATE INDEX "TermoConfirmacao_contratoOperacionalizacaoId_idx" ON "TermoConfirmacao"("contratoOperacionalizacaoId");

ALTER TABLE "TermoConfirmacao" ADD CONSTRAINT "TermoConfirmacao_contratoOperacionalizacaoId_fkey" FOREIGN KEY ("contratoOperacionalizacaoId") REFERENCES "ContratoOperacionalizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
