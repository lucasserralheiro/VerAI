-- Histórico do ConfereAI (`/confere`): nome dos arquivos submetidos e os dois
-- documentos gerados. A geração continua sem estado — ver o comentário do
-- model `ConfereExecucao` em prisma/schema.prisma.

-- CreateTable
CREATE TABLE "ConfereExecucao" (
    "id" TEXT NOT NULL,
    "nomeContrato" TEXT NOT NULL,
    "nomeLevantamento" TEXT NOT NULL,
    "nomesAditivos" JSONB NOT NULL DEFAULT '[]',
    "caminhoDocx" TEXT NOT NULL,
    "caminhoXlsx" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfereExecucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfereExecucao_createdAt_idx" ON "ConfereExecucao"("createdAt");
