-- CreateTable
CREATE TABLE "RelatorioLinks" (
    "id" TEXT NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "contratoTexto" TEXT,
    "contratoId" TEXT,
    "clienteId" TEXT,
    "servico" TEXT,
    "ativos" INTEGER,
    "cancelados" INTEGER,
    "conferido" BOOLEAN NOT NULL DEFAULT false,
    "avisos" JSONB NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioLinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkMpls" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "situacao" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "kbps" INTEGER,
    "redundancia" TEXT,
    "dataAceite" TIMESTAMP(3),
    "dataCancelamento" TIMESTAMP(3),
    "entidade" TEXT,
    "tipoLogradouro" TEXT,
    "endereco" TEXT,
    "numero" TEXT,

    CONSTRAINT "LinkMpls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioLinks_arquivoId_key" ON "RelatorioLinks"("arquivoId");

-- CreateIndex
CREATE INDEX "RelatorioLinks_ano_mes_idx" ON "RelatorioLinks"("ano", "mes");

-- CreateIndex
CREATE INDEX "RelatorioLinks_contratoId_ano_mes_idx" ON "RelatorioLinks"("contratoId", "ano", "mes");

-- CreateIndex
CREATE INDEX "RelatorioLinks_clienteId_idx" ON "RelatorioLinks"("clienteId");

-- CreateIndex
CREATE INDEX "LinkMpls_relatorioId_idx" ON "LinkMpls"("relatorioId");

-- CreateIndex
CREATE INDEX "LinkMpls_codigo_idx" ON "LinkMpls"("codigo");

-- AddForeignKey
ALTER TABLE "LinkMpls" ADD CONSTRAINT "LinkMpls_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioLinks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

