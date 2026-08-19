-- CreateTable
CREATE TABLE "AnaliseEvolucao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competenciaAtualAno" INTEGER NOT NULL,
    "competenciaAtualMes" INTEGER NOT NULL,
    "competenciaAnteriorAno" INTEGER NOT NULL,
    "competenciaAnteriorMes" INTEGER NOT NULL,
    "metricasComparadas" JSONB NOT NULL,
    "resumo" TEXT NOT NULL,
    "pontosAtencao" JSONB NOT NULL,
    "melhorias" JSONB NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "caminhoRelatorioPdf" TEXT,
    "relatorioGeradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnaliseEvolucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnaliseEvolucao_clienteId_competenciaAtualAno_competenciaAt_key" ON "AnaliseEvolucao"("clienteId", "competenciaAtualAno", "competenciaAtualMes");

-- AddForeignKey
ALTER TABLE "AnaliseEvolucao" ADD CONSTRAINT "AnaliseEvolucao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
