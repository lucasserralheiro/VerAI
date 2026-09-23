-- PDF anexado manualmente ao faturamento (ícone "ver PDF" na tabela da aba Faturamento).

-- AlterTable
ALTER TABLE "Faturamento" ADD COLUMN     "pdfNomeArquivo" TEXT,
ADD COLUMN     "pdfUrl" TEXT;
