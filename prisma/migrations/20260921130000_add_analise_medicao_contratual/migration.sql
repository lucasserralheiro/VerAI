-- Integração com o Confere (docs/superpowers/specs/2026-09-21-integracao-confere-design.md):
-- análise de medição contratual, com arquivos de entrada dedicados (não
-- reaproveita Documento).

-- CreateTable
CREATE TABLE "AnaliseMedicaoContratual" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competenciaAno" INTEGER NOT NULL,
    "competenciaMes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processando',
    "mensagemErro" TEXT,
    "identidadeConfirmada" BOOLEAN NOT NULL DEFAULT false,
    "resultado" JSONB,
    "achadosBloqueio" JSONB,
    "caminhoRelatorioDocx" TEXT,
    "caminhoRelatorioXlsx" TEXT,
    "relatorioGeradoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnaliseMedicaoContratual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnaliseMedicaoContratualArquivo" (
    "id" TEXT NOT NULL,
    "analiseId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "caminhoOriginal" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnaliseMedicaoContratualArquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnaliseMedicaoContratual_clienteId_competenciaAno_competenc_key" ON "AnaliseMedicaoContratual"("clienteId", "competenciaAno", "competenciaMes");

-- CreateIndex
CREATE INDEX "AnaliseMedicaoContratualArquivo_analiseId_idx" ON "AnaliseMedicaoContratualArquivo"("analiseId");

-- AddForeignKey
ALTER TABLE "AnaliseMedicaoContratual" ADD CONSTRAINT "AnaliseMedicaoContratual_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseMedicaoContratualArquivo" ADD CONSTRAINT "AnaliseMedicaoContratualArquivo_analiseId_fkey" FOREIGN KEY ("analiseId") REFERENCES "AnaliseMedicaoContratual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
