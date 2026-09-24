-- Decisão do usuário (23/09/2026): o "Link SEI" do contrato (coluna do GRC-1, ao lado do SEI do
-- cliente) é o link do processo SEI DO CLIENTE. Vai pra tabela de links por número (LinkSei) — assim o
-- link fica no número certo e o SEI PRODAM deixa de abrir o processo do cliente. A coluna
-- "Contrato"."linkSei" fica (histórico), mas o código deixa de usá-la.
-- Chave = mesma de `chaveDoSei` (src/lib/relatorios-clientes/sei.ts): só dígitos quando há 10+,
-- senão o texto minúsculo. Link já cadastrado pra aquele número não é sobrescrito.
INSERT INTO "LinkSei" ("id", "digitos", "url", "updatedAt")
SELECT DISTINCT ON (x.chave)
  'mig' || md5(x.chave), x.chave, x.url, CURRENT_TIMESTAMP
FROM (
  SELECT
    CASE
      WHEN length(regexp_replace(c."seiCliente", '\D', '', 'g')) >= 10 THEN regexp_replace(c."seiCliente", '\D', '', 'g')
      ELSE lower(trim(c."seiCliente"))
    END AS chave,
    trim(c."linkSei") AS url,
    c."createdAt"
  FROM "Contrato" c
  WHERE c."linkSei" IS NOT NULL
    AND trim(c."linkSei") ~* '^https?://'
    AND c."seiCliente" IS NOT NULL
    AND trim(c."seiCliente") <> ''
) x
ORDER BY x.chave, x."createdAt" DESC
ON CONFLICT ("digitos") DO NOTHING;
