ALTER TABLE "MensagemAssistente" ADD COLUMN "origem" TEXT;
ALTER TABLE "MensagemAssistente" ADD COLUMN "tipos" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MensagemAssistente" ADD COLUMN "conferencia" JSONB;
