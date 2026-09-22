-- Task 5 (relatórios dos clientes): colunas reais de T_ContratoReceita e T_Propostas
-- que a importação descartava.

-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "dataInicio" TIMESTAMP(3),
ADD COLUMN     "dataVencimento" TIMESTAMP(3),
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "linkSei" TEXT,
ADD COLUMN     "vigente" BOOLEAN;

-- AlterTable
ALTER TABLE "HistoricoContrato" ADD COLUMN     "dataEnvio" TIMESTAMP(3),
ADD COLUMN     "dataInicio" TIMESTAMP(3),
ADD COLUMN     "dataVencimento" TIMESTAMP(3),
ADD COLUMN     "objeto" TEXT,
ADD COLUMN     "proposta" TEXT,
ADD COLUMN     "situacao" TEXT;

