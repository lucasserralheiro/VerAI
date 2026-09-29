# Calendário de faturamento no VerAI — design

**Status:** rascunho para revisão do usuário (29/09/2026). Depende da base
`2026-09-29-biblioteca-documentos-prodam-design.md`. **A leitura dos prazos depende de um teste**
(§4) antes do plano definitivo.

## 1. Pedido

Tela **Calendário de faturamento** dentro de "Relatórios dos clientes", a partir da pasta CALENDÁRIO
FATURAMENTO do SharePoint, atualizada pelo agendador.

## 2. Hoje × depois

| | Hoje | Depois |
|---|---|---|
| Próximo prazo | abrir o PDF e achar a cor certa no mês certo | cartão "Próximo prazo: encerramento do faturamento — 08/10 (em 9 dias)" |
| Prazo de receber contratos e aditamentos para faturar no mês | no PDF | na tela do calendário e em uma linha na tela Relatórios |
| Feriados e expediente suspenso | lista no PDF | no calendário, com o nome |
| Ano novo | PDF novo na pasta | lido sozinho quando entrar na pasta |

## 3. Fonte (29/09/2026)

`Calendário de Faturamento PRODAM 2026.pdf`: uma página (A4 deitado), "Programação de Faturamento",
PRODAM/DAF/GFP/NAV/FAT. Traz:

- **13 meses** em grade (jan/2026 a jan/2027);
- **feriados em texto**: "01/01/2026 quinta-feira Confraternização Universal", "18/02/2026 quarta-feira
  Quarta Feira de Cinzas até às 12hs"…;
- **legenda** com seis marcações: Período de Emissão de NFS-e · Data de Encerramento do Faturamento ·
  Prazo para Envio do Relatório de Faturamento · Prazo para Recebimento de Contratos e Aditamentos (para
  faturamento no mês) · Prazo para Recebimento de Processos SEI com Recursos e Informações para
  Faturamento · Expediente Suspenso;
- os prazos marcados **só por cor de fundo** nos dias — não estão no texto.

**O que o teste de 29/09 já mostrou:** o PDF desenha retângulos preenchidos em sete cores além dos
cinzas (17, 13, 11, 12, 8, 4 e 5 retângulos). Levando cada retângulo até os números de dia dentro dele,
uma das cores marca **um dia por mês** (6, 6, 8, 8, 8, 9, 8, 7, 8…) — cara de "data de encerramento" —
e outras marcam faixas de dias. Alguns retângulos cobrem vários dias (faixa). Dá para ler; falta
provar que dá para ler **certo**.

## 4. Leitura

1. **Feriados**: regex nas linhas "dd/mm/aaaa dia-da-semana Nome" — texto, sem risco.
2. **Meses**: posição de cada rótulo de mês ("janeiro", "fevereiro"…, "janeiro/2027") define o bloco da
   grade; o número do dia é o texto dentro do bloco, na coluna do dia da semana.
3. **Marcações**: cada retângulo colorido é levado aos dias cujo número fica dentro dele, no bloco do
   mês. Retângulo que cobre vários dias vira **faixa** (de–até).
4. **Significado da cor sai da própria legenda**: o quadradinho colorido ao lado de cada texto da
   legenda. **Nenhuma cor fica escrita no código**, porque o calendário de 2027 pode trocar as cores.
5. **Prova** (sem ela, os prazos não entram):
   - todo mês tem **exatamente uma** "Data de Encerramento do Faturamento";
   - toda marcação cai em dia útil, ou em dia com feriado/expediente suspenso quando é essa a marcação;
   - toda cor achada nos dias existe na legenda, e toda legenda de prazo aparece em pelo menos 10 meses;
   - as faixas são contínuas dentro do mês.
6. Prova ok → status `ok`. Falhou → status `so-feriados`: a tela mostra o PDF, os feriados e o aviso
   "os prazos deste calendário não puderam ser lidos com segurança — veja o PDF". **Nunca** uma data
   inventada.

**Teste antes do plano (tarefa 1):** rodar a leitura no PDF de 2026 e conferir mês a mês contra o PDF
aberto na tela (o próprio Claude confere, abrindo o PDF no navegador do app e comparando a imagem). Se
não fechar, o calendário fica com feriados + PDF e os prazos voltam a ser discutidos com o usuário.

## 5. Banco

- `CalendarioFaturamento`: `ano` (único), `arquivoId`, `status` (`ok` | `so-feriados`), `avisos Json`,
  `lidoEm`.
- `DataFaturamento`: `calendarioId`, `inicio` (data), `fim` (data, igual a `inicio` quando é um dia só),
  `tipo` (`EMISSAO_NFSE` | `ENCERRAMENTO` | `ENVIO_RELATORIO` | `RECEBIMENTO_CONTRATOS` |
  `RECEBIMENTO_PROCESSOS_SEI` | `EXPEDIENTE_SUSPENSO` | `FERIADO`), `descricao`.
- O tipo é resolvido pelo **texto da legenda** (tolerante a caixa e acento); texto novo na legenda →
  tipo `OUTRO` com a descrição da própria legenda (aparece, não some).

## 6. Tela `/calendario-faturamento`

- Topo: "Calendário de faturamento" · "Prazos do faturamento da PRODAM (DAF/GFP)" · "Atualizado em …" ·
  botão "Calendário oficial (PDF)".
- **Próximos prazos**: três cartões com o tipo, a data, "hoje", "amanhã", "em 9 dias"; prazo que vence em
  até 3 dias úteis em laranja.
- **Mês**: grade do mês atual com setas para os outros; cada dia com marcadores pequenos por tipo, e o
  nome do feriado; clicar num dia lista o que acontece nele. Legenda fixa embaixo.
- **Ano**: doze miniaturas de mês lado a lado (lembra o PDF, para quem já usa), com as marcações.
- **Lista**: todos os prazos do ano em ordem, filtrável por tipo — a forma mais rápida por teclado e a
  que vira a visão em tela estreita.
- Cores **da paleta do VerAI**, uma por tipo, com legenda direta e contraste conferido nos dois temas —
  não as do PDF, que são fortes e não seguem o tema escuro.
- Sem calendário do ano atual → "O calendário de 2027 ainda não está na pasta do SharePoint", com o de
  2026 disponível.

**Na tela Relatórios** (`/relatorios`): uma linha, "Próximo prazo do faturamento: encerramento — 08/10
(em 9 dias)", levando ao calendário. Sem painel novo.

## 7. API e permissão

- `GET /api/calendario-faturamento?ano=` → status, datas e avisos.
- `GET /api/calendario-faturamento/proximos?n=3`.
- Qualquer usuário logado (é o calendário de todos).

## 8. Testes

- Feriados com as linhas reais do PDF de 2026.
- Leitura por posição com um PDF de fixture pequeno (dois meses, três cores e legenda) e com o de 2026
  como teste de integração (o resultado conferido na tarefa 1 vira o esperado).
- Prova: mês sem encerramento, cor fora da legenda, faixa quebrada → `so-feriados`.
- "Próximos prazos" com relógio fixo (hoje, amanhã, dias úteis, virada de ano).

## 9. Fora do escopo

- Lembrete por e-mail ou notificação (o usuário decidiu sem e-mail para o SharePoint; se quiser, é outro
  pedido).
- Cruzar o prazo com contratos e aditamentos pendentes ("este aditivo chegou depois do prazo do mês") — a
  próxima evolução natural, com design próprio.

## 10. Riscos

- **Leitura por cor não fecha** → `so-feriados` com o PDF (§4.6); nada errado aparece.
- **Layout muda em 2027** → a leitura depende do rótulo dos meses, dos números e da legenda, não de
  posições fixas; se a prova falhar, cai no mesmo modo seguro.
