-- Valor, vigência e assinatura com prova (spec 2026-09-29-valor-vigencia-contratos §0). Só tabelas novas: o
-- agendador roda contra produção com o cliente gerado na pasta do projeto.
CREATE TABLE "LinhaPlanilhaContratos" (
    "id" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "linha" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "contratoTexto" TEXT NOT NULL,
    "chave" TEXT,
    "termoTexto" TEXT,
    "termoNumero" INTEGER,
    "tipoTermo" TEXT,
    "valor" DECIMAL(14,2),
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "statusFormalizacao" TEXT,
    CONSTRAINT "LinhaPlanilhaContratos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LinhaPlanilhaContratos_chave_idx" ON "LinhaPlanilhaContratos"("chave");
CREATE INDEX "LinhaPlanilhaContratos_arquivoId_idx" ON "LinhaPlanilhaContratos"("arquivoId");

CREATE TABLE "OrigemCampoHistorico" (
    "id" TEXT NOT NULL,
    "historicoId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "prova" JSONB NOT NULL,
    "gravadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrigemCampoHistorico_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrigemCampoHistorico_historicoId_campo_key" ON "OrigemCampoHistorico"("historicoId", "campo");
CREATE INDEX "OrigemCampoHistorico_historicoId_idx" ON "OrigemCampoHistorico"("historicoId");
