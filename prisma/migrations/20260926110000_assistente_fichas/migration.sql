-- Ficha de cada PDF do histórico, lida uma vez por versão (spec docs/superpowers/specs/2026-09-25-assistente-senior-design.md §5).
CREATE TABLE "FichaDocumento" (
  "id" TEXT NOT NULL,
  "origem" "OrigemTrecho" NOT NULL,
  "origemId" TEXT NOT NULL,
  "versao" TEXT,
  "campos" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "mensagem" TEXT,
  "modelo" TEXT,
  "tokensEntrada" INTEGER,
  "tokensSaida" INTEGER,
  "geradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FichaDocumento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FichaDocumento_origem_origemId_key" ON "FichaDocumento"("origem", "origemId");
