-- DropForeignKey
ALTER TABLE "ItemContrato" DROP CONSTRAINT "ItemContrato_contratoId_fkey";

-- AlterTable
ALTER TABLE "ItemContrato" ADD COLUMN     "contratoTextoLegado" TEXT,
ALTER COLUMN "contratoId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "ItemContrato" ADD CONSTRAINT "ItemContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

