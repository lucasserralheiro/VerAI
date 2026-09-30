# Juntar linhas duplicadas do histórico do contrato — design

**Status:** aprovado pelo usuário na lista de 30/09/2026 ("pode fazer todos"). Complementa
`2026-09-29-valor-vigencia-contratos-design.md` (§0.1, item 7).

## 1. Achado

O mesmo termo aparece **duas vezes** no histórico de vários contratos: a linha do legado (GRC-1, com
`legacyId`, número oficial "TA 001/2025", datas e valor digitados) e a linha que a sincronização do
SharePoint criou a partir da pasta ("TA 01", com os PDFs). A identidade do SharePoint
(`importacao-sharepoint/identidade.ts`) casa por caminho → tipo+número tolerante (`chaveExata`: "1 2025" ≠
"1") → conteúdo; o número escrito de dois jeitos passa pelos três passos e vira linha nova.

Efeito: a linha do SharePoint fica sem valor/vencimento; a do legado, sem PDF; a planilha e o controle não
casam com nenhuma das duas (identidade `TA1` repetida → nada é gravado, spec do valor §0.1); a tela mostra
dois termos onde há um.

## 2. Regra — só junta com prova

Duas linhas do **mesmo contrato** são o mesmo termo quando:

1. têm a mesma identidade espécie + nº (`termoDoTexto`: `TA1`, `TAP3`, contrato `TC0`) e **só essas duas**
   têm essa identidade no contrato;
2. uma veio do SharePoint (`chaveSharepoint` ou arquivo do SharePoint ligado) e a outra não;
3. **nenhum campo se contradiz**: tipo, data de assinatura, início, vencimento e valor — quando os dois lados
   têm o campo, têm de ser iguais (datas no mesmo dia, valor ao centavo);
4. **ao menos uma prova de que é o mesmo**: um desses campos igual nos dois lados, ou o PDF do termo da
   linha do SharePoint (ficha verificada) com o mesmo fim de vigência ou o mesmo valor da linha do legado.

Faltou (3) ou (4) → não junta; vira aviso "possível duplicata" (log do agendador e da simulação).

## 3. Como junta

- **Fica a linha do SharePoint** (é a que a sincronização acha pelo caminho; apagar ela faria a próxima
  passada recriar a linha). A do legado sai.
- Campo vazio na que fica recebe o valor da que sai (valor, datas, situação, objeto, proposta, observação,
  PC/PA e TC/TA anexados à mão); o `legacyId` passa para a que fica (reimportar o GRC-1 não recria).
- O número oficial da que sai, se diferente, vai para a observação ("também registrado como TA 001/2025").
- Referências: `ArquivoSharepoint.historicoId` e `OrigemCampoHistorico` passam para a que fica; fichas e
  trechos do índice da que sai são refeitos pelas próprias etapas (origem + id).
- Uma transação por par. Registro em tabela nova? Não: o log da simulação/aplicação guarda o par e os campos
  (a junção só preenche vazio e é rara).

## 4. Onde roda

`src/lib/historico/duplicatas.ts` (regra pura + aplicação), `scripts/juntar-duplicatas.ts` (simulação;
`--aplicar` grava) e etapa no agendador **antes** da etapa dos valores, com a mesma guarda
(`MIGRACAO_DOS_VALORES`): em produção só roda depois que a migração subir. Nunca muda o código de saída.

## 5. Fora do escopo

Linhas com identidade diferente (SME "TA 178/SME/2025 AO TC 402" ADITIVO × "TA 178-SME-2025" PRORROGACAO
com início diferente) ficam como aviso — a regra (3) as barra de propósito.
