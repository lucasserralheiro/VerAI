-- DropForeignKey
ALTER TABLE "ArquivoCliente" DROP CONSTRAINT "ArquivoCliente_contratoId_fkey";

-- DropIndex
DROP INDEX "ArquivoCliente_contratoId_idx";

-- AlterTable
ALTER TABLE "ArquivoCliente" DROP COLUMN "competenciaAno",
DROP COLUMN "competenciaMes",
DROP COLUMN "contratoId";

