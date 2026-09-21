-- O resultado da conferência (resposta do Confere sem os dois base64), pra
-- reabrir o mesmo grid em /confere/historico/[id]. Nullable: as execuções
-- gravadas antes desta migração não têm resultado guardado.

-- AlterTable
ALTER TABLE "ConfereExecucao" ADD COLUMN "resultado" JSONB;
