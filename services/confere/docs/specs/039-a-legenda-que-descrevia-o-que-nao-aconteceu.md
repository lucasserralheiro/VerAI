# ESPEC 039 — A legenda que descrevia o que não aconteceu

| | |
|---|---|
| **Status** | **Implementada** |
| **Versão** | 1.0 — 2026-09-02 — escrita depois da implementação |
| **Depende de** | [ESPEC 002](002-painel-de-divergencias.md), [ESPEC 008](008-acessibilidade-da-interacao.md), [ESPEC 009](009-analise-da-medicao.md) — todas implementadas |
| **Revisa** | `R-UI-04` da ESPEC 002 e o alcance da `D-05` da ESPEC 008 — ver §5 |
| **Origem** | Relato do usuário sobre um par real de arquivos (`PA-SMIT-260319-739 Q-00739-7.pdf` / `SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx`): a legenda afirmava "Saldo negativo" sem que o processamento desse par tivesse produzido nenhuma linha com saldo negativo |

---

## 1. Problema

A legenda do grid de divergências (`DivergenciaGrid.tsx`) explica duas marcas — `perfil` e `-1` —
e sempre exibia as duas, incondicionalmente, sempre que havia ao menos uma linha divergente na
tela.

Isso é correto quando as duas condições ocorrem no relatório. Não é quando só uma ocorre: quem lê
"`-1` Saldo negativo: medido acima do contratado" ao lado de um grid que **não tem** nenhuma linha
negativa procura uma linha que não existe. A legenda deixou de descrever o relatório em mãos e
passou a descrever o conjunto de marcas que a aplicação **é capaz de** produzir — uma diferença que
só importa para quem já leu o código, não para quem confere um documento.

## 2. O que a leitura do código mostrou

Não houve execução do par de arquivos citado nesta sessão — a análise é estática, sobre
`frontend/src/app/components/DivergenciaGrid.tsx`, `AnaliseMedicaoPanel.tsx` e o backend em
`domain/entities/report.py`.

1. **A legenda era incondicional.** `Legenda()` não recebia dado nenhum do relatório; renderizava
   as duas `<dd>` sempre que `divergencias.length > 0`, dentro ou fora de o saldo negativo ou o
   item de perfil ocorrerem.
2. **As duas marcas têm domínios diferentes, e um dos dois nunca cruza o grid.** Itens de perfil ou
   pacote entram sempre como `1/1` (`R-DIV-04`) e por construção nunca divergem — portanto nunca
   aparecem em `divergencias`. Eles só existem, quando existem, na classificação da ESPEC 009
   (`SituacaoDaAnalise.perfis_ou_pacotes`, contados dentro do bloco *Sem divergência*). Saldo
   negativo, ao contrário, é por definição uma divergência (`R-DIV-09`) e por isso está sempre
   dentro de `divergencias` quando ocorre.
3. **Consequência prática:** dá para responder "há saldo negativo neste relatório?" só olhando
   `divergencias`. Não dá para responder "há item de perfil?" do mesmo lugar — essa resposta mora
   na análise, não no grid.

## 3. Regras

| ID | Regra |
|---|---|
| `R-LEG-01` | Cada entrada da legenda do grid de divergências só aparece quando o relatório tem ao menos um item com a condição que ela descreve. As duas entradas juntas, uma só, ou nenhuma — nunca uma entrada sem correspondência na tela |
| `R-LEG-02` | A presença de saldo negativo é decidida a partir de `divergencias` (`ehNegativo`, já usada por linha). A presença de item de perfil/pacote é decidida a partir da classificação da ESPEC 009 (`perfis_ou_pacotes` somado pelas quatro situações), porque esses itens nunca aparecem em `divergencias` (§2.2) |
| `R-LEG-03` | Se nenhuma das duas condições ocorrer, a legenda inteira não é renderizada — não sobra um `<dl>` vazio |

## 4. Decisões

### D-01 — Revisar a legenda, não o `title`

A alternativa óbvia seria voltar a algum mecanismo por linha (tooltip, `title`). Isso reabriria a
`D-05` da ESPEC 008 pelo motivo errado: o problema não é *onde* a explicação mora, é que ela
afirmava uma condição ausente. A correção fica inteiramente dentro da legenda única e visível que a
`D-05` já estabeleceu — só passa a ser condicional ao conteúdo do relatório.

### D-02 — A checagem de "tem perfil" não pode vir do grid

Cogitado calcular `temPerfil` a partir de `divergencias` e `demaisItens`, como `temSaldoNegativo`.
Não funciona: itens de perfil não divergem por construção (§2.2), então essa conta daria sempre
`false`, mesmo em relatórios com itens de perfil de verdade — apagando a marca exatamente quando ela
deveria aparecer. `temItensDePerfil` teve de vir de `relatorio.analise`, calculado em
`ResultadoPanel.tsx` e passado como prop.

### D-03 — Sem prop nova em `AnaliseMedicaoPanel`

O painel de análise usa as mesmas marcas (`perfil`, saldo negativo) e remete à legenda do grid por
texto `sr-only` ("ver legenda abaixo do título do grid"). Ele não precisa saber se a legenda está
visível: continua marcando cada linha da forma que já marcava, e a legenda — em outro componente —
é que decide, olhando o relatório inteiro, se explica cada marca ou não.

### D-04 — Cogitada e descartada: remover a entrada de saldo negativo por completo

Levantada durante a sessão que produziu esta espec: em vez de condicionar a entrada de saldo
negativo à sua ocorrência, removê-la da legenda **sempre**, mesmo quando há linha negativa de
verdade. A checagem de que isso não reabriria `R-UI-08`/`R-ACE-02` se sustenta — o portador textual
que essas regras exigem é o `sr-only` por linha (`" — medido acima do contratado"`), não a legenda,
e o número em si (`-1`, `-2`) já é texto com sinal, não só cor.

**Decisão do usuário: manter a legenda como está — as duas entradas, cada uma condicional à sua
ocorrência (§3).** A entrada de saldo negativo continua existindo porque, mesmo sendo tecnicamente
dispensável para a acessibilidade, ela é o único sinalizador **fora da tabela** de que há um achado
grave — o `sr-only` só se lê por linha, dentro da tabela, e sem ele quem confere só sabe que o achado
existe se já estiver olhando a linha certa. Registrado para não reabrir a mesma pergunta sem o
contexto de já ter sido respondida.

## 5. Revisão da `R-UI-04` (ESPEC 002) e do alcance da `D-05` (ESPEC 008)

Nova redação da `R-UI-04`:

> Itens de perfil ou pacote trazem marcação, com a explicação em legenda visível junto ao grid
> (`R-DIV-04`), **quando o relatório tiver algum** (`R-LEG-01`). A explicação não depende de
> cursor, de foco nem de toque.

A `D-05` da ESPEC 008 continua valendo integralmente quanto à **forma** da explicação — legenda
única, visível, fora do `title` — e passa a ter o alcance explícito de que "uma vez só" descreve
*como* a marca é explicada quando ocorre, não uma presença incondicional das duas frases.

**O que se perde:** nada verificável — nenhum teste afirmava a legenda incondicional (§7).

**O que se ganha:** a legenda deixa de poder mentir por sobra. Uma entrada só aparece quando há uma
linha na tela que a sustenta.

## 6. O que muda no código

| Arquivo | Mudança |
|---|---|
| `frontend/src/app/components/DivergenciaGrid.tsx` | `Legenda` recebe `temPerfil` e `temSaldoNegativo`; renderiza cada `<div>` condicionalmente e retorna `null` se nenhuma das duas ocorre. `temSaldoNegativo` é calculado no próprio componente a partir de `divergencias` |
| `frontend/src/app/components/ResultadoPanel.tsx` | `<DivergenciaGrid>` ganha a prop `temItensDePerfil`, calculada em `relatorio.analise.situacoes.some((s) => s.perfis_ou_pacotes > 0)` |

Nenhuma mudança em `backend/`: `perfis_ou_pacotes` e `sem_cobertura_contratual` já existiam na
resposta da API antes desta espec.

## 7. Testes

| Nível | Situação |
|---|---|
| `tsc --noEmit` | Passa — as duas novas props estão tipadas e usadas nos dois pontos |
| e2e (`frontend/e2e/`) | Nenhum teste existente afirma o texto fixo da legenda (`Saldo negativo` / `Item de perfil ou pacote`), então nenhum quebrou. `analise.spec.ts` (`R-PAN-06`) e `derivadas.spec.ts` seguem intactos — não dependem da legenda do grid |
| Fixture do piloto (`TC-52-SMIT`) | Tem item de perfil (R-PAN-06, "4 desses itens") e item com saldo negativo (`14.049.00054.00`, `-2`) — as duas condições ocorrem, então a legenda do piloto continua mostrando as duas entradas, sem mudança visível na captura de referência |

**Em aberto:** não existe hoje uma fixture de e2e com divergência e **sem** saldo negativo (o caso
que motivou esta espec). `R-LEG-01`/`R-LEG-03` estão cobertas por leitura de código e por
`tsc`, não por um teste de tela que reproduza o caso relatado — ver §8, ponto 1.

## 8. Riscos e pontos em aberto

| # | Ponto | Impacto |
|---|---|---|
| 1 | Falta uma fixture/teste de e2e para o caso "diverge, mas nenhuma linha é negativa" — o caso que motivou a espec nunca é exercitado automaticamente | Sem cobertura de regressão automática para `R-LEG-01` no caminho "some o `-1`" |
| 2 | `temItensDePerfil` soma `perfis_ou_pacotes` das quatro situações, não só de *Sem divergência*. Não há caso hoje em que outra situação tenha esse campo positivo, mas se um dia houver, a legenda ainda aparece — comportamento conservador, não um risco de omissão |

Nenhum bloqueia a implementação — ela já está entregue.

## 9. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `Legenda` condicional em `DivergenciaGrid.tsx` | PP |
| B | Prop `temItensDePerfil` calculada e passada em `ResultadoPanel.tsx` | PP |
| C | `tsc --noEmit` | feita |

**Total: menos de uma hora.** Dois arquivos, nenhuma mudança de backend, nenhum token novo.

## 10. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-02 | Redação depois da implementação, a pedido, registrando a revisão da `R-UI-04` e o alcance da `D-05` (ESPEC 008). Durante a mesma sessão, cogitou-se remover a entrada de saldo negativo por completo (`D-04`) — descartado a pedido do usuário antes de qualquer commit; a legenda manteve as duas entradas condicionais desde a primeira versão |
