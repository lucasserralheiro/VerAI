-- Biblioteca "Documentos" do SharePoint + tabela de preços (specs 2026-09-29-biblioteca-documentos-prodam e
-- 2026-09-29-tabela-de-precos). Só tabelas novas: o agendador roda contra produção com o cliente gerado
-- na pasta do projeto.
CREATE TABLE "ArquivoBiblioteca" (
    "id" TEXT NOT NULL,
    "biblioteca" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "extensao" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "modificadoEm" TIMESTAMP(3) NOT NULL,
    "vistoEm" TIMESTAMP(3) NOT NULL,
    "removidoNaOrigemEm" TIMESTAMP(3),
    "leituraStatus" TEXT,
    "leituraMensagem" TEXT,
    "lidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArquivoBiblioteca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ArquivoBiblioteca_biblioteca_caminho_key" ON "ArquivoBiblioteca"("biblioteca", "caminho");
CREATE INDEX "ArquivoBiblioteca_biblioteca_area_idx" ON "ArquivoBiblioteca"("biblioteca", "area");

CREATE TABLE "AtualizacaoBiblioteca" (
    "id" TEXT NOT NULL,
    "biblioteca" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivos" INTEGER NOT NULL,
    CONSTRAINT "AtualizacaoBiblioteca_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AtualizacaoBiblioteca_biblioteca_iniciadaEm_idx" ON "AtualizacaoBiblioteca"("biblioteca", "iniciadaEm");

CREATE TABLE "TabelaPrecos" (
    "id" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "publicadaEm" TIMESTAMP(3),
    "arquivoPlanilhaId" TEXT,
    "arquivoPdfId" TEXT,
    "arquivoPublicacaoId" TEXT,
    "arquivoInformativoId" TEXT,
    "totalItens" INTEGER NOT NULL,
    "divergencias" INTEGER NOT NULL,
    "lidaEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TabelaPrecos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TabelaPrecos_versao_key" ON "TabelaPrecos"("versao");

CREATE TABLE "ItemTabelaPrecos" (
    "id" TEXT NOT NULL,
    "tabelaId" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "grupo" TEXT NOT NULL,
    "secoes" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "preco" DECIMAL(14,2),
    "sobDemanda" BOOLEAN NOT NULL DEFAULT false,
    "precoTexto" TEXT,
    "conferencia" TEXT NOT NULL,
    "precoNoPdf" DECIMAL(14,2),
    CONSTRAINT "ItemTabelaPrecos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ItemTabelaPrecos_tabelaId_codigo_key" ON "ItemTabelaPrecos"("tabelaId", "codigo");
ALTER TABLE "ItemTabelaPrecos" ADD CONSTRAINT "ItemTabelaPrecos_tabelaId_fkey" FOREIGN KEY ("tabelaId") REFERENCES "TabelaPrecos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
