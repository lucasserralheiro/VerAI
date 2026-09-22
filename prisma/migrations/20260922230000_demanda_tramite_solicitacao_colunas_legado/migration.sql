-- Task 7 (relatórios dos clientes): colunas reais de T_Documento, T_Trâmite e
-- T_Solicitação que a importação descartava ou concatenava em outro campo.

-- AlterTable
ALTER TABLE "Demanda" ADD COLUMN     "documento" TEXT,
ADD COLUMN     "notaImportacao" TEXT,
ADD COLUMN     "sei" TEXT,
ADD COLUMN     "tipoAssunto" TEXT;

-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "comVisita" BOOLEAN,
ADD COLUMN     "dataFinal" TIMESTAMP(3),
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "observacao" TEXT;

-- AlterTable
ALTER TABLE "TramiteDemanda" ADD COLUMN     "assinado" BOOLEAN,
ADD COLUMN     "comApresentacao" BOOLEAN,
ADD COLUMN     "dataRetorno" TIMESTAMP(3),
ADD COLUMN     "responsavelAtual" TEXT;

