# TASKS 024 — Backlog de "O asterisco que explica o bloco final"

| | |
|---|---|
| **Especificação** | [ESPEC 024](../specs/024-o-asterisco-que-explica-o-bloco-final.md) v1.0 |
| **Plano** | [PLANO 024](../plans/024-plano-o-asterisco-que-explica-o-bloco-final.md) v1.0 |
| **Versão** | 1.0 — 2026-08-18 |
| **Total** | 9 tarefas · 3 portões · 0 insumos |
| **Status** | **Concluído** — 2026-08-18. Portões `P0`, `P1` e `P2` fechados. Backend 556 → **559 passed**, suíte verde em 18min17. **Um desvio**, em §6 — o PLANO 024 não previu a âncora `T-1408`, emendado no [PLANO 024 §7](../plans/024-plano-o-asterisco-que-explica-o-bloco-final.md) |

> **Escrito *depois* da implementação**, ao contrário dos TASKS 020 a 023. É desvio de método e
> está registrado como tal em §6.1: a §6 deste documento é a única parte dele que não poderia ter
> sido escrita antes, e é a que tem valor.

---

## 1. Convenções

**Identificadores** `T-18nn`, continuando a numeração: a ESPEC 023 fechou em `T-1735`.

**Definição de pronto:** código e teste na mesma entrega; `ruff check` e `mypy src/` limpos;
`pytest` verde; comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-18nn): descrição`.

### 1.1 Duas regras que atravessam este backlog

**1 — Os dois textos são autorais, não transcritos.** Ao contrário das ESPECs 020–023, que
transcrevem valores de planilhas e PDFs, aqui a frase e o asterisco nascem da própria espec. Não há
oráculo externo, e por isso os testes citam as cadeias **por extenso**, e não via `layout.*`:
comparar contra a constante que a implementação define provaria só que o código concorda com ele
mesmo.

O sinal no diff é um teste que asserte `layout.NOTA_DEMAIS_ITENS` em vez do texto literal.

**2 — Toda âncora de invariância do documento tem de ser inventariada antes de abrir o
renderizador.** Esta entrega **acrescenta texto ao corpo do `.docx` de propósito**, e é a primeira
desde a ESPEC 020 a fazê-lo. Qualquer teste que afirme "o corpo não se move" vai acusar — e deve.

O sinal no diff é uma constante de contagem ou de `sha256` alterada sem justificativa ao lado.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** Os testes, escritos antes | T-1800 … T-1803 | **P0** | F0 |
| **E1** A implementação | T-1804 … T-1806 | **P1** | F1 |
| **E2** O conjunto | T-1807 … T-1809 | **P2** | F2 |

### 2.1 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| O título do bloco final ganha `*` | Quais códigos entram no bloco final |
| O corpo do `.docx` ganha **um** parágrafo, e só quando há bloco final | As quantidades, a ordem e as descrições das linhas |
| A âncora `T-1408` (§6.1) | `CORPO_DO_PILOTO_CODIGOS` — 79, inalterado |
| — | O XLSX de análise, a API, o frontend, o manual |

---

## 3. Épico E0 — Os testes, escritos antes `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-1800 — O título termina em asterisco
**Tamanho:** PP · **Ref:** `R-NOT-01`

Em `test_docx_formatacao.py`, reaproveitando a fixture `gerado` do piloto — que tem **4** itens no
bloco final (ESPEC 018 §8.5).

A cadeia `"DEMAIS ITENS DO LEVANTAMENTO*"` entra **por extenso** (regra 1 do §1.1).

**Pronto quando:** existe e reprova, acusando o título de hoje sem o asterisco.

---

#### T-1801 — A nota aparece no corpo
**Tamanho:** PP · **Ref:** `R-NOT-02`

A frase é procurada em `documento.paragraphs`, não nas células das tabelas: `R-NOT-02` pede
parágrafo de corpo, e achá-la numa célula significaria que ela entrou na grade medida — que é
justamente o que `D-01` proibiu.

**Pronto quando:** existe e reprova por ausência.

---

#### T-1802 — Sem bloco final, nada aparece
**Tamanho:** PP · **Ref:** `R-NOT-03` · **Fecha com fixture existente**

Em `test_docx_estrutura.py`, com `relatorio_vazio` — a fixture do `conftest.py:101`, que já é o
caso "sem bloco final" e foi feita para testar a estrutura isolada de conteúdo (T-208).

**Nenhuma fixture nova.** Se este teste reprovasse contra o código intocado, a premissa do PLANO
024 §1 — de que `R-NOT-03` já vale por construção — estaria errada, e o plano precisaria de uma
fase a mais.

**Pronto quando:** **passa já**, contra o código intocado.

---

#### T-1803 — O portão `[portão P0]`
**Tamanho:** PP · **Portão P0**

T-1800 e T-1801 reprovam pelo motivo certo; T-1802 passa.

**Pronto quando:** a saída da reprovação nomeia o texto de hoje — `'DEMAIS ITENS DO LEVANTAMENTO'`
sem asterisco —, e não um erro de importação ou de fixture.

---

## 4. Épico E1 — A implementação `[portão P1]`

#### T-1804 — O asterisco na constante
**Tamanho:** PP · **Ref:** `R-NOT-01`, `D-01` · **Primeiro toque em `src/`**

`layout.TITULO_DEMAIS_ITENS` passa a `"DEMAIS ITENS DO LEVANTAMENTO*"`.

**Sem condicional nova.** O chamador em `docx_renderer.py` já só usa este título quando
`relatorio.demais_itens` não é vazio — `R-NOT-01` sai de graça, e acrescentar um `if` aqui criaria
uma segunda decisão sobre o mesmo fato.

**Pronto quando:** T-1800 verde.

---

#### T-1805 — `NOTA_DEMAIS_ITENS`
**Tamanho:** PP · **Ref:** `R-NOT-02`, `R-NOT-05`

A constante ao lado da anterior, com o comentário registrando que ela mantém a neutralidade da
`D-06` da ESPEC 018: descreve o mecanismo — código sem correspondência no contrato analisado — e
não a causa da ausência.

**Pronto quando:** existe, com o comentário.

---

#### T-1806 — A condicional em `_rodape` `[portão P1]`
**Tamanho:** PP · **Ref:** `R-NOT-02`, `R-NOT-03`, `R-NOT-04` · **Portão P1**

O parágrafo novo entra **dentro** de `_rodape`, depois do de contrato/proposta, sob
`if relatorio.demais_itens`.

**Dentro, e não como um `if` externo que decida chamar `_rodape` ou não:** ela continua responsável
pelo parágrafo de contrato/proposta em qualquer caso, e mover a decisão para fora poria em dois
lugares a pergunta *"existe bloco final?"*.

Mesmo `Pt(layout.CORPO_FONTE)` e `layout.FONTE_REGULAR` do parágrafo vizinho, sem negrito e sem cor
(`R-NOT-04`).

**Pronto quando:** T-1800, T-1801 e T-1802 verdes, e `test_docx_formatacao.py` e
`test_docx_estrutura.py` inteiros verdes **sem asserção alterada**.

---

## 5. Épico E2 — O conjunto `[portão P2]`

#### T-1807 — Reancorar `T-1408` `[risco]` · **não previsto pelo plano**
**Tamanho:** P · **Ref:** §6.1 · **Ler §6.2 antes**

`test_capa.py::test_t1408_o_corpo_do_documento_nao_se_move` afirma que o corpo do documento do
piloto não se move, por contagem **e** `sha256`. Esta entrega o move de propósito.

**A reancoragem não é colar o número novo.** Antes de trocar a constante, ficou provado que desfazer
**apenas** as duas mudanças previstas — retirar a nota e tirar o asterisco do título — reproduz o
`sha256` anterior caractere a caractere. Se qualquer outra das 16 mil células tivesse se movido
junto, a reversão não bateria.

| | Antes | Depois |
|---|---|---|
| `CORPO_DO_PILOTO_TEXTOS` | 16.028 | **16.029** |
| `CORPO_DO_PILOTO_SHA256` | `a5c241f6…` | **`f549ca4c…`** |
| `CORPO_DO_PILOTO_CODIGOS` | 79 | **79 — inalterado** |

A terceira linha é a confirmação independente: a espec não acrescenta nem remove linha de item.

**Pronto quando:** `test_capa.py` verde e o comentário ao lado das constantes registra a prova da
reversão — não só o número novo.

---

#### T-1808 — Suíte e ferramentas `[portão P2]`
**Tamanho:** PP · **Portão P2**

Backend 556 → **559**, com a contagem reconciliada: três testes novos, nenhum removido.
`ruff check` e `mypy src/` limpos sobre os arquivos tocados.

**Não toca o frontend.** Nenhum arquivo de `frontend/` entra nesta entrega, e `tsc`/`next lint` não
fazem parte da definição de pronto aqui.

**Pronto quando:** verde, com o número justificado tarefa a tarefa.

---

#### T-1809 — Fechamento documental
**Tamanho:** PP

ESPEC e PLANO 024 marcados como implementados; este backlog com o status final e a **§6 — O que a
implementação ensinou**.

**Pronto quando:** os documentos refletem o que foi feito, incluindo o que saiu diferente.

---

## 6. O que a implementação ensinou

### 6.1 O plano não inventariou as âncoras de invariância do documento

**É o desvio desta entrega, e é de método.**

O PLANO 024 §2 definiu o portão `P1` como *"`test_docx_formatacao.py` e `test_docx_estrutura.py`
verdes sem alteração"*. Os dois ficaram verdes — e a suíte completa reprovou em
`test_capa.py::test_t1408`, que o plano não menciona em lugar nenhum.

A `T-1408` é uma âncora **total** do corpo do documento: contagem de `<w:t>` fora das caixas da
capa, contagem de códigos e `sha256` do conjunto. Ela existe desde a ESPEC 020 exatamente para
pegar *"edição acidental no corpo enquanto o arquivo está aberto"*.

O plano procurou as âncoras nos dois arquivos cujo **nome** fala de DOCX. A `T-1408` mora em
`test_capa.py` — nome que fala da capa, e cuja asserção mais forte é sobre tudo o que **não** é a
capa.

**Lição:** o inventário de âncoras se faz por **o que o teste afirma**, não por onde ele mora.
Uma varredura por `sha256`, por constante de contagem e por `assert len(` nos testes teria achado
em um minuto o que custou 18 minutos de suíte para aparecer.

O PLANO 021 fez isso certo — a `T-1507` captura as linhas do `.docx` **antes** de qualquer edição,
e a nota daquele plano diz por quê: *"é a diferença entre saber que o documento não mudou e
supor"*. O PLANO 024 conhecia esse precedente e mesmo assim procurou por nome de arquivo.

### 6.2 A âncora acertou, e o risco era reancorá-la errado

Vale separar duas coisas que se confundem com facilidade: **a reprovação da `T-1408` não é defeito
desta entrega.** A espec acrescenta texto ao corpo de propósito, e a âncora fez precisamente o
trabalho para o qual foi escrita.

O risco real estava no passo seguinte. Reancorar um `sha256` é, mecanicamente, colar a saída do
código dentro do teste — e um `sha256` só pode vir da saída, não há fonte externa de onde
transcrevê-lo. É o modo de falha que o PLANO 021 §1 nomeia: o teste passa a afirmar *"o código faz
o que o código faz"*.

A saída foi provar o **delta** em vez de aceitar o valor: desfazer apenas as duas mudanças
previstas e verificar que o hash antigo volta, caractere a caractere. A prova custou uma execução
de trinta segundos, e é o que distingue reancorar de apagar a linha vermelha.

`CORPO_DO_PILOTO_CODIGOS` permanecer em 79 é a confirmação independente, e de graça: se a entrega
tivesse mexido em linha de item por acidente, esse número teria mudado sozinho.

### 6.3 `R-NOT-01` fechou sem condicional, como o plano previu

O PLANO 024 §1 antecipou que o asterisco não precisaria de `if`: o chamador em
`docx_renderer.py:242` já só usa o título quando o bloco final existe. Confirmado — a `T-1804` é a
troca de uma cadeia de caracteres, e nada mais.

É a terceira vez que uma previsão dessa espécie se confirma (a `T-1533` do TASKS 021 e a `T-1710`
do TASKS 023 fecharam com zero linha). O padrão continua valendo: **verificar se a condicional já
existe antes de escrever a segunda.**

### 6.4 A célula mesclada exigiu uma correção no instrumento

O primeiro rascunho da `T-1800` lia o título juntando `"".join(c.text for c in row.cells)`, e a
faixa saiu com o texto **repetido cinco vezes** — `ooxml.mesclar_linha` faz todas as células da
fileira apontarem para o mesmo `<w:tc>`.

Não chegou a esconder defeito: o teste reprovava de qualquer modo, porque o asterisco não existia.
Mas teria continuado reprovando **depois** da implementação, e a causa aparente seria o produto.
Corrigido para ler a primeira célula, com o motivo no docstring.

### 6.5 O asterisco tinha uma ponta só — corrigido em 2026-08-19 `[defeito de espec]`

**O defeito mais barato de achar desta entrega passou por quatro artefatos sem ser visto.** A
frase de `R-NOT-02` foi escrita, na ESPEC v1.0 e no PLANO `T-2`, **sem o `*` inicial**. O plano
copiou o texto da espec, o teste copiou o texto do plano, e a implementação copiou o texto do
teste. Todos concordaram — e o documento saía com `DEMAIS ITENS DO LEVANTAMENTO*` no título e,
no rodapé, uma frase que nada identificava como a nota daquele asterisco.

Foi apontado por leitura humana da espec, não por teste. **E nenhum teste podia tê-lo pegado**:
todos os quatro afirmam contra a mesma cadeia de caracteres. A `T-1801` verificava que a frase
aparece; ela aparecia. O que faltava não era cobertura, era a frase estar certa.

Vale nomear a espécie: não é defeito de implementação — a implementação estava **fiel**. É
defeito de especificação, e a fidelidade da implementação é justamente o que o propaga sem
atrito. Uma regra que define uma cadeia literal é código escrito em português, e a revisão dela
tem de ser tão literal quanto a do código.

**O que teria pego.** `R-NOT-01` e `R-NOT-02` são uma regra só, partida em duas: um marcador e o
seu par. Escritas como duas linhas independentes de tabela, nada na espec obrigava a segunda a
mencionar a primeira. A v1.1 amarra as duas — a regra agora diz *por que* o `*` é obrigatório,
em vez de só exibi-lo dentro de uma cadeia onde o olho não o procura.

Três âncoras de invariância reprovaram, todas corretamente. O delta foi provado com o método da
§6.2 — desfazer só a mudança prevista e ver o valor antigo voltar:

| Âncora | Ancorado | Com o `*` | Retirar o `*` devolve o ancorado |
|---|---|---|---|
| `test_capa.py` · `CORPO_DO_PILOTO_SHA256` | `f549ca4c…` | `797165ea…` | sim |
| `PACOTE_DO_PILOTO` · `word/document.xml` | `30b67025…` | `84c4aadc…` | sim, byte a byte |
| `PACOTE_DO_PGM` · `word/document.xml` | `4e82a751…` | `b334b4cd…` | sim, byte a byte |

Um único dos 16.029 textos do corpo mudou; uma única entrada de cada pacote se moveu.

**As âncoras não foram trocadas, e isso é decisão, não pendência.** A ESPEC 028 `R-ZER-01`
começou a ser implementada na mesma árvore entre a medição e a troca, e move o documento de novo
— o `word/document.xml` do PGM mudou de novo em vinte minutos. As constantes ficam nos valores
anteriores às duas mudanças, vermelhas e comentadas no próprio teste; a reancoragem única cabe a
quem fechar a 028. O registro completo está na §9.10 do TASKS 026, que é onde o docstring de
`test_identidade_dos_artefatos.py` manda escrevê-lo.

---

## 7. O que este backlog não faz

- **Não muda quais códigos entram no bloco final.** `Contract.posicao_de` e `Contract.aplicar`
  ficam intactas; as regras da ESPEC 018 `D-06` e da ESPEC 022 `R-QTD-*` não são reabertas.
- **Não toca o XLSX de análise**, nem a API, nem o frontend.
- **Não corrige o manual**, que hoje não menciona o bloco final em linha nenhuma — `I-02` da
  espec, lacuna anterior a esta entrega.
- **Não implementa nota de rodapé nativa do Word.** `D-03` — é parágrafo de corpo, como o rodapé
  institucional já é.
- **Não acrescenta dependência.**