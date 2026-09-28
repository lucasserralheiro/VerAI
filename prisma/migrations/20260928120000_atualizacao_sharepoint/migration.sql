-- Passadas completas da sincronização do SharePoint, para as telas mostrarem a data
-- (docs/superpowers/specs/2026-09-28-sharepoint-atualizado-em-design.md).

-- CreateTable
CREATE TABLE "AtualizacaoSharepoint" (
    "id" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivos" INTEGER NOT NULL,

    CONSTRAINT "AtualizacaoSharepoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AtualizacaoSharepoint_iniciadaEm_idx" ON "AtualizacaoSharepoint"("iniciadaEm");
