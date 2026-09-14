-- Resultado da checagem por IA da conversão, salvo pra não refazer a cada F5.
-- A checagem só depende dos PDFs da proposta (texto original × conversão
-- determinística), então vale enquanto os arquivos forem os mesmos.
ALTER TABLE "PropostaComercial" ADD COLUMN IF NOT EXISTS "checagemIa" JSONB;
ALTER TABLE "PropostaComercial" ADD COLUMN IF NOT EXISTS "checagemIaEm" TIMESTAMP(3);
