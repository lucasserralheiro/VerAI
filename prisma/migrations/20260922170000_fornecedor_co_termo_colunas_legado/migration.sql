-- Task 4 (relatórios dos clientes): colunas reais de T_Fornecedor,
-- T_CO_Operacionalização e T_TermoConfirmação que a importação descartava.

-- AlterTable
ALTER TABLE "ContratoOperacionalizacao" ADD COLUMN     "sei" TEXT;

-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "acordo" TEXT,
ADD COLUMN     "dataAssinatura" TIMESTAMP(3),
ADD COLUMN     "numeroAcordo" TEXT,
ADD COLUMN     "sei" TEXT;

-- AlterTable — "data" vira "vigenciaInicio" por rename (o diff gerado fazia
-- DROP + ADD, o que apagaria o valor já importado).
ALTER TABLE "TermoConfirmacao" RENAME COLUMN "data" TO "vigenciaInicio";

ALTER TABLE "TermoConfirmacao" ADD COLUMN     "numero" TEXT,
ADD COLUMN     "sei" TEXT,
ADD COLUMN     "valor" DECIMAL(14,2),
ADD COLUMN     "vigenciaFim" TIMESTAMP(3);
