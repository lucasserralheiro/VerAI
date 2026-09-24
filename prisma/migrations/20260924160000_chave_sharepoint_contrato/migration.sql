-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN "chaveSharepoint" TEXT;

-- AlterTable
ALTER TABLE "HistoricoContrato" ADD COLUMN "chaveSharepoint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_chaveSharepoint_key" ON "Contrato"("chaveSharepoint");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoContrato_chaveSharepoint_key" ON "HistoricoContrato"("chaveSharepoint");
