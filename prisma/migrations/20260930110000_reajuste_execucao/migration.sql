-- Histórico do reajuste por IPC-Fipe (spec 2026-09-30-reajuste-ipc-fipe-design §3). Só tabela nova.
CREATE TABLE "ReajusteExecucao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipoArquivo" TEXT NOT NULL,
    "chaveOriginal" TEXT NOT NULL,
    "chaveResultado" TEXT NOT NULL,
    "mesInicial" DATE NOT NULL,
    "mesFinal" DATE NOT NULL,
    "fator" DECIMAL(12,8) NOT NULL,
    "acumuladoPct" DECIMAL(9,2) NOT NULL,
    "meses" JSONB NOT NULL,
    "quantidadeValores" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReajusteExecucao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReajusteExecucao_createdAt_idx" ON "ReajusteExecucao"("createdAt");
ALTER TABLE "ReajusteExecucao" ADD CONSTRAINT "ReajusteExecucao_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
