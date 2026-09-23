CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "OrigemTrecho" AS ENUM ('HISTORICO_PROPOSTA', 'HISTORICO_TERMO', 'FATURAMENTO_PDF', 'PROPOSTA_COMERCIAL_ARQUIVO', 'DOCUMENTO');

-- CreateTable
CREATE TABLE "IndiceDocumento" (
    "id" TEXT NOT NULL,
    "origem" "OrigemTrecho" NOT NULL,
    "origemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "versao" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "clienteId" TEXT,
    "contratoId" TEXT,
    "status" TEXT NOT NULL,
    "mensagem" TEXT,
    "totalTrechos" INTEGER NOT NULL DEFAULT 0,
    "indexadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndiceDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrechoDocumento" (
    "id" TEXT NOT NULL,
    "indiceId" TEXT NOT NULL,
    "origem" "OrigemTrecho" NOT NULL,
    "origemId" TEXT NOT NULL,
    "clienteId" TEXT,
    "contratoId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "pagina" INTEGER,
    "ordem" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "busca" tsvector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrechoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaAssistente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contextoInicial" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaAssistente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemAssistente" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "ferramentas" JSONB,
    "tokensEntrada" INTEGER,
    "tokensSaida" INTEGER,
    "tokensCache" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemAssistente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndiceDocumento_clienteId_idx" ON "IndiceDocumento"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "IndiceDocumento_origem_origemId_key" ON "IndiceDocumento"("origem", "origemId");

-- CreateIndex
CREATE INDEX "TrechoDocumento_indiceId_idx" ON "TrechoDocumento"("indiceId");

-- CreateIndex
CREATE INDEX "TrechoDocumento_clienteId_idx" ON "TrechoDocumento"("clienteId");

-- CreateIndex
CREATE INDEX "TrechoDocumento_contratoId_idx" ON "TrechoDocumento"("contratoId");

-- CreateIndex
CREATE INDEX "TrechoDocumento_busca_idx" ON "TrechoDocumento" USING GIN ("busca");

-- CreateIndex
CREATE INDEX "ConversaAssistente_usuarioId_atualizadaEm_idx" ON "ConversaAssistente"("usuarioId", "atualizadaEm");

-- CreateIndex
CREATE INDEX "MensagemAssistente_conversaId_createdAt_idx" ON "MensagemAssistente"("conversaId", "createdAt");

-- AddForeignKey
ALTER TABLE "TrechoDocumento" ADD CONSTRAINT "TrechoDocumento_indiceId_fkey" FOREIGN KEY ("indiceId") REFERENCES "IndiceDocumento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaAssistente" ADD CONSTRAINT "ConversaAssistente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemAssistente" ADD CONSTRAINT "MensagemAssistente_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaAssistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
