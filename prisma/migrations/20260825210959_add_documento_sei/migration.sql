-- CreateTable
CREATE TABLE "DocumentoSei" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "caminhoOriginal" TEXT NOT NULL,
    "conteudoMarkdown" TEXT,
    "status" TEXT NOT NULL DEFAULT 'rascunho',
    "mensagemErro" TEXT,
    "uploadedById" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoSei_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoSei_clienteId_idx" ON "DocumentoSei"("clienteId");

-- AddForeignKey
ALTER TABLE "DocumentoSei" ADD CONSTRAINT "DocumentoSei_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoSei" ADD CONSTRAINT "DocumentoSei_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
