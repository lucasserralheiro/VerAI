# Consistência de contrato, cliente, proposta e aditivo — registro e pendências

**Data**: 23/09/2026 · **Origem**: varredura completa (schema, migrações, rotas, telas, importador,
reconciliação) + cruzamento com as specs do repositório de documentos e do assistente de IA.

## Decisões do usuário

1. Contrato e competência de um arquivo ficam **só em quem usa o arquivo** (histórico, faturamento,
   execução do ConfereAI, documento) — `ArquivoCliente` não guarda. Ver §7 da spec do repositório.
2. O mesmo arquivo **pode servir a vários contratos**.

## Feito nesta sessão

| # | Correção | Arquivos |
|---|---|---|
| 1 | Regra única de leitura de valor (tela, planilha, importador) — "1.500" ambíguo recusado em todo lugar; célula numérica do Excel não vira texto (0,125 deixava de virar 125); CSV não converte antes da regra | `src/lib/relatorios-clientes/numero.ts` (novo), `validacao.ts`, `importar-itens.ts`, `scripts/importar-grc1.ts` |
| 2 | Reimportar o GRC-1 não sobrescreve o que já existe (faturamento, item vinculado, termo, demanda, observação, cliente); `--sobrescrever` força | `scripts/importar-grc1.ts` |
| 3 | Editar quantidade/unitário de item recalcula o total quando a tela reenvia o total antigo | `src/app/api/itens-contrato/[id]/route.ts` |
| 4 | Item do legado não vai pra contrato de outro cliente no vínculo manual; busca `?contratoId=` só lista os do cliente | `src/app/api/itens-contrato/route.ts`, `[id]/route.ts`, `secao-itens.tsx` |
| 5 | Relatório "Valor total": valor e faturado dos mesmos contratos | `src/app/api/relatorios/valor-total/route.ts` |
| 6 | Editar linha do histórico religa itens órfãos (como o POST) | `src/app/api/historico-contrato/[id]/route.ts` |
| 7 | Excluir contrato com itens ou termos → 409 (antes soltava em silêncio via `SET NULL`) | `src/app/api/contratos/[id]/route.ts` |
| 8 | Adendos nas specs do repositório (§7) e do assistente (§11) | `docs/superpowers/specs/…` |
| 9 | Exclusão de cliente com UMA regra (ficha e "Gerenciar clientes"), só admin, incluindo repositório de arquivos e índice do assistente | `src/lib/relatorios-clientes/excluir-cliente.ts` (novo), `api/clientes/[clienteId]/route.ts`, `api/admin/clientes/[id]/route.ts`, `admin/clientes/page.tsx` |
| 10 | Mesclar clientes leva TUDO (contratos, faturamento, termos, demandas, solicitações, responsáveis, arquivos, índice, permissões, sigla) — antes só documentos e estourava | `api/admin/clientes/[id]/mesclar/route.ts` |
| 11 | Importar a mesma planilha de itens de novo não duplica (linha igual a item existente é ignorada, a prévia mostra quais) | `api/contratos/[id]/itens/importar/route.ts`, `importar-planilha-itens.tsx` |
| 12 | Nº do termo repetido no cliente (chave tolerante) → 409 ao criar ou ao trocar o número | `api/contratos/carregar.ts`, `api/clientes/[clienteId]/contratos/route.ts`, `api/contratos/[id]/route.ts` |
| 13 | Checkbox "Vigente" saiu do formulário (nenhuma regra usa) | `formulario-contrato.tsx` |
| 14 | Detalhe do contrato: mesmos selos da aba (Rescindido, Cadastro vazio, Situação × vigência) e recarrega após editar | `contratos/[contratoId]/page.tsx` |
| 15 | Termo de confirmação guarda o CO (migração `20260924120000_termo_confirmacao_co`, importador preenche inclusive nos já importados; API exige CO do mesmo fornecedor; CO com termo não é excluído) | `schema.prisma`, `importar-grc1.ts`, `api/termos-confirmacao/*`, `api/cos/[id]/route.ts` |
| 17 | Situação "Ativo" com prazo vencido e sem prorrogação: **continua ativo** (decisão do usuário, 23/09) e ganha aviso `situacaoDesatualizada` no consolidado — cartão da ficha e detalhe do contrato mostram "situação desatualizada, confira o cadastro" | `regras.ts`, `contratos-consolidados.ts`, `contratos/esquema.ts`, `indicadores`, `indicadores-cliente.tsx`, `contratos/[contratoId]/page.tsx` |
| 18 | Faturamento **Cancelado** não abate saldo nem conta no faturado/último mês/total da aba; situação vira lista fechada (Em aberto, Emitido, Pago, Cancelado) | `situacao-faturamento.ts` (novo), `saldos-contratos.ts`, `resumo-faturamento.ts`, `indicadores`, `faturamentos/esquema.ts`, `formulario-faturamento.tsx`, `status-faturamento` |
| 19 | Aditivo/prorrogação **sem assinatura** não estende vigência nem muda valor; aviso `prorrogacaoEmAndamento` | `regras.ts` (`linhaAssinada`), `resumo-historico.ts`, `contratos-consolidados.ts`, detalhe do contrato |
| 20 | **Rescisão** não vira valor do contrato | `resumo-historico.ts` |
| 21 | Um lançamento **principal** por contrato + competência (409); complementar à parte, cancelado não conta | `faturamentos/esquema.ts` (`principalRepetido`), rotas POST/PATCH |
| 22 | "Link SEI" do contrato = SEI do cliente → migrado pra `LinkSei` por número (migração `20260924130000`); importador e API gravam lá; formulário perdeu o campo solto; detalhe não usa mais `contrato.linkSei` | migração, `importar-grc1.ts`, `contratos/carregar.ts`, rotas de contrato, `formulario-contrato.tsx`, detalhe |
| 16 | Soma dos itens aguardando em Decimal (sem float); `--integridade` conta "sem valor" olhando os itens | `itens-aguardando.ts`, `scripts/reconciliar-clientes.ts` |

Testes ajustados/novos (não rodados nesta sessão — o usuário roda no fim): `importar-itens.test.ts`,
`itens-contrato/route.test.ts`, `itens-contrato/[id]/route.test.ts`, `relatorios/valor-total/route.test.ts`,
`historico-contrato/[id]/route.test.ts` (mock do vínculo).

## Pendências (em ordem)

**Precisa rodar**: `npx prisma migrate dev` (migração nova do CO no termo). Tela do termo ainda não
mostra/escolhe o CO — `secao-termos.tsx` tem alteração sem commit de outra sessão.

Decisões de regra: todas tomadas (23/09) e aplicadas — itens 17 a 22.

**Conferir nos dados depois da migração**: `reconciliar-clientes.ts --detalhe` — contrato que dependia
de prorrogação sem "Assinada em" no legado passa a aparecer vencido (com "prorrogação em andamento").
Se for muito caso, preencher a data de assinatura nas linhas.

**Telas da outra sessão** (quando commitar): aba Contratos e `/relatorios` ainda passam
`link={contrato.linkSei}` pro SEI PRODAM — tirar; mostrar selos `situacaoDesatualizada` e
`prorrogacaoEmAndamento` na aba; marcar `cancelado` no relatório de status de faturamento.

Telas com alteração sem commit de outra sessão ficaram de fora de propósito.

1. **Abas da ficha não se avisam** — só os cartões escutam `aoMudarDados`. Contratos (`% faturado`),
   Faturamento (select de contrato) e Termos (select de contrato) devem recarregar no aviso.
   (`aba-contratos.tsx`, `aba-faturamento.tsx`, `secao-termos.tsx`)
2. **Link SEI do contrato** (`Contrato.linkSei`) aplicado ao SEI do cliente E ao da PRODAM
   (`aba-contratos.tsx:261-262`, `contratos/[contratoId]/page.tsx:49,52`, `relatorios/page.tsx`).
3. **Coluna "Valor" da aba Contratos** mostra só o valor do histórico; deve mostrar `valorBase`
   (histórico, senão itens), igual ao cartão e à barra.
4. **Aditivo não assinado** estende vigência; rescisão com valor vira "valor atual"
   (`regras.ts:66`, `resumo-historico.ts:60`).
5. **Faturado** soma faturamento cancelado e duplicado; sem unicidade (contrato, competência); valor
   lançado ≠ soma das notas sem aviso.
6. Selects de contrato (faturamento, termo) mostram só o nº do termo — incluir descrição/vigência.
7. Ordem da aba Contratos pelo vencimento do cabeçalho, não pela vigência efetiva.
8. Busca de SEI compara texto gravado, não os dígitos; aba Contratos e `/relatorios` buscam diferente.
9. Proposta comercial: nem com a Fase 4 do repositório liga a contrato/linha do histórico
    (`HistoricoContrato.proposta` é texto).
10. Índice do assistente: trecho guarda cliente/contrato e não atualiza se o faturamento trocar de
    contrato; e lê colunas `*PdfUrl` que a Fase 2 do repositório remove (ver spec do assistente §11).
