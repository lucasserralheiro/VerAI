# "Documentos do SharePoint atualizados em …" — design

**Status:** aprovado pelo usuário em 28/09/2026 ("pode fazer"), com a linha nas duas telas.

## 1. Pedido

Na tela "Relatórios dos clientes" o usuário quer ver quando os documentos vieram do SharePoint pela
última vez — "atualizado 28/09/2026 10:30" — para saber que o que está ali está em dia.

**Revê uma decisão de 24/09** (plano `2026-09-24-sharepoint-automacao.md`, "sem e-mail, painel, selo
ou registro de execução no banco"): agora há o selo e um registro mínimo no banco. Continua sem
e-mail e sem painel.

## 2. Hoje × depois

- **Hoje:** a hora de cada execução existe só no log do PC do Lucas
  (`logs/sincronizar-sharepoint.log`). O banco não guarda nada (`ArquivoSharepoint.vistoEm` só muda
  quando o arquivo muda) e o site, na Vercel, não enxerga o Agendador do Windows.
- **Depois:** no fim de cada passada completa e bem-sucedida, o script grava a hora no banco; as
  telas leem de lá.

Motivo concreto, medido no log de 28/09: das 7:26 às 10:00 **todas** as execuções caíram (Neon
inacessível, `codigo 1`); só a das 10:30 passou. Com o selo, a tela mostraria "26/09 14:00" em
laranja até as 10:30.

## 3. O que conta como "atualizado"

Uma linha só é gravada quando a passada é **completa**:

- `--aplicar` (listagem não grava nada);
- biblioteca inteira — sem `--clientes=` (passada parcial não atualiza todo mundo);
- conferência sem divergência ("TUDO NO VERAI");
- sem remoção suspensa (listagem curta = OneDrive pausado);
- sem falha de leitura de arquivo (arquivo com conteúdo trocado que falhou fica com a versão velha e a
  conferência não pega).

Execução que falha não grava: a data nunca promete mais do que foi feito. A hora gravada é o
**início** da passada (a listagem da pasta): o VerAI está igual ao SharePoint daquele momento.

## 4. Peças

1. **Model `AtualizacaoSharepoint`** (`id`, `iniciadaEm`, `concluidaEm`, `arquivos`), uma linha por
   passada completa — ~48 por dia útil, crescimento desprezível. Migração
   `20260928120000_atualizacao_sharepoint`, escrita à mão (nunca `migrate diff` com o banco de dev de
   shadow).
2. **`src/lib/arquivos/sharepoint/atualizacao.ts`** — `motivoIncompleta()` (regra pura, §3; `null` =
   completa, senão o motivo, que vai para o log) e
   `registrarAtualizacao()`, chamada pelo `scripts/sincronizar-sharepoint.ts` logo depois da
   conferência/auditoria e antes do índice. Guarda pela própria migração (`MIGRACAO_DA_ATUALIZACAO`),
   como o índice e as fichas: o agendador roda o código da pasta contra produção, que pode não ter a
   tabela ainda. **Nunca lança** — o código de saída continua sendo o da sincronização.
3. **`GET /api/sharepoint/atualizacao`** → `{ atualizadoEm: string | null }` (a mais recente), para
   qualquer usuário logado — é um dado da biblioteca, não de um cliente.
4. **`textoDaAtualizacao()`** (`src/lib/arquivos/sharepoint/atualizacao-texto.ts`, pura, roda no
   navegador) e o componente **`<AtualizacaoSharepoint />`**
   (`src/components/sharepoint/atualizacao-sharepoint.tsx`), usado:
   - embaixo do título "Relatórios dos clientes" (`lista-clientes.tsx`);
   - embaixo do resumo "N arquivos · X MB" da aba Documentos (`aba-documentos.tsx`).

## 5. Na tela

| Situação | Texto | Cor |
|---|---|---|
| até 2 h | Documentos do SharePoint atualizados em 28/09/2026 10:30 | cinza |
| mais de 2 h (4 execuções perdidas: PC desligado, banco fora, OneDrive parado) | … atualizados em 26/09/2026 14:00 — atualização atrasada | laranja |
| nunca sincronizado (banco sem linha) | Ainda não sincronizado com o SharePoint | laranja |
| API falhou / tabela ainda não existe | nada | — |

Hora sempre no fuso de São Paulo. O `title` da linha explica: roda a cada 30 min; depois de 2 h, algum
documento novo do SharePoint pode ainda não estar aqui.

## 6. Onde aparece qual data

- **Site (Vercel):** banco Neon de produção, onde o agendador grava — muda sozinho a cada 30 min.
- **localhost:** Postgres local (`.env.development`), que só muda com a sincronização rodada à mão contra
  o dev. O agendador **não** grava nos dois bancos.

## 7. Fora

E-mail, painel, histórico de execuções na tela, data por cliente (uma passada atualiza todos juntos).
