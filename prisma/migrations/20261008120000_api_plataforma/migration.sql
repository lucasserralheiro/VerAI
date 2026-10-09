-- API de plataforma (spec 2026-10-08-api-plataforma-design.md). Só tabelas novas; a escolha global de
-- publicação (IntegracaoPublicacao) virou escopo por aplicativo.
DROP TABLE IF EXISTS "IntegracaoPublicacao";

CREATE TABLE "ApiApp" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "escopos" TEXT[],
    "chavePrefixo" TEXT NOT NULL,
    "chaveHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPor" TEXT,
    "ultimoUsoEm" TIMESTAMP(3),
    CONSTRAINT "ApiApp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiWebhook" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventos" TEXT[],
    "segredo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiWebhook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiWebhookEntrega" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "recursos" TEXT[],
    "status" INTEGER,
    "erro" TEXT,
    "duracaoMs" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiWebhookEntrega_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FonteExterna" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "segredoWebhook" TEXT,
    "recursos" TEXT[],
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FonteExterna_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiApp_chaveHash_key" ON "ApiApp"("chaveHash");
CREATE INDEX "ApiWebhook_appId_idx" ON "ApiWebhook"("appId");
CREATE INDEX "ApiWebhookEntrega_webhookId_criadoEm_idx" ON "ApiWebhookEntrega"("webhookId", "criadoEm");
CREATE UNIQUE INDEX "FonteExterna_slug_key" ON "FonteExterna"("slug");

ALTER TABLE "ApiWebhook" ADD CONSTRAINT "ApiWebhook_appId_fkey" FOREIGN KEY ("appId") REFERENCES "ApiApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiWebhookEntrega" ADD CONSTRAINT "ApiWebhookEntrega_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "ApiWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
