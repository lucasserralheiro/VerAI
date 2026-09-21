-- A integração com o Confere mudou de arquitetura (docs/superpowers/specs/2026-09-21-integracao-confere-design.md
-- §3.7): em vez de uma aba dentro de cliente > competência, com registro por
-- cliente/competência no banco, virou uma cópia do frontend próprio do
-- Confere em /confere — sem cliente, sem competência, sem persistência (a
-- aplicação portada é sem estado, como o Confere original). As duas tabelas
-- criadas pela migração 20260921130000_add_analise_medicao_contratual nunca
-- foram usadas em produção: reverte por completo.

-- DropForeignKey
ALTER TABLE "AnaliseMedicaoContratualArquivo" DROP CONSTRAINT "AnaliseMedicaoContratualArquivo_analiseId_fkey";

-- DropForeignKey
ALTER TABLE "AnaliseMedicaoContratual" DROP CONSTRAINT "AnaliseMedicaoContratual_clienteId_fkey";

-- DropTable
DROP TABLE "AnaliseMedicaoContratualArquivo";

-- DropTable
DROP TABLE "AnaliseMedicaoContratual";
