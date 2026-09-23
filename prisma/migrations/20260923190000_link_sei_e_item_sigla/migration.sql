-- Link do processo SEI cadastrado pelo usuário, por número; e a sigla do cliente no item do legado.

-- CreateTable
CREATE TABLE "LinkSei" (
    "id" TEXT NOT NULL,
    "digitos" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkSei_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkSei_digitos_key" ON "LinkSei"("digitos");

-- AlterTable
ALTER TABLE "ItemContrato" ADD COLUMN     "clienteSiglaLegado" TEXT;

-- CreateIndex
CREATE INDEX "ItemContrato_clienteSiglaLegado_idx" ON "ItemContrato"("clienteSiglaLegado");
