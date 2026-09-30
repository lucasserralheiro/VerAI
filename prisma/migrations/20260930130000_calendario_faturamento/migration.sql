-- CreateTable
CREATE TABLE "CalendarioFaturamento" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "arquivoId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "avisos" JSONB NOT NULL,
    "lidoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarioFaturamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataFaturamento" (
    "id" TEXT NOT NULL,
    "calendarioId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,

    CONSTRAINT "DataFaturamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarioFaturamento_ano_key" ON "CalendarioFaturamento"("ano");

-- CreateIndex
CREATE INDEX "DataFaturamento_calendarioId_idx" ON "DataFaturamento"("calendarioId");

-- CreateIndex
CREATE INDEX "DataFaturamento_inicio_idx" ON "DataFaturamento"("inicio");

-- AddForeignKey
ALTER TABLE "DataFaturamento" ADD CONSTRAINT "DataFaturamento_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "CalendarioFaturamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

