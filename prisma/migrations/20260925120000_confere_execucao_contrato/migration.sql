-- ConfereExecucao passa a dizer de qual contrato e competência foi o relatório
-- (docs/superpowers/specs/2026-09-25-confere-contrato-do-cadastro-design.md §7.4).
ALTER TABLE "ConfereExecucao" ADD COLUMN "contratoId" TEXT;
ALTER TABLE "ConfereExecucao" ADD COLUMN "competenciaAno" INTEGER;
ALTER TABLE "ConfereExecucao" ADD COLUMN "competenciaMes" INTEGER;

CREATE INDEX "ConfereExecucao_contratoId_idx" ON "ConfereExecucao"("contratoId");

ALTER TABLE "ConfereExecucao" ADD CONSTRAINT "ConfereExecucao_contratoId_fkey"
  FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
