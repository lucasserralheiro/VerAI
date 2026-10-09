-- Espelho somente-leitura do AIBertinho (spec 2026-10-07-integracao-verai-aibertinho-design.md §9). Só tabelas novas.
CREATE TABLE "EspelhoRegistro" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "idOrigem" TEXT NOT NULL,
    "chaveCliente" TEXT,
    "chaveGerencia" TEXT,
    "dados" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EspelhoRegistro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EspelhoEstado" (
    "origem" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "hash" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sincronizadoEm" TIMESTAMP(3),
    "tentativaEm" TIMESTAMP(3),
    "erro" TEXT,
    "publicadaNaOrigem" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EspelhoEstado_pkey" PRIMARY KEY ("origem","entidade")
);

CREATE UNIQUE INDEX "EspelhoRegistro_origem_entidade_idOrigem_key" ON "EspelhoRegistro"("origem", "entidade", "idOrigem");
CREATE INDEX "EspelhoRegistro_origem_entidade_chaveCliente_idx" ON "EspelhoRegistro"("origem", "entidade", "chaveCliente");
CREATE INDEX "EspelhoRegistro_origem_entidade_chaveGerencia_idx" ON "EspelhoRegistro"("origem", "entidade", "chaveGerencia");

-- O que o VerAI publica (tela /admin/integracao). Nasce vazio = nada publicado.
CREATE TABLE "IntegracaoPublicacao" (
    "entidade" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "alteradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alteradoPor" TEXT,
    CONSTRAINT "IntegracaoPublicacao_pkey" PRIMARY KEY ("entidade")
);
