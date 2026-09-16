-- Resultado da conferência determinística de totais (PDF x documento),
-- salvo pra não recalcular a cada F5 — só depende dos PDFs e do documento
-- salvo, igual à checagem por IA (checagemIa/checagemIaEm).
ALTER TABLE "PropostaComercial" ADD COLUMN IF NOT EXISTS "conferenciaTotais" JSONB;
ALTER TABLE "PropostaComercial" ADD COLUMN IF NOT EXISTS "conferenciaTotaisEm" TIMESTAMP(3);
