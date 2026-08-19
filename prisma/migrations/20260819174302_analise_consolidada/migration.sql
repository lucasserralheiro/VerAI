-- CreateTable
CREATE TABLE "AnaliseConsolidada" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competenciaAno" INTEGER NOT NULL,
    "competenciaMes" INTEGER NOT NULL,
    "selecaoAssinatura" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "pontosCriticos" JSONB NOT NULL,
    "pontosPositivos" JSONB NOT NULL,
    "metricasComparadas" JSONB NOT NULL,
    "recomendacoes" JSONB,
    "promptVersion" TEXT NOT NULL,
    "caminhoRelatorioPdf" TEXT,
    "relatorioGeradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnaliseConsolidada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DocumentosDaConsolidada" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DocumentosDaConsolidada_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnaliseConsolidada_clienteId_competenciaAno_competenciaMes__key" ON "AnaliseConsolidada"("clienteId", "competenciaAno", "competenciaMes", "selecaoAssinatura");

-- CreateIndex
CREATE INDEX "_DocumentosDaConsolidada_B_index" ON "_DocumentosDaConsolidada"("B");

-- AddForeignKey
ALTER TABLE "AnaliseConsolidada" ADD CONSTRAINT "AnaliseConsolidada_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentosDaConsolidada" ADD CONSTRAINT "_DocumentosDaConsolidada_A_fkey" FOREIGN KEY ("A") REFERENCES "AnaliseConsolidada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DocumentosDaConsolidada" ADD CONSTRAINT "_DocumentosDaConsolidada_B_fkey" FOREIGN KEY ("B") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
