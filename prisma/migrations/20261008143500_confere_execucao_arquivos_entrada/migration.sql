-- ConfereAI: o histórico passa a guardar os PDFs de entrada (contrato e aditivos) de cada execução,
-- para abrir o item no contrato a partir de /confere/historico/[id]. Só coluna nova, com padrão.
ALTER TABLE "ConfereExecucao" ADD COLUMN "arquivosEntrada" JSONB NOT NULL DEFAULT '[]';
