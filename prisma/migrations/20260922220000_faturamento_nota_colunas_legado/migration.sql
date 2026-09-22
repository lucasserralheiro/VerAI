-- Task 6 (relatórios dos clientes): colunas reais de T_Faturamentos e T_NotaFiscal
-- que a importação descartava.

-- AlterTable
ALTER TABLE "Faturamento" ADD COLUMN     "complementar" BOOLEAN,
ADD COLUMN     "enviadoCliente" BOOLEAN,
ADD COLUMN     "enviadoGfp" BOOLEAN,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "sei" TEXT,
ADD COLUMN     "unidadeDestino" TEXT;

-- AlterTable
ALTER TABLE "NotaFiscal" ADD COLUMN     "complementar" BOOLEAN,
ADD COLUMN     "quantidade" DECIMAL(14,2),
ADD COLUMN     "servico" TEXT;

