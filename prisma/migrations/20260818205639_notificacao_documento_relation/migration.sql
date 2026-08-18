-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
