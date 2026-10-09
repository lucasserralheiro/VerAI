/** @jest-environment node */
import { entidadesDoSql } from './aviso'

it('reconhece INSERT/UPDATE/DELETE do Prisma nas tabelas do domínio comercial', () => {
  expect(entidadesDoSql('INSERT INTO "public"."Faturamento" ("id","valor") VALUES ($1,$2)')).toContain('faturamentos')
  expect(entidadesDoSql('UPDATE "public"."Contrato" SET "situacao" = $1 WHERE "id" = $2')).toContain('contratos')
  expect(entidadesDoSql('DELETE FROM "public"."Demanda" WHERE "id" = $1')).toEqual(['demandas'])
})

it('ignora leitura e tabela fora do domínio (inclusive o próprio espelho — sem eco)', () => {
  expect(entidadesDoSql('SELECT "public"."Contrato"."id" FROM "public"."Contrato"')).toEqual([])
  expect(entidadesDoSql('INSERT INTO "public"."EspelhoRegistro" ("id") VALUES ($1)')).toEqual([])
  expect(entidadesDoSql('INSERT INTO "public"."MensagemAssistente" ("id") VALUES ($1)')).toEqual([])
})
