-- PDFs anexados às linhas do histórico do contrato: PC/PA (proposta) e TC/TA (termo).

-- AlterTable
ALTER TABLE "HistoricoContrato" ADD COLUMN     "propostaPdfNome" TEXT,
ADD COLUMN     "propostaPdfUrl" TEXT,
ADD COLUMN     "termoPdfNome" TEXT,
ADD COLUMN     "termoPdfUrl" TEXT;
