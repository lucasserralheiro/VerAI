-- AlterEnum
ALTER TYPE "OrigemArquivo" ADD VALUE 'sharepoint';

-- CreateTable
CREATE TABLE "ArquivoSharepoint" (
    "id" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "pastaContrato" TEXT,
    "tamanhoBytes" INTEGER NOT NULL,
    "modificadoEm" TIMESTAMP(3) NOT NULL,
    "sha256" TEXT NOT NULL,
    "arquivoId" TEXT,
    "vistoEm" TIMESTAMP(3) NOT NULL,
    "removidoNaOrigemEm" TIMESTAMP(3),

    CONSTRAINT "ArquivoSharepoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArquivoSharepoint_caminho_key" ON "ArquivoSharepoint"("caminho");

-- CreateIndex
CREATE INDEX "ArquivoSharepoint_arquivoId_idx" ON "ArquivoSharepoint"("arquivoId");

-- AddForeignKey
ALTER TABLE "ArquivoSharepoint" ADD CONSTRAINT "ArquivoSharepoint_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "ArquivoCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
