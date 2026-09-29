-- Controles de Contratos (spec 2026-09-29-controles-de-contratos). Só tabelas novas: o agendador roda contra
-- produção com o cliente gerado na pasta do projeto.
CREATE TABLE "ControleContrato" (
    "id" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mesAno" INTEGER NOT NULL,
    "mesMes" INTEGER NOT NULL,
    "sigla" TEXT NOT NULL,
    "contratoTexto" TEXT,
    "contratoId" TEXT,
    "clienteId" TEXT,
    "termoTexto" TEXT,
    "vigenciaTexto" TEXT,
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFim" TIMESTAMP(3),
    "previstoTotal" DECIMAL(14,2),
    "faturadoTotal" DECIMAL(14,2),
    "saldoTotal" DECIMAL(14,2),
    "previstoConferido" BOOLEAN NOT NULL DEFAULT false,
    "faturadoConferido" BOOLEAN NOT NULL DEFAULT false,
    "avisos" JSONB NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ControleContrato_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ControleContrato_arquivoId_key" ON "ControleContrato"("arquivoId");
CREATE INDEX "ControleContrato_contratoId_mesAno_mesMes_idx" ON "ControleContrato"("contratoId", "mesAno", "mesMes");
CREATE INDEX "ControleContrato_mesAno_mesMes_idx" ON "ControleContrato"("mesAno", "mesMes");

CREATE TABLE "ControleContratoLinha" (
    "id" TEXT NOT NULL,
    "controleId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "rotulo" TEXT NOT NULL,
    "inicio" TIMESTAMP(3),
    "fim" TIMESTAMP(3),
    "valor" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "ControleContratoLinha_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ControleContratoLinha_controleId_idx" ON "ControleContratoLinha"("controleId");
ALTER TABLE "ControleContratoLinha" ADD CONSTRAINT "ControleContratoLinha_controleId_fkey" FOREIGN KEY ("controleId") REFERENCES "ControleContrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
