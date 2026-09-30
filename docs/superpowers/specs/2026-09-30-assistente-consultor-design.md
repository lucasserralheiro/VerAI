# Assistente de IA — consultor direto (frente A de 3) (design)

**Status**: Desenho aprovado pelo usuário em 30/09/2026 (brainstorm). Plano a escrever.
**Data**: 30/09/2026
**Frentes**: esta spec (A: consultor direto, dados novos, conhecimento geral marcado) → B: receber
documentos no chat e analisar → C: analista de negócio e estratégia da carteira. Cada uma com spec,
plano e implementação próprios, nessa ordem (decisão do usuário).
**Depende de**: fases 1 e 2 do assistente (`2026-09-25-assistente-base-economica-design.md`,
`2026-09-25-assistente-senior-design.md`). **Substitui** as partes "resumo sem IA" e "consultas
rápidas" (§4.1–4.2) de `2026-09-25-assistente-interface-design.md`: o usuário quer só o chat, sem
botões. O resto daquela spec (quadros, "como cheguei aqui", ações, histórico) continua valendo.
**Revê** a regra 6 da fase 2 ("nunca responda norma de memória") — ver §6.

---

## 1. Objetivo

Pedido do usuário (30/09/2026): *"a IA seja um consultor de respostas, analista de negócio… o projeto
tem todos os dados, preço, contrato, agenda, IPC… o chat precisa conseguir sempre extrair respostas
precisas"*, e no brainstorm:

- *"receber perguntas naturais e a IA entender o que ele está pedindo"*;
- *"escrever sempre no chat direto e vir a resposta em vez de perguntas rápidas"*; buscar por cliente
  escrevendo no chat;
- *"não pode inventar ou falar palavras fora do VerAI que não façam sentido — ele vai recusar"*;
- *"precisa usar base de conhecimento fora do VerAI, mas deixar explícito numa UX que isso não está
  nos documentos do VerAI, mas buscou na IA — ex.: solucionar dúvidas ou problemas"*.

| | Hoje | Depois |
|---|---|---|
| "SMS" ou "saúde" sozinho no chat | vai à IA; "saúde" não é reconhecido | resposta pronta do cliente, montada pelo código, sem IA, na hora |
| "Quando fecha o faturamento?" | não tem o dado | próximo prazo do calendário, com dias úteis |
| "Quanto fica R$ 250 mil pelo IPC de 09/2025 a 08/2026?" | não tem o índice | valor corrigido calculado pelo código da tela de Reajuste |
| "Quanto o controle diz que foi faturado? Bate?" | não tem o controle | controle × VerAI, lado a lado |
| "Links MPLS da SMS" | não tem | ativos e entradas/saídas do último mês |
| "De onde veio esse valor?" | não sabe | a prova (termo, planilha, controle) do campo |
| Número escrito pela IA que não veio de consulta | passa despercebido | marcado ⚠ "não confirmado no VerAI" |
| "O que é apostilamento?" (sem manual validado) | "não está na base" | explica numa caixa 🌐 "Não está nos documentos do VerAI · resposta da IA" |
| "Quem ganhou o jogo ontem?" | responde ou se perde | recusa com frase fixa |
| Pergunta de comparação (5–6 consultas) | para no 4º passo | até 6 passos |

Princípio mantido das fases 1–2: **o que dá para calcular por regra sai do código; a IA escolhe,
explica e recomenda.**

## 2. O que já existe e é reaproveitado

- **Ferramentas somente-leitura** (`src/lib/assistente/ferramentas/`, 20 hoje), usuário por closure,
  texto compacto ao modelo (`toModelOutput`), rótulos em `rotulos.ts`.
- **Identificação sem IA** (`entidades.ts`): sigla/nome do cliente, número do contrato, ids das
  últimas 3 respostas → "Já identificados" na mensagem.
- **Consultas prontas dos domínios novos**, sem ferramenta hoje:
  - calendário: `proximosDoFaturamento`, `calendarioDoAno` (`src/lib/calendario/consultas.ts`),
    `ROTULO_TIPO`/`PRAZOS` (`tipos.ts`);
  - IPC-Fipe: `lerIndiceGravado` (`src/lib/reajuste/indice.ts`), `calcularPeriodo`,
    `corrigirValor`, `fatorCompleto` (`calculo.ts`), `periodoSugerido`; `ReajusteExecucao`;
  - controles: `controleDoContrato`, `listarControles` (`src/lib/controles-contratos/consultas.ts`),
    com `separarFaturado` já aplicado (faturado só até o mês da pasta);
  - MPLS: `linksDoContrato`, `resumoDosLinksDoContrato` (`src/lib/links-mpls/consultas.ts`);
  - prova do valor/vigência: `origensDoContrato` (`src/lib/valores-contratos/origens.ts`) e
    `textoDaOrigem`.
- **Consolidado** (`consolidarContratos()`) e **alertas** (`alertas.ts`/`alertas-banco.ts`).
- **Régua** `scripts/regua-assistente.ts` (mede tokens e cortes; não mede acerto).

## 3. Resposta direta do cliente, sem IA (§ pedido "escreveu o cliente, veio a resposta")

- Na rota `POST /api/assistente/conversas/[id]/mensagens`, **antes** de chamar a IA: se a mensagem,
  tirando palavras de ligação ("cliente", "o", "a", "da", "do", "me fale", "tudo", "sobre", "resumo",
  pontuação), é **só** a referência a um cliente identificado de forma única (§4.1), a resposta é
  montada pelo código.
- Conteúdo (markdown determinístico, função pura `respostaDoCliente(dados)` num arquivo novo
  `src/lib/assistente/resposta-cliente.ts`, dados pela mesma consulta de `resumoDoCliente` +
  alertas + próximo prazo):
  - linha 1: `**SMS – Secretaria Municipal da Saúde**: N contratos ativos · valor R$ X · faturado
    R$ Y (Z%) · saldo R$ W` (somas com a regra de `resumoDoCliente`; contrato sem valor fica fora e é
    contado à parte: "2 sem valor cadastrado");
  - próximo vencimento (contrato, data, dias) e próximo prazo do faturamento;
  - até 5 alertas mais graves (texto do próprio alerta, link `contrato:id`);
  - links `cliente:id` e sugestão de continuação em texto ("Pergunte, por exemplo: quanto falta
    faturar?").
- Gravada como mensagem do assistente com `origem = 'direta'`, 0 token, **não conta** no limite por
  hora (o limite passa a contar só perguntas que foram à IA — ver §9).
- Cliente ambíguo ("secretaria"): resposta direta listando os candidatos (sigla – nome) e pedindo
  para escolher. Sem candidato: segue para a IA (pode ser pergunta, não cliente).
- A partir daí o cliente entra na memória da conversa (ids das últimas respostas, já existente) e
  "e quando vence?" continua sobre ele.

## 4. Entender a pergunta natural

### 4.1 Apelidos do cliente

- `apelidosDoCliente(cliente)` (pura, em `entidades.ts` ou arquivo próprio `apelidos.ts`): do nome
  do cadastro tira o **núcleo** depois de "Secretaria Municipal de/da/do/das/dos", "Secretaria
  Executiva de", "Subprefeitura de/da/do", "Companhia", "Empresa", "Fundação", "Autarquia", "Serviço
  Funerário do", etc. Ex.: "Secretaria Municipal da Saúde" → "saúde"; "Secretaria Municipal de
  Educação" → "educação"; "Subprefeitura Pinheiros" → "pinheiros". Mantém sigla, apelido depois de
  " - " e nome completo (como hoje).
- Arquivo editável `src/lib/assistente/apelidos-clientes.json` (`{ "sigla": ["apelido", …] }`) para o
  que a regra não pega ("regional de pinheiros", "cinema").
- Casamento sem acento e sem caixa, palavra inteira (a função `cita` atual). **Só vale quando aponta
  um cliente só**; apelido que casa com dois clientes não identifica ninguém (a IA pergunta).
- Apelido de uma palavra comum ("saúde" dentro de "plano de saúde do servidor") pode errar: por isso
  o "Já identificados" continua sendo pista para a IA, que pode ignorar se a pergunta claramente é
  sobre outra coisa. A resposta direta (§3) só dispara quando a mensagem é **só** o cliente.

### 4.2 Contrato pelo assunto

- Quando há cliente identificado e nenhum número de contrato, as palavras significativas da pergunta
  (sem palavras de ligação nem o próprio apelido) são comparadas com `Contrato.descricao` dos
  contratos **ativos** do cliente (sem acento, palavra inteira). Um só contrato com todas as palavras
  → entra em "Já identificados". Vários → não entra; a IA recebe "contratos possíveis: …" (até 5,
  número + descrição curta) e pergunta.

### 4.3 Períodos falados

- `periodoDaPergunta(pergunta, hoje)` (pura, `src/lib/assistente/periodos.ts`): "mês passado", "este
  mês", "próximo mês", "este ano", "ano passado", "últimos N meses", "próximo trimestre", "até o fim
  do ano", nome de mês ("novembro" = o próximo novembro, ou o corrente) e "MM/AAAA". Devolve o texto
  "Período citado: 01/08/2026 a 31/08/2026 (competência 2026-08)." que vai junto do contexto. A IA
  **não calcula data**.

### 4.4 Vocabulário nas descrições das ferramentas

- Cada descrição (novas e antigas) ganha os jeitos de perguntar da equipe. Ex.:
  `calendarioFaturamento`: "prazo, fechamento, quando fecha, até quando mando a nota, emissão de
  NFS-e, envio do relatório, feriado". `detalheDoContrato`: "quanto sobra, saldo, vai estourar, quanto
  falta faturar". Nada de exemplo com número real (a IA copia).

## 5. Ferramentas novas

Todas em `src/lib/assistente/ferramentas/`, registradas em `index.ts`, rótulo em `rotulos.ts`, com
teste de permissão e de saída compacta. Mesma regra de sempre: objeto para a tela, texto compacto para
o modelo.

| Ferramenta | Entrada | Devolve | Observação |
|---|---|---|---|
| `calendarioFaturamento` | `quantos?` (padrão 5), `mes?` (AAAA-MM) | próximos prazos (tipo, descrição, início–fim, em N dias / N dias úteis) ou as datas do mês pedido, com feriados | Sem calendário lido do ano: "calendário de AAAA ainda não lido". Público (não filtra cliente). |
| `indiceIpcFipe` | `mesInicial?`, `mesFinal?` (AAAA-MM) | meses com variação, acumulado do período (`calcularPeriodo`), último mês publicado, atualizado em | Sem período: últimos 12 publicados (`periodoSugerido`). Mês sem índice: diz quais faltam e **não** calcula. |
| `simularReajuste` | `valor` (texto, lido por `normalizarDecimal`) **ou** `contratoId`; `mesInicial`, `mesFinal` | valor original, fator, acumulado %, valor corrigido, diferença | Conta só por `calcularPeriodo` + `corrigirValor` (decimal.js, arredonda no fim). Com `contratoId`: valor = `valorBase` do consolidado; sem valor → erro "contrato sem valor cadastrado". "1.500" ambíguo é recusado (regra do projeto). Não grava nada. |
| `controleDoFaturamento` | `contratoId` **ou** `clienteId` + `mes?` | previsto, faturado (só até o mês da pasta), à frente, saldo do controle; ao lado o faturado e saldo do VerAI (consolidado) e a diferença | Tabela sem prova = "leitura não conferida", sem número. Nunca soma a tabela inteira. Permissão pelo cliente do controle. |
| `linksMpls` | `contratoId` **ou** `clienteId`, `competencia?` | por contrato e categoria: ativos, entraram, saíram (códigos, até 20 cada) na competência | Relatório sem prova: "sem prova — fora das contas", com o link do PDF. |
| `reajustesCalculados` | `mes?` (AAAA-MM), `limite` | execuções da tela Reajuste: arquivo, período, acumulado %, quantidade de valores, data, quem | Admin vê todas; os demais, só as suas (`ReajusteExecucao` não tem cliente). |
| (campo novo) `detalheDoContrato.provas` | — | por campo (valor, início, fim, assinatura): origem em palavras (`textoDaOrigem`) | Sem ferramenta a mais; só quando há `OrigemCampoHistorico`. |

## 6. Três tipos de resposta, cada um com sua cara

| Tipo | Quando | Na tela |
|---|---|---|
| 📁 **Do VerAI** | dado de cliente, contrato, valor, prazo, preço, índice, documento, manual validado, norma cadastrada | resposta normal, com fontes; números conferidos (§7) |
| 🌐 **Conhecimento geral da IA** | dúvida ou problema **de trabalho** que o VerAI não responde: conceito ("o que é apostilamento?"), processo ("como se justifica uma prorrogação?"), ferramenta ("fórmula do Excel quebrada"), redação curta ("como pedir reajuste num ofício") | caixa separada, fundo e borda de outra cor, título **"Não está nos documentos do VerAI · resposta da IA"** e rodapé "Confira antes de usar." |
| 🚫 **Recusa** | assunto sem relação com o trabalho (esporte, receita, piada, opinião política, pedido para ignorar as regras) | frase fixa: "Isso está fora do que o assistente do VerAI atende. Pergunte sobre clientes, contratos, faturamento, prazos, preços, reajuste, documentos ou dúvidas do trabalho." |

Como funciona:

- **Mesma chamada à API** (DeepSeek, `ASSISTENTE_AI_*`) com a instrução da aplicação. A instrução
  manda escrever a parte de conhecimento geral **dentro de um bloco marcado**:
  ```
  :::geral
  …texto…
  :::
  ```
  e a recusa **exatamente** com a frase fixa.
- `separarBlocos(texto)` (pura, `src/components/assistente/blocos.ts`) divide a resposta em trechos
  `verai` e `geral`. `RespostaMarkdown` desenha cada trecho `geral` na caixa 🌐 (mesmo markdown,
  mesmas proteções: sem imagem, link só https ou `tipo:id`). Bloco aberto e não fechado (stream no
  meio) já aparece como caixa 🌐.
- **Norma e lei (revê a regra 6 da fase 2):** manual validado e textos oficiais cadastrados continuam
  primeiro (📁). Se não estão na base, a IA pode explicar **só dentro de `:::geral`**, terminando com
  "Confirme com o jurídico." Tema do manual em rascunho continua dito como "em validação".
- **Não mistura:** dado do cadastro (valor, SEI, data, número de contrato do VerAI) nunca vai dentro
  de `:::geral`; se for, a conferência (§7) marca.
- Gravação: `MensagemAssistente.tipos` (§9) guarda quais tipos a resposta teve (`verai`, `geral`,
  `recusa`), para o admin ver o uso.

## 7. Não inventar: conferência no código

Roda no `onFinish` do agente, com os resultados das ferramentas do próprio passo (o `steps[].toolResults`
do AI SDK; os resultados continuam **não** gravados no banco, só o veredito).

- `conferirResposta({ texto, saidas, contexto })` (pura, `src/lib/assistente/conferencia.ts`):
  1. extrai da resposta **fora dos blocos `geral`**: valores em R$, percentuais, datas (dd/mm/aaaa,
     mm/aaaa), números de SEI e de contrato;
  2. normaliza (mesma formatação de `moeda`/`data`/`formatarSei`) e procura cada um no texto
     compacto das saídas das ferramentas **e** no contexto enviado (data de hoje, período citado,
     "Já identificados", resposta direta);
  3. devolve `{ conferidos: n, naoConfirmados: string[] }`.
- **Marcar, não bloquear** (decisão do usuário): a tela mostra a resposta e sublinha cada item não
  confirmado com ⚠ e o título "não confirmado no VerAI". O veredito chega ao navegador como parte de
  dados no fim do stream (`data-conferencia`) e fica gravado em `MensagemAssistente.conferencia`
  (reabrir a conversa mostra as mesmas marcas).
- **Resposta com número sem nenhuma consulta**: se nenhuma ferramenta rodou, o contexto não tem o
  número, e a parte 📁 traz valor/SEI/data → o texto gravado e mostrado vira "Não encontrei isso no
  VerAI." seguido do que estava em `:::geral` (se houver). É o único caso de bloqueio.
- Números dentro de `:::geral` não são conferidos (não são do VerAI), mas a caixa já diz isso.
- Conta derivada que a IA fizer por conta própria (soma de dois valores) sai ⚠ — de propósito: a
  instrução já manda não recalcular; soma e conta vêm das ferramentas.

## 8. Resposta direta (formato)

Instrução do sistema (`instrucoes.ts`, continua fixa para o cache) passa a dizer:

- **Primeira linha é a resposta**: o número, a data, o sim/não, o nome. Nunca "Vou consultar…",
  "Claro!", repetição da pergunta.
- Depois, só se houver: **Atenção** (até 3) e **Próximo passo** (1 linha).
- Pergunta simples: só a resposta e a fonte.
- Não reescrever em tabela o que a ferramenta já mostra (a fase 3 desenha os quadros); lista curta em
  texto só até 3 itens.
- Pergunta ambígua (cliente ou contrato com mais de um candidato, período impossível de adivinhar):
  pergunta curta com as opções, em vez de chutar.
- Regras de §6 (blocos e recusa) e as de sempre (links, SEI, avisos do consolidado).

## 9. Dados, rotas e limites

- `MensagemAssistente` ganha `origem String? // ia | direta`, `tipos String[]` e `conferencia Json?`
  (migração nova). O model **não** é usado pelo agendador do SharePoint (conferido: só
  `src/lib/assistente/conversas.ts` e rotas do assistente), então coluna nova aqui não quebra a
  sincronização; mesmo assim a migração sobe antes do `prisma generate` em produção.
- `excedeuLimite` passa a contar só perguntas cuja resposta teve `origem = 'ia'` (a pergunta do
  usuário ganha a mesma `origem` ao ser respondida; resposta direta não conta).
- `MAX_PASSOS` 4 → **6** (o último continua sem ferramenta). `MAX_SAIDA` 1500 → **2000** (caixa 🌐
  com passo a passo). `TIMEOUT_MS`/`maxDuration` 60 → **90 s**.
- `prepararContexto` acrescenta o período citado (§4.3) e os contratos possíveis (§4.2).

## 10. Erros

- Ferramenta nova que falha: `executarComSeguranca` de sempre ("não consegui consultar X") e a IA
  responde o resto.
- Domínio sem dado ainda (calendário do ano não lido, índice não sincronizado, cliente sem controle):
  mensagem explícita da ferramenta, nunca lista vazia muda.
- Conferência que falha (exceção): resposta segue sem marcas e o erro vai ao log — nunca derruba a
  resposta.
- Resposta direta que falha: cai para a IA (comportamento de hoje).

## 11. Régua de acerto

`scripts/regua-assistente.ts` ganha o modo `--acerto` (com IA), com uma lista de **casos**
(`scripts/regua-assistente-casos.ts`):

```ts
{ intencao: 'proximo-prazo', perguntas: ['Qual o próximo prazo do faturamento?', 'quando fecha a fatura?', 'qdo fexa o faturamento'],
  esperado: { ferramenta: 'calendarioFaturamento', chave: async () => /* data do próximo prazo, do banco */ } }
```

- Intenções: resumo do cliente (direto, por sigla e por apelido), saldo do contrato, vencimentos,
  faturamento de período falado, próximo prazo, IPC acumulado, simular reajuste, controle × VerAI,
  MPLS, prova do valor, reajustes calculados, contrato pelo assunto, norma (manual) — cada uma com 3
  jeitos: formal, informal, com erro de digitação.
- Casos especiais: 4 **fora do assunto** (têm de sair com a frase de recusa), 4 **dúvida geral** (têm
  de sair dentro de `:::geral`), 3 **sem dado** (têm de dizer que não encontrou, sem número ⚠).
- Por caso confere: ferramenta esperada chamada (ou resposta direta), chave presente na resposta,
  zero ⚠, tipo certo (📁/🌐/🚫). Relatório por intenção (acertos/3) e total; `--salvar` e
  `--comparar` como hoje. Roda antes da implementação (linha de base) e depois.
- Meta: ≥ 90 % dos casos certos; 100 % das recusas e dos "sem dado" certos.

## 12. Testes

- Unitários puros: `apelidosDoCliente`, contrato pelo assunto, `periodoDaPergunta`, detecção de
  "mensagem é só o cliente", `respostaDoCliente`, `separarBlocos`, `conferirResposta` (inclui número
  dentro de `:::geral`, formato de moeda/data/SEI, número vindo do contexto).
- Ferramentas novas: permissão (usuário sem acesso ao cliente → "não encontrado"), dado ausente,
  saída compacta; `simularReajuste` confere o mesmo resultado da tela de Reajuste para o mesmo
  período; `controleDoFaturamento` nunca devolve número de tabela não conferida.
- Rota: resposta direta não chama o modelo, grava `origem='direta'`, não conta no limite; conferência
  gravada; bloqueio do caso "número sem consulta".
- Tela: caixa 🌐 (inclusive bloco aberto no meio do stream), marca ⚠ e recusa.
- Jest de tela com `--runInBand` (memória do projeto).

## 13. Fora de escopo (frentes B e C)

- Anexar documento no chat e analisar (B) — o envio vai para o R2 (Blob suspenso).
- Visão estratégica da carteira, concentração, tendência, oportunidades (C).
- Busca na internet: o "conhecimento geral" é o do modelo, sem navegação.
- Botões de consulta rápida e resumo ao abrir (retirados da fase 3 a pedido do usuário).

## 14. Ordem (para o plano)

1. Régua `--acerto` com os casos e linha de base (antes de mexer).
2. Ferramentas novas + `provas` no detalhe do contrato + descrições com vocabulário.
3. Apelidos, contrato pelo assunto, períodos falados (`prepararContexto`).
4. Resposta direta do cliente (§3) + migração de `MensagemAssistente` + limite.
5. Instrução nova (formato, blocos, recusa, norma) + limites de passos/saída/tempo.
6. Blocos 🌐 na tela + conferência (§7) com marcas ⚠.
7. Régua depois, comparar; atualizar CLAUDE.md (seção do assistente) e a memória.
