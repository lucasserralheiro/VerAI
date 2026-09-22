-- CreateEnum
CREATE TYPE "TipoHistoricoContrato" AS ENUM ('CONTRATO', 'ADITIVO', 'PRORROGACAO', 'RESCISAO', 'PROSPECCAO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "siglaLegado" TEXT;

-- CreateTable
CREATE TABLE "ResponsavelCliente" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "area" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "celular" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponsavelCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT,
    "contato" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoOperacionalizacao" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "fornecedorId" TEXT NOT NULL,
    "numero" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "valor" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContratoOperacionalizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermoConfirmacao" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "fornecedorId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contratoId" TEXT,
    "data" TIMESTAMP(3),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermoConfirmacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "clienteId" TEXT NOT NULL,
    "numeroTermo" TEXT,
    "seiCliente" TEXT,
    "seiProdam" TEXT,
    "situacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoContrato" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "contratoId" TEXT NOT NULL,
    "tipo" "TipoHistoricoContrato" NOT NULL,
    "numero" TEXT,
    "data" TIMESTAMP(3),
    "valor" DECIMAL(14,2),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemContrato" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "contratoId" TEXT NOT NULL,
    "descricao" TEXT,
    "quantidade" DECIMAL(14,2),
    "valorUnitario" DECIMAL(14,2),
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faturamento" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "contratoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "competenciaAno" INTEGER,
    "competenciaMes" INTEGER,
    "valor" DECIMAL(14,2),
    "situacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Faturamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "faturamentoId" TEXT NOT NULL,
    "numero" TEXT,
    "valor" DECIMAL(14,2),
    "dataEmissao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demanda" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "clienteId" TEXT NOT NULL,
    "assunto" TEXT,
    "tipo" TEXT,
    "responsavel" TEXT,
    "situacao" TEXT,
    "dataAbertura" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Demanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TramiteDemanda" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "demandaId" TEXT NOT NULL,
    "data" TIMESTAMP(3),
    "posicao" TEXT,
    "acao" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TramiteDemanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitacao" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT,
    "descricao" TEXT,
    "situacao" TEXT,
    "dataAbertura" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponsavelCliente_legacyId_key" ON "ResponsavelCliente"("legacyId");

-- CreateIndex
CREATE INDEX "ResponsavelCliente_clienteId_idx" ON "ResponsavelCliente"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_legacyId_key" ON "Fornecedor"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoOperacionalizacao_legacyId_key" ON "ContratoOperacionalizacao"("legacyId");

-- CreateIndex
CREATE INDEX "ContratoOperacionalizacao_fornecedorId_idx" ON "ContratoOperacionalizacao"("fornecedorId");

-- CreateIndex
CREATE UNIQUE INDEX "TermoConfirmacao_legacyId_key" ON "TermoConfirmacao"("legacyId");

-- CreateIndex
CREATE INDEX "TermoConfirmacao_fornecedorId_idx" ON "TermoConfirmacao"("fornecedorId");

-- CreateIndex
CREATE INDEX "TermoConfirmacao_clienteId_idx" ON "TermoConfirmacao"("clienteId");

-- CreateIndex
CREATE INDEX "TermoConfirmacao_contratoId_idx" ON "TermoConfirmacao"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "Contrato_legacyId_key" ON "Contrato"("legacyId");

-- CreateIndex
CREATE INDEX "Contrato_clienteId_idx" ON "Contrato"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoContrato_legacyId_key" ON "HistoricoContrato"("legacyId");

-- CreateIndex
CREATE INDEX "HistoricoContrato_contratoId_idx" ON "HistoricoContrato"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemContrato_legacyId_key" ON "ItemContrato"("legacyId");

-- CreateIndex
CREATE INDEX "ItemContrato_contratoId_idx" ON "ItemContrato"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "Faturamento_legacyId_key" ON "Faturamento"("legacyId");

-- CreateIndex
CREATE INDEX "Faturamento_contratoId_idx" ON "Faturamento"("contratoId");

-- CreateIndex
CREATE INDEX "Faturamento_clienteId_idx" ON "Faturamento"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_legacyId_key" ON "NotaFiscal"("legacyId");

-- CreateIndex
CREATE INDEX "NotaFiscal_faturamentoId_idx" ON "NotaFiscal"("faturamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Demanda_legacyId_key" ON "Demanda"("legacyId");

-- CreateIndex
CREATE INDEX "Demanda_clienteId_idx" ON "Demanda"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "TramiteDemanda_legacyId_key" ON "TramiteDemanda"("legacyId");

-- CreateIndex
CREATE INDEX "TramiteDemanda_demandaId_idx" ON "TramiteDemanda"("demandaId");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitacao_legacyId_key" ON "Solicitacao"("legacyId");

-- CreateIndex
CREATE INDEX "Solicitacao_clienteId_idx" ON "Solicitacao"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_siglaLegado_key" ON "Cliente"("siglaLegado");

-- AddForeignKey
ALTER TABLE "ResponsavelCliente" ADD CONSTRAINT "ResponsavelCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratoOperacionalizacao" ADD CONSTRAINT "ContratoOperacionalizacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoConfirmacao" ADD CONSTRAINT "TermoConfirmacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoConfirmacao" ADD CONSTRAINT "TermoConfirmacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoConfirmacao" ADD CONSTRAINT "TermoConfirmacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoContrato" ADD CONSTRAINT "HistoricoContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemContrato" ADD CONSTRAINT "ItemContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faturamento" ADD CONSTRAINT "Faturamento_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faturamento" ADD CONSTRAINT "Faturamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_faturamentoId_fkey" FOREIGN KEY ("faturamentoId") REFERENCES "Faturamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TramiteDemanda" ADD CONSTRAINT "TramiteDemanda_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

