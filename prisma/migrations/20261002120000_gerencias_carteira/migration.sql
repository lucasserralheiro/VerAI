-- Gerências e carteira de clientes (spec 2026-10-02-gerencias-carteira-clientes-design.md). Só tabelas novas.
CREATE TABLE "Gerencia" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gerencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembroGerencia" (
    "id" TEXT NOT NULL,
    "gerenciaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembroGerencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarteiraCliente" (
    "clienteId" TEXT NOT NULL,
    "gerenciaId" TEXT NOT NULL,
    "movidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "movidoPorId" TEXT,
    CONSTRAINT "CarteiraCliente_pkey" PRIMARY KEY ("clienteId")
);

CREATE TABLE "MovimentoCarteira" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "deGerenciaId" TEXT,
    "paraGerenciaId" TEXT,
    "porId" TEXT,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimentoCarteira_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Gerencia_nome_key" ON "Gerencia"("nome");
CREATE UNIQUE INDEX "Gerencia_sigla_key" ON "Gerencia"("sigla");
CREATE INDEX "MembroGerencia_usuarioId_idx" ON "MembroGerencia"("usuarioId");
CREATE UNIQUE INDEX "MembroGerencia_gerenciaId_usuarioId_key" ON "MembroGerencia"("gerenciaId", "usuarioId");
CREATE INDEX "CarteiraCliente_gerenciaId_idx" ON "CarteiraCliente"("gerenciaId");
CREATE INDEX "MovimentoCarteira_clienteId_idx" ON "MovimentoCarteira"("clienteId");

ALTER TABLE "MembroGerencia" ADD CONSTRAINT "MembroGerencia_gerenciaId_fkey" FOREIGN KEY ("gerenciaId") REFERENCES "Gerencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembroGerencia" ADD CONSTRAINT "MembroGerencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarteiraCliente" ADD CONSTRAINT "CarteiraCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarteiraCliente" ADD CONSTRAINT "CarteiraCliente_gerenciaId_fkey" FOREIGN KEY ("gerenciaId") REFERENCES "Gerencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MovimentoCarteira" ADD CONSTRAINT "MovimentoCarteira_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
