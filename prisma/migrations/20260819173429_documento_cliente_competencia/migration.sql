/*
  Warnings:

  - Added the required column `clienteId` to the `Documento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competenciaAno` to the `Documento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `competenciaMes` to the `Documento` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Documento" ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "competenciaAno" INTEGER NOT NULL,
ADD COLUMN     "competenciaMes" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Documento_clienteId_competenciaAno_competenciaMes_idx" ON "Documento"("clienteId", "competenciaAno", "competenciaMes");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
