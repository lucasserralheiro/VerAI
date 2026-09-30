-- IPC-Fipe mensal (spec 2026-09-30-reajuste-ipc-fipe-design §1.2). Só tabela nova.
CREATE TABLE "IndiceIpcFipe" (
    "mes" DATE NOT NULL,
    "variacao" DECIMAL(9,4) NOT NULL,
    "fonte" TEXT NOT NULL,
    "buscadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IndiceIpcFipe_pkey" PRIMARY KEY ("mes")
);
