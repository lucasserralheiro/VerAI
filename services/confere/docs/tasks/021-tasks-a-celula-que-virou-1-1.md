# TASKS 021 — Backlog de "A célula que virou 1/1"

| | |
|---|---|
| **Especificação** | [ESPEC 021](../specs/021-a-celula-que-virou-1-1.md) v1.1 |
| **Plano** | [PLANO 021](../plans/021-plano-a-celula-que-virou-1-1.md) v1.1 |
| **Versão** | 1.0 — 2026-08-18 |
| **Total** | 38 tarefas · 7 portões · **4** insumos |
| **Status** | **Concluído com ressalva** — 2026-08-18. Portões `P0` a `P4` fechados; **`P5` aberto**: exige uma pessoa do faturamento, e é humano. Suíte de backend 522 → **537**; navegador 78/88, **sem falha nova**. Seis desvios em §11 |

> Escrito **antes** da implementação, como o TASKS 017, o 018 e o 020.

---

## 1. Convenções

**Identificadores** `T-15nn` seguem a numeração do PLANO 021, que começa em T-1500 porque a
implementação da ESPEC 020 fechou em T-1439.

**Definição de pronto — backend:** código e teste na mesma entrega; `ruff check`, `mypy src/` e
`bandit -ll -r src/` limpos; `pytest` verde; comentário explicando o *porquê* onde a escolha não
for óbvia.

**Definição de pronto — frontend:** `tsc --noEmit`, `next lint` e `next build` limpos; a suíte
Playwright verde; varredura `axe` sem violações A/AA nas duas larguras obrigatórias (1366 e 390).

**Convenção de commit** `<tipo>(T-15nn): descrição`.

### 1.1 Seis regras que atravessam o backlog

**1 — Os nove valores vêm da planilha, nunca da saída do código.** As 4 células do piloto e as 5
do PGM são a única verdade externa desta entrega. Escrever a asserção a partir do que a
implementação produziu transforma o teste em *"o código faz o que o código faz"* — e o `-` do
`14.046.00003.00`, que é o valor mais fácil de estragar sem querer, ficaria protegido por um teste
que copia o estrago.

**Exceção única e nomeada:** a âncora de invariância do documento (T-1507). Ela não afirma
correção, e sim que **nada se moveu** — e o documento de hoje já está certo e já é entregue.

**2 — Nada é removido antes de o substituto existir e ter sido visto.** `_avisar_perfil` sobrevive
aos épicos E2 e E3 inteiros. A T-1522 é a única tarefa que remove alguma coisa, e só entra com o
**P2 fechado**. A ordem inversa abre uma janela em que uma linha sai `1 / 1` sem que nada, em
parte alguma, diga isso — que é o silêncio que a ESPEC 018 §14.6 escreveu a validação para
impedir.

**3 — A tela não filtra por identificador de validação.** `D-02` decidiu que `V-REC-02` sai da
resposta; esconder na tela um achado que continua chegando é a traição barata dessa decisão, e
cabe numa linha.

O sinal no diff é literal: a cadeia `V-REC-02` aparecendo em qualquer arquivo `.tsx`.

**4 — O `1 / 1` não é escrito à mão em lugar nenhum.** É `R-REL-08`, regra de domínio, e vem da
`ReportLine` que a derivação constrói (`D-06`). Formatar no backend segue o precedente do
`LinhaDoGrid`, cujo comentário já registrou o motivo: *"deixar a formatação para o frontend
duplicaria a regra em duas linguagens"*.

O sinal no diff é um literal `"1"` ou `"1 / 1"` num componente ou num schema.

**5 — Texto de célula não se trata.** Nada de `para_decimal`, `or 0`, `|| "—"`, `parseFloat`,
`.trim()` adicional ou substituição de vazio. O que o leitor entregou é o que a tela mostra
(`R-PER-02`, emendada pela T-1502).

É o defeito mais provável desta entrega **porque parece acabamento**: um `-` sozinho numa coluna
parece erro de renderização para quem não leu a espec.

**6 — Campo novo em dataclass entra por último e com padrão.** `ReportResult` é construído em
**dois** pontos de `executar`, e um deles é o retorno antecipado do caminho bloqueado, antes do
laço. `derivadas` entra no fim, com `= ()`. Mesma regra do TASKS 020, mesmo motivo.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Fase |
|---|---|---|---|
| **E0** O oráculo, escrito à mão | T-1500 … T-1502 | **P0** | F0 |
| **E1** Os instrumentos, e o da tela reprova | T-1503 … T-1507 | **P1** | F1 |
| **E2** `linhas_derivadas` existe, e `V-REC-02` continua | T-1508 … T-1514 | — | F2 · **publicável** |
| **E3** A tabela na tela, com as frases ainda lá | T-1515 … T-1521 | **P2** | F3 · **publicável** |
| **E4** A frase some | T-1522 … T-1529 | **P3**, **P4** | F4 |
| **E5** O manual, a pessoa e o conjunto | T-1530 … T-1537 | **P5**, **P6** | F5 |

**Numeração dos portões:** este backlog usa os do PLANO 021 (`P0`–`P6`). A ESPEC 021 §8.5 tem os
seus dois: o `P1` **da espec** é o `P5` daqui; o `P2` da espec é o `P2` daqui.

### 2.1 Pontos de não retorno

**T-1509 é o primeiro toque em `src/`.** Tudo antes dela é instrumento e pode ser descartado sem
custo nenhum.

**T-1522 é irreversível na prática.** Ela remove a única representação que hoje existe. Depois
dela, o confronto entre tabela e frases — que é o portão P2 — exige `git stash`, e ninguém o faz.
**Não entra sem o P2 fechado.**

**T-1525 destrói uma contraprova se for feita no automático.** O teste do
`test_consolidacao_aditivos.py:380` prova que **`V-REC-01` calou porque o aditivo o explica**, e
os cinco `V-REC-02` eram o canário que sustentava a distinção. Trocado por `avisos == []` e mais
nada, o teste fica verde e sem sentido: passaria também num pipeline que não registrasse achado
algum.

**T-1530 e T-1531 tocam o manual**, que sai para o usuário. A linha do `V-REC-02` muda; nada mais
muda, e a T-1531 é quem prova.

### 2.2 A régua da entrega — o que pode mudar de comportamento

| Muda | Não muda |
|---|---|
| A resposta da API ganha `linhas_derivadas` | `RespostaBloqueada` — o caminho bloqueado nunca teve `V-REC-02` |
| `V-REC-02` deixa de sair em `avisos` — **4** asserções | As **demais** asserções sobre `avisos`, que chamam a validação direto (§5.2 do PLANO) |
| A tela ganha a tabela e perde 4 ou 5 frases amarelas | O grid de divergências e o painel de análise |
| O contador de avisos: PGM **10 → 5**, piloto **4 → 0** | Totais: 58 / 37 / 4 no piloto, 58 / 27 / 13 no PGM |
| Uma linha da tabela de validações do manual | O resto do manual — é o `I-22`, e é maior que esta entrega |
| `ReportResult` ganha um campo com padrão | O `.docx` e o `.xlsx`, no conteúdo |

---

## 3. Épico E0 — O oráculo, escrito à mão `[portão P0]`

> **Nenhum arquivo de `src/` é tocado neste épico.**

#### T-1500 — Transcrever as nove células
**Tamanho:** PP · **Ref:** ESPEC 021 §2.2

Arquivo novo — `backend/tests/test_linhas_derivadas.py`. Uma constante com as **nove** linhas
derivadas dos dois pares: par, número da linha na aba, código, descrição, quantidade contratada e
quantidade medida.

**Lidas abrindo as duas planilhas**, não rodando o leitor. São 4 em `levantamento.xlsx` (linhas
88, 89, 98, 114) e 5 em `levantamento_pgm.xlsx` (72, 73, 74, 83, 105).

As descrições têm acentuação e parênteses — `PERFIL IV(D)`, `INTERMEDIÁRIA (MIDDLEWARE)` — e
transcrevê-las à mão erra. **Errar aqui é o comportamento previsto**: é a T-1501 que separa dedo
errado de leitor errado, e é por isso que ela vem em seguida.

**Pronto quando:** a constante existe, com comentário dizendo que é a **fonte única** das
asserções de conteúdo deste backlog e que não pode ser regenerada a partir do código.

---

#### T-1501 — A transcrição casa o que o leitor lê `[portão P0]`
**Tamanho:** PP · **Ref:** PLANO 021 §3 · **Portão P0**

Rodar **só o `LevantamentoReader`** sobre as duas fixtures e comparar, para cada item com
`medida is None`, os cinco campos contra a constante da T-1500. Sem relatório, sem container, sem
API.

Comparar os **cinco** campos, não só os códigos: o valor que esta entrega existe para exibir é
justamente o texto das duas quantidades, e um teste que confira só o código passaria com as
colunas trocadas.

Se reprovar, há duas hipóteses com consequências opostas: erro de transcrição (barato, corrige-se
a constante) ou o leitor entregando outra coisa (caro, muda a espec). **Descobrir aqui custa dez
minutos.**

**Pronto quando:** verde, e a mensagem de falha mostra o par e o campo divergente — não só
*"assert False"*.

---

#### T-1502 — Emendar `R-PER-02`
**Tamanho:** PP · **Ref:** PLANO 021 §6

`R-PER-02` diz *"texto **bruto** da célula"*. O que existe é o texto **normalizado na leitura**
por `_texto()`: strings chegam com `strip()`, números chegam em pt-BR (o inteiro `1` da linha 83
vira `"1"`; um `1.0` viria `"1,0"`), datas chegam `dd/mm/aaaa`.

Para as nove células não muda nada — cinco cadeias e quatro inteiros. A emenda existe para impedir
a leitura literal: quem ler *"bruto"* pode concluir que precisa **abrir a planilha outra vez**, e
uma segunda leitura do arquivo é uma segunda chance de divergir da primeira.

Redação:

> As duas quantidades são exibidas **como o leitor as entrega** — sem conversão a número, sem
> normalização adicional e sem vazio virando zero. `-`, `F`, `PACOTE` e `2` saem como estão.

**Pronto quando:** a ESPEC 021 traz a redação nova, e nenhum outro ponto dela ou do plano ainda
instrui a reler o arquivo.

---

## 4. Épico E1 — Os instrumentos, e o da tela reprova `[portão P1]`

> **Nenhum arquivo de `src/` nem de `frontend/src/` é tocado neste épico.** O instrumento nasce
> antes do alvo — regra que a ESPEC 017 estabeleceu e a 019 e a 020 confirmaram.

#### T-1503 — As asserções de conteúdo
**Tamanho:** P · **Ref:** ESPEC 021 §8.1

Em `test_linhas_derivadas.py`, contra o oráculo da T-1500 e passando pelo container:

| Afirmação | Piloto | PGM |
|---|---|---|
| quantidade de linhas derivadas | 4 | 5 |
| números de linha, em ordem ascendente | 88, 89, 98, 114 | 72, 73, 74, 83, 105 |
| textos das duas quantidades | conforme T-1500 | conforme T-1500 |
| quantidades emitidas | `1` e `1` | `1` e `1` |
| descrição contém o perfil | `PERFIL IV(D)` no `14.048.00008.00` | — |

A asserção da descrição verifica o **sufixo**, não o prefixo: a do contrato termina em `PERFIL` e
a da aba continua com a letra (ESPEC §2.4). Um teste de prefixo passaria com a fonte errada.

**Estas asserções ficam vermelhas por campo inexistente. É TDD comum, não portão** — e o plano diz
isso em vez de vestir de instrumento o que é ordem de escrita. Registre no docstring que o
vermelho é esperado até a T-1511.

**Pronto quando:** existem, reprovam por `linhas_derivadas` não existir, e o docstring diz até
quando.

---

#### T-1504 — O `-` chega como `-`
**Tamanho:** PP · **Ref:** `R-PER-02`, `D-03`

`14.046.00003.00` do PGM: `contratada_texto == "-"`. **Não** `""`, **não** `"0"`, **não** `None`.

Tarefa própria, e não uma linha dentro da T-1503, porque é a asserção que trava a regra 5 de
§1.1 — o defeito mais provável desta entrega. Um hífen sozinho numa coluna parece erro de
renderização para quem não leu a espec, e a "correção" natural é normalizá-lo.

As três negativas são explícitas de propósito: `assert x == "-"` já falharia, mas a mensagem não
diria **em que direção** o valor foi estragado.

**Pronto quando:** existe, com comentário citando a ESPEC §2.3 — a célula contém o traço porque
alguém o digitou.

---

#### T-1505 — Invariante de acoplamento
**Tamanho:** PP · **Ref:** `R-PER-01`

Nos dois pares: o número de linhas derivadas é igual ao de `perfil_ou_pacote` no relatório.
Nenhuma linha `1 / 1` fora da tabela; nenhuma entrada da tabela sem linha `1 / 1`.

Parece impossível divergir — as duas coleções nascem no mesmo `if`. Divergem no dia em que
alguém acrescentar um segundo caminho de derivação e esquecer de acumular, e o sintoma seria
exatamente o silêncio que esta espec existe para acabar.

**Pronto quando:** existe, parametrizado pelos dois pares.

---

#### T-1506 — Ver a tela reprovar `[portão P1]`
**Tamanho:** P · **Ref:** `R-PER-08` · **Portão P1**

Arquivo novo — `frontend/e2e/derivadas.spec.ts`. Com o par piloto gerado, a cadeia `V-REC-02`
**não ocorre em lugar nenhum da tela**.

A asserção é sobre o **texto da página inteira**, não sobre um bloco: o objetivo de origem é que
a sigla desapareça, e amarrá-la ao seletor do bloco amarelo faria o teste passar no dia em que
alguém a movesse para outro canto.

**Rodar contra o código intocado e exigir que reprove**, acusando as **4** ocorrências do piloto.
Este é o único instrumento deste backlog que mede o defeito; todos os outros medem a correção.

**Pronto quando:** reprova, e a mensagem de falha mostra o trecho de texto encontrado.

---

#### T-1507 — Âncora de invariância do documento
**Tamanho:** P · **Ref:** `R-PER-11` · **Portão P4**

Capturar hoje, com `tests/leitura_relatorio.py::ler_docx`, as linhas do `.docx` gerado para os
**dois** pares, e guardá-las como referência versionada. Passa desde já e tem de continuar
passando.

**Vai no arquivo novo, e não em `test_docx_estrutura.py`** — o P4 exige aquele arquivo *sem uma
linha alterada*, e acrescentar um teste nele o alteraria.

**Esta é a única captura da saída do código sancionada neste backlog**, e a razão está na §1.1
regra 1: ela não afirma que o documento está certo, e sim que **não se moveu**. O documento de
hoje já é entregue ao órgão; o que precisa de proteção é a ausência de mudança, e a E2 abre
justamente o arquivo que o monta.

**Pronto quando:** a referência está versionada, o teste passa nos dois pares, e o comentário
explica por que capturar a saída é legítimo **aqui e só aqui**.

---

## 5. Épico E2 — `linhas_derivadas` existe, e `V-REC-02` continua

> **Nada é removido neste épico.** Ao final dele a tela está **idêntica** e a API carrega o dado
> estruturado: se o trabalho parar aqui, nada regrediu e alguma coisa melhorou.

#### T-1508 — `LinhaDerivada` no domínio
**Tamanho:** PP · **Ref:** ESPEC 021 §7

Em `domain/entities/report.py`, ao lado de `ReportLine`, `frozen=True`:

```
linha_na_aba: int
codigo: str
descricao: str          # a da aba (D-01)
contratada_texto: str
medida_texto: str
emitida: ReportLine     # D-06 — o 1/1 vem daqui, não de um literal
```

Mora em `report.py` por ser objeto de relatório, e **não** entra no agregado `Report`: o `Report` é
o documento, e isto é auxílio de conferência. Quem o carrega é o `ReportResult` (T-1510).

**Pronto quando:** existe, com comentário dizendo que `descricao` é a da aba **de propósito**, e
apontando para `D-01`.

---

#### T-1509 — Acumular no caso de uso
**Tamanho:** P · **Ref:** `R-PER-05`, `D-01`, `D-04`

Em `_montar_linha`, no ramo `item.medida is None`: construir a `ReportLine` numa variável,
acumular a `LinhaDerivada` e devolvê-la. `derivadas` entra como acumulador mutável, no mesmo
padrão que `achados` já usa.

> **A armadilha é a descrição.** Duas linhas acima, o mesmo ramo chama
> `self._descricao(item, contrato)` — que devolve a **contratual**, e é o que o resto do
> relatório usa. Aqui é `item.descricao`, a da aba. Reaproveitar o método por parecer o mesmo
> dado produz uma tabela cuja finalidade é levar alguém à planilha e que não fala a língua dela —
> e, no `14.048.00008.00`, a descrição contratual **termina antes da letra do perfil**.

**Nenhum `sorted()`.** O laço de `executar` percorre `medicao.codigos_em_ordem`, que já é a ordem
da aba; a ordenação por posição do contrato acontece depois, e só sobre `relatorio.linhas`. Uma
ordenação acrescentada por zelo produziria a mesma sequência nos dois pares medidos e esconderia
a dependência até o dia em que ela deixasse de valer.

**Pronto quando:** T-1503 e T-1505 ficam verdes; o diff não tem `sorted` nem chamada a
`_descricao` no ramo derivado.

---

#### T-1510 — `ReportResult.derivadas`
**Tamanho:** PP · **Ref:** §1.1 regra 6

`derivadas: tuple[LinhaDerivada, ...] = ()`, por último e com padrão.

O padrão não é estilo: `executar` devolve `ReportResult(relatorio=None, achados=achados)` **antes
do laço** quando há bloqueante. Sem o padrão, esse retorno deixa de compilar, e a correção
apressada seria passar `()` ali à mão — mesmo resultado com uma chance a mais de esquecer no
próximo ponto de construção.

**Pronto quando:** `mypy` limpo e o caminho bloqueado continua verde sem alteração.

---

#### T-1511 — O contrato da API
**Tamanho:** P · **Ref:** ESPEC 021 §7

Em `api/schemas.py`, `LinhaDerivada` (Pydantic) e `linhas_derivadas: list[LinhaDerivada]` em
`RespostaRelatorio`.

Campos: `linha`, `codigo`, `descricao`, `contratada`, `medida` — os dois últimos **como o leitor
os entregou** — e `saiu: str`, com o `1 / 1` já montado.

`saiu` é uma cadeia só, e não dois campos, pelo mesmo motivo que `LinhaDoGrid` já traz as
quantidades formatadas: a junção ` / ` é decisão sobre um fato de domínio, e reparti-la entre
backend e componente a colocaria em duas linguagens.

**`RespostaBloqueada` não muda.** O laço que deriva linhas roda **depois** do
`if achados.bloqueado`, então o caminho bloqueado nunca teve `V-REC-02` e não terá linha derivada.

**Pronto quando:** o schema existe, com `description` nos campos crus dizendo que não são
normalizados.

---

#### T-1512 — A conversão no router
**Tamanho:** PP · **Ref:** `D-06`

Uma função ao lado de `_linha`, em `api/routers/reports.py`. As quantidades emitidas saem de
`origem.emitida.contratada.formatar()` e `…medida.formatar()`.

**Nenhum literal `"1"`.** É a regra 4 de §1.1: escrever o `1` aqui é repetir `R-REL-08` num
segundo lugar, e no dia em que a regra mudar a tela mentirá sem que nada acuse.

**Pronto quando:** o campo aparece na resposta dos dois pares, e não há literal `1` na função.

---

#### T-1513 — `_avisar_perfil` fica
**Tamanho:** PP · **Ref:** §1.1 regra 2

Estado intermediário deliberado: o mesmo fato viaja nas duas formas, e a tela continua exibindo
as frases.

É o que torna este épico publicável sozinho — e é o que permite o confronto do P2, que só existe
enquanto as duas representações coexistem.

**Pronto quando:** o diff deste épico **não contém remoção alguma**.

---

#### T-1514 — As quatro asserções continuam verdes `[risco]`
**Tamanho:** PP · **Ref:** PLANO 021 §5.1

`test_api_e2e.py:244` e `:263`, `test_consolidacao_aditivos.py:380` e `:459` passam **sem uma
linha alterada**.

É a prova negativa deste épico: se alguma delas precisou mudar aqui, algo foi removido antes da
hora e a regra 2 de §1.1 foi quebrada.

**Pronto quando:** as quatro verdes, e o diff do épico não as toca.

---

## 6. Épico E3 — A tabela na tela, com as frases ainda lá `[portão P2]`

> Ao final deste épico o problema de origem está resolvido. A sobra amarela **incomoda e não
> engana** — e é ela que torna o P2 possível.

#### T-1515 — O tipo espelho
**Tamanho:** PP · **Ref:** ESPEC 021 §7

`LinhaDerivada` em `frontend/src/lib/types.ts` e o campo em `RespostaRelatorio`.

Os dublês de `e2e/estados.ts:47` e `e2e/anuncio.spec.ts:79` são `RespostaBloqueada` e **não
precisam do campo**. O de `situacaoVazia` parte da resposta real e o recebe de graça.

**Pronto quando:** `tsc --noEmit` limpo sem tocar em nenhum dublê.

---

#### T-1516 — `LinhasDerivadas.tsx`
**Tamanho:** P · **Ref:** `R-PER-01`, `R-PER-03`, `R-PER-04`, `R-PER-06`, `R-PER-12`

Componente novo. Colunas, nesta ordem: **Linha**, **Código**, **Descrição**, **Quantidade
Contratada**, **Quantidade Medida**, **Saiu no relatório**.

Herda do `DivergenciaGrid` o que ele já resolveu: contêiner com `overflow-x-auto` e `tabIndex={0}`
(`R-ACE-05`), cabeçalhos com `scope="col"`, e o tratamento de descrição longa — o
`14.071.00007.00` tem 148 caracteres.

As duas colunas de célula crua saem em fonte monoespaçada: é o que faz `-` e `PACOTE` lerem como
**conteúdo de célula** e não como falha de renderização. A distinção não pode depender só disso —
`R-ACE-02` — e por isso o cabeçalho já nomeia as colunas, e a frase da T-1517 explica.

**Pronto quando:** renderiza os dois pares; nada é comunicado só por cor; `axe` limpo (T-1533).

---

#### T-1517 — A frase
**Tamanho:** PP · **Ref:** `R-PER-07`

Uma frase acima da tabela, dizendo o que aconteceu e o que fazer. **Sem sigla de validação, sem
"medida não numérica", sem "derivação".**

> **Não pode conter a cadeia "relatório gerado".** Pela emenda §14.4 da ESPEC 015, `getByText`
> casa por substring e sem diferenciar maiúsculas, e `estados.ts` e `smoke.spec.ts` esperam
> `getByText("Relatório gerado")`. Qualquer texto novo com essa sequência derruba **sete suítes**
> com *"strict mode violation"* — mensagem que não diz nada sobre a causa.

**Pronto quando:** a frase existe, não contém a cadeia proibida, e nenhuma suíte existente mudou
de comportamento.

---

#### T-1518 — Entrada no `ResultadoPanel`
**Tamanho:** PP · **Ref:** `D-07`

Depois do `DivergenciaGrid` e **acima** do bloco amarelo, que continua.

Acima, e não abaixo: nesta fase há dois blocos dizendo o mesmo, e o que fica por último parece
ressalva do primeiro. Como o amarelo é o que vai sumir, ele é que fica embaixo — assim a tela da
E3 já é, de cima para baixo, a tela da E4 mais uma sobra.

**Pronto quando:** a ordem é grid → tabela → bloco amarelo, nos dois pares.

---

#### T-1519 — Sem linha derivada, sem tabela
**Tamanho:** PP · **Ref:** `R-PER-10`

Nenhuma tabela vazia, nenhuma seção dizendo *"nenhum item"*. O caso normal é não haver nada a
mostrar, e uma seção permanente treina a pessoa a ignorá-la.

Verificado com o dublê de `situacaoVazia`, que parte da resposta real.

**Pronto quando:** com `linhas_derivadas` vazio, nada da tabela aparece no DOM.

---

#### T-1520 — O confronto lado a lado `[portão P2]`
**Tamanho:** PP · **Ref:** PLANO 021 §2 · **Portão P2**

Com a tela dos **dois** pares aberta e o bloco amarelo ainda presente: para cada frase, existe uma
linha da tabela com o mesmo código e o mesmo texto de célula. **Nenhuma frase sem linha.**

Conferência humana, cinco minutos, e é a única janela em que ela é possível: depois da T-1522 a
comparação exige `git stash`.

**Pronto quando:** 4 frases × 4 linhas no piloto e 5 × 5 no PGM, conferidas e registradas em §11.

---

#### T-1521 — O `D` × `C` aparece `[portão P2]`
**Tamanho:** PP · **Ref:** ESPEC 021 §2.3, `P2` · **Portão P2**

No piloto, a linha do `14.048.00008.00` mostra **`D`** em *Quantidade Contratada* e **`C`** em
*Quantidade Medida*.

É o banco de dados contratado no perfil IV(D) e medido no III(C): a perda de informação que a
ESPEC 001 §9.3 declarou e aceitou, que a `R-PAN-06` transformou em ressalva e que **nunca esteve
na tela**. Vinte especs depois, é aqui que ela aparece.

Se a tabela não mostrar isso, ela não é melhor que a frase — e a entrega não se justifica.

**Pronto quando:** visto na tela e registrado em §11.

---

## 7. Épico E4 — A frase some `[portões P3 e P4]`

> **Só começa com o P2 fechado** (T-1520 e T-1521).

#### T-1522 — Remover `_avisar_perfil`
**Tamanho:** PP · **Ref:** `R-PER-08`, `D-02`

O método e a chamada saem. `V-REC-02` deixa de ser emitida.

O identificador continua existindo nas especs e no manual como registro histórico; o que sai é a
emissão. É a mesma forma da `R-REL-13` da ESPEC 018 com a `V-CTR-04`, com um argumento a mais: a
informação não é descartada, é promovida.

**Pronto quando:** `V-REC-02` não aparece em `achados.avisos` em nenhum dos dois pares; no piloto,
`avisos == []`.

---

#### T-1523 — `test_api_e2e.py:244`
**Tamanho:** PP · **Ref:** PLANO 021 §5.1

De `{a["validacao"] …} == {"V-REC-02"}` para `avisos == []` **e**
`len(corpo["linhas_derivadas"]) == 5`.

O que o teste prova continua o mesmo: `D-08` da ESPEC 019 — o aditivo explica e cala os cinco
`V-REC-01`. O comentário existente (*"os cinco avisos de quantidade que o aditivo explica não
saem"*) permanece válido e não deve ser apagado junto.

**Pronto quando:** verde, com as duas asserções.

---

#### T-1524 — `test_api_e2e.py:263`
**Tamanho:** PP · **Ref:** PLANO 021 §5.1

De `{"V-REC-01", "V-REC-02"}` para `{"V-REC-01"}` **e** `len(corpo["linhas_derivadas"]) == 5`.

Prova a `D-10`: sem aditivo, o caminho é o de antes.

**Pronto quando:** verde, com as duas asserções.

---

#### T-1525 — `test_consolidacao_aditivos.py:380` `[risco]`
**Tamanho:** P · **Ref:** PLANO 021 §5.2 · **§2.1**

De `count("V-REC-02") == 5` e `len(validacoes) == 5` para `avisos == []` **e**
`len(derivadas) == 5`.

> **A segunda asserção não é redundância.** Este teste prova que **`V-REC-01` calou porque o
> aditivo o explica** — não porque o pipeline emudeceu —, e os cinco `V-REC-02` eram o canário
> que sustentava a distinção. `avisos == []` sozinho ficaria verde também num pipeline que não
> registrasse achado nenhum, e a `D-08` da ESPEC 019 perderia a prova que a acompanha.
>
> `len(derivadas) == 5` é o canário no galho novo.

O teste vizinho — *"sem o aditivo, os cinco avisos voltam"* — filtra por `V-REC-01` e **não muda**.
Conferir isso é parte da tarefa: se ele precisar mudar, a remoção alcançou o que não devia.

**Pronto quando:** verde com as duas asserções, e o docstring diz por que a segunda existe.

---

#### T-1526 — `test_consolidacao_aditivos.py:459`
**Tamanho:** PP · **Ref:** PLANO 021 §5.1

De `== ["V-REC-02"] * 4` para `avisos == []` **e** `len(derivadas) == 4`.

**Pronto quando:** verde, com as duas asserções.

---

#### T-1527 — O bloco amarelo sai da tela
**Tamanho:** PP · **Ref:** `D-02`, §1.1 regra 3

A chamada a `ListaDeAchados` com `relatorio.avisos` continua existindo — ela apenas deixa de
receber `V-REC-02`, porque ele não vem mais. Com o PGM ela ainda mostra os 5 `V-REC-01`; com o
piloto, nada, e `ListaDeAchados` já devolve `null` para lista vazia.

**`ListaDeAchados` não é alterada.** Se o diff desta tarefa contiver a cadeia `V-REC-02` em
qualquer `.tsx`, a regra 3 de §1.1 foi quebrada.

**Pronto quando:** T-1506 fica **verde**; `ListaDeAchados` intacta; nenhum `.tsx` menciona a sigla.

---

#### T-1528 — O contador da faixa
**Tamanho:** PP · **Ref:** `R-PER-09`

`N aviso(s) registrado(s)` passa a contar o que é exibido: PGM de 10 para 5, piloto de 4 para
nenhum — e no piloto o trecho some.

É a mudança visível mais brusca da entrega. Se a tabela não estiver claramente no lugar, a tela
**parecerá ter perdido informação** — e é o que o P5 mede.

**Pronto quando:** os dois pares conferidos na tela.

---

#### T-1529 — Verificar P3 e P4 `[portões P3 e P4]`
**Tamanho:** PP · **Portões P3 e P4**

| Portão | Critério |
|---|---|
| **P3** | `V-REC-02` fora de `avisos`; T-1506 verde; as quatro asserções **reancoradas**, não apagadas |
| **P4** | T-1507 verde nos dois pares; `test_docx_estrutura.py` e `test_docx_formatacao.py` verdes **sem uma linha alterada**; `analise_referencia.xlsx` intacto |

Conferir também o painel de análise: `perfis_ou_pacotes` continua **4** no piloto e **5** no PGM, e
a ressalva `R-PAN-06` continua exibida. Ela não muda — só passa a ter para onde apontar.

**Pronto quando:** os dois portões fechados, com `git diff --stat` mostrando os arquivos de docx
com zero linhas.

---

## 8. Épico E5 — O manual, a pessoa e o conjunto `[portões P5 e P6]`

#### T-1530 — A linha do `V-REC-02` no manual
**Tamanho:** PP · **Ref:** ESPEC 021 §2.6

`scripts/conteudo_do_manual.py`, tabela de validações. Hoje diz *"Quantidade não numérica em item
**que não é de perfil**"* e *"A linha sai **zerada**"*. As duas afirmações estão erradas desde a
ESPEC 018: hoje toda linha não numérica é derivada **como** perfil e sai `1 / 1`.

Redação nova: o que verifica, o efeito (`1 / 1`) e o que fazer — conferir a célula na linha
indicada da aba `Levantamento`.

**Só esta linha.** As outras quatro validações inexistentes e as sete ausentes são o `I-22`, e são
maiores que esta entrega.

**Pronto quando:** a linha está correta e nenhuma outra foi tocada.

---

#### T-1531 — Regenerar o manual
**Tamanho:** PP · **Ref:** ESPEC 021 §2.6

Gerar o `Manual_de_Utilizacao_Confere.docx` e conferir que **só** a linha da T-1530 mudou.

O manual sai para o usuário. Uma regeneração que mexa em paginação ou em outra tabela é desvio, e
tem de ser vista agora.

**Pronto quando:** o diff visual é uma linha.

---

#### T-1532 — A pessoa do faturamento `[portão P5]`
**Tamanho:** P · **Ref:** `K-23` · **Portão P5**

A tela e as duas planilhas nas mãos de alguém que **não participou desta espec** e nunca ouviu
falar de `V-REC-02`. Sem explicação prévia.

**Registrar onde a pessoa hesitou, e não se ela conseguiu.** *"Conseguiu"* é resposta binária e
sempre otimista — quem está sendo observado se esforça. A hesitação diz qual coluna não estava
clara, e é o insumo que corrige a frase da T-1517 **antes** de o manual sair.

Falhar aqui não é falha de código: é redação da frase ou escolha de colunas. Corrigir e repetir.

**Pronto quando:** feito com uma pessoa, e o que ela hesitou está em §11.

---

#### T-1533 — `axe` com a tabela na tela `[portão P6]`
**Tamanho:** PP · **Ref:** `R-PER-12` · **Portão P6**

Sem violações A/AA nas duas larguras que a ESPEC 008 §14.3 tornou obrigatórias — 1366 e 390.

A 390 px a tabela transborda, como a do grid: sem o `tabIndex` do contêiner, as colunas da direita
ficam inalcançáveis para quem não usa mouse (`R-ACE-05`). O custo é uma parada de tabulação a
mais, e só quando há linha derivada.

**Pronto quando:** varredura limpa nas duas larguras, e o percurso de teclado da ESPEC 008 §6
continua verde.

---

#### T-1534 — As duas suítes `[portão P6]`
**Tamanho:** PP · **Portão P6**

Backend verde, com a contagem reconciliada contra os **522** iniciais mais os novos. Navegador
verde, contra os **84** iniciais mais os novos.

**Verde não basta: o número tem de bater.** Um arquivo que deixou de ser coletado fica verde.

**Pronto quando:** as duas contagens explicadas tarefa a tarefa.

---

#### T-1535 — Ferramentas `[portão P6]`
**Tamanho:** PP · **Portão P6**

`ruff check`, `mypy src/`, `bandit -ll -r src/`, `tsc --noEmit`, `next lint` e `next build`
limpos.

---

#### T-1536 — Fechar a documentação
**Tamanho:** PP

ESPEC 021 → **Implementada**, com as emendas de execução e o acerto de `R-PER-02` (T-1502).

---

#### T-1537 — CHANGELOG e este backlog
**Tamanho:** PP

CHANGELOG com o resultado; §11 deste arquivo com os desvios, o que a T-1532 observou e a resposta
ao `I-21` se o P5 a produzir.

---

## 9. Insumos

| ID | Insumo | Para quê | Quando |
|---|---|---|---|
| `K-23` | **Uma pessoa do faturamento** que não participou desta espec, com meia hora e os dois pares de arquivos | **P5** | T-1532 |
| `K-24` | Resposta ao `I-21`: depois do P5, se a tabela na tela basta ou se as linhas derivadas precisam de aba no XLSX de análise | `I-21` | T-1537 |
| `K-25` | Decisão sobre o `I-22` — a auditoria do manual. **Não bloqueia este backlog**, e deveria ser decidida antes da próxima entrega ao usuário | `I-22` | depois |
| `K-26` | **Reancorar a suíte de navegador** — 10 falhas medidas, todas anteriores a esta entrega (§11.6). Inclui uma decisão de produto: o item sem cobertura contratual deve aparecer uma vez ou duas? | §11.6 | trabalho próprio |

---

## 10. O que este backlog não faz

- **Não muda o `.docx` nem o `.xlsx`.** `R-PER-11`, e a T-1507 é a asserção que sustenta a frase.
- **Não reabre `R-REL-08`.** A derivação continua idêntica; muda o que se conta sobre ela.
- **Não cria validação nova.** A comparação `D` × `C` é o `I-23`, e o `I-24` mostra por que não é
  trivial: `PACOTE` × `1` não é comparável e `F` × `F` é igualdade de letra, não prova de perfil
  correto.
- **Não audita o manual.** Corrige a linha do `V-REC-02` e para aí (`K-25`).
- **Não toca o painel de análise**, nem o grid de divergências, nem o rodapé, nem a capa.
- **Não acrescenta dependência**, no backend nem no frontend. A tabela é HTML, e o
  `DivergenciaGrid` já resolveu rolagem e foco.

---

## 11. O que a implementação ensinou

### 11.1 O oráculo passou de primeira, e isso não era o esperado

A T-1501 previa reprovar por erro de transcrição — nove linhas com `PERFIL IV(D)`,
`INTERMEDIÁRIA (MIDDLEWARE)` e acentuação em toda descrição. Passou no primeiro `pytest`, nos
cinco campos dos dois pares.

O que a T-1502 encontrou, e que a passagem limpa **confirmou** em vez de contradizer: para estas
nove células, `_texto()` é a identidade sobre o que o Excel mostra. Os quatro inteiros (`2` e três
`1`) chegam `"2"` e `"1"` porque `str(2)` não tem ponto a trocar por vírgula. A emenda de
`R-PER-02` continua necessária — ela protege o caso que **ainda não apareceu**, o `1.0` que
chegaria `"1,0"`.

### 11.2 A `T-1533` já estava feita, por um instrumento que existia

O backlog previu varredura `axe` própria em `derivadas.spec.ts`. Escrita, ela **passou contra o
código intocado** — antes de a tabela existir. Não estava medindo a tabela.

O `a11y-axe.spec.ts` varre `ESTADOS` inteiro, e `pronto` está entre eles, nas duas larguras: a
tabela entra na varredura de graça, e com mensagem de falha melhor — aquele arquivo monta um
resumo por violação, com impacto e contagem de nós. As duas asserções foram **removidas**, e a
T-1533 passou a ser verificação de que a varredura existente continua limpa.

Fica a regra: **um instrumento que passa antes de o alvo existir não é instrumento.** É o mesmo
critério da T-1506, aplicado ao contrário.

### 11.3 A `T-1530` removeu a linha do manual em vez de corrigi-la

O backlog dizia *"a linha do `V-REC-02` deixa de dizer 'item que não é de perfil' e 'a linha sai
zerada'"*. Corrigir o texto teria produzido um **terceiro** erro: a `R-PER-08` tirou a `V-REC-02`
da lista de achados, e descrever como validação o que já não é validação mandaria o leitor
procurar na tela um aviso âmbar que não existe mais.

A linha saiu da tabela de validações (que passou de "as dez" para "as"), e o comportamento ganhou
seção própria — §8.3 do manual —, onde ele se manifesta. A §8.3 anterior virou §8.4.

Verificado por diferença textual entre o `.docx` anterior e o novo: **251 → 254 parágrafos**, e as
únicas mudanças são as quatro previstas. Nenhuma outra linha do manual se moveu.

### 11.4 O confronto do `P2` virou script, e mediu os dois pares

A T-1520 previa conferência humana de cinco minutos. Feita como script, ela cobre os **dois**
pares em vez do piloto que a tela mostra, e a saída registra o que a tabela **acrescenta** a cada
frase:

```
piloto: 4 frases × 4 linhas   PGM: 5 frases × 5 linhas
   OK 14.048.00008.00 frase diz 'C'  | tabela acrescenta: linha 88, contratada 'D'
   OK 14.025.00011.00 frase diz '2'… | tabela acrescenta: linha 98, contratada '2'
   OK 14.046.00003.00 frase diz 'A'  | tabela acrescenta: linha 73, contratada '-'
   frases sem linha: nenhuma | linhas sem frase: nenhuma
```

A coluna da direita é o argumento da espec inteira, medido: cada frase perdia o endereço da célula
e a quantidade contratada.

### 11.5 A `T-1527` e a `T-1528` não custaram uma linha

As duas previam mexer no `ResultadoPanel`. Com a `V-REC-02` fora de `avisos`, o bloco âmbar
simplesmente deixa de receber conteúdo no piloto — `ListaDeAchados` já devolve `null` para lista
vazia — e o contador da faixa já contava `relatorio.avisos.length`, que é o que é exibido.

**Nenhum código foi escrito para cumprir as duas regras.** É o sinal de que a `D-02` estava certa:
tirar o achado da resposta, em vez de filtrá-lo na tela, fez a tela se corrigir sozinha.

### 11.6 O que este backlog encontrou e não é dele

A suíte de navegador estava **vermelha antes de qualquer linha desta entrega**: 74 de 84,
**10 falhas**, medidas contra o código intocado. Todas rastreiam para trabalho não commitado das
ESPECs 018 e 019:

| Causa | Testes | Natureza |
|---|---|---|
| 3º campo de upload (Aditivos, ESPEC 019) | `a11y-estrutura:102`, `a11y-teclado:67`, `limpar:97`, `limpar:246` | expectativa enumera 2 campos; existem 3 |
| Contagens (ESPEC 018) | `analise:17`, `:46`, `:127`, `:146`, `smoke:22` | 19→21, 56→58, 36/55→37/58 |
| Colisão de desenho | `a11y-estrutura:208` | ver abaixo |

**Causa raiz identificada:** a `T-1280` do TASKS 018 — *"`frontend/e2e/`: ajustar os seletores que
dependem de cabeçalho de seção"* — foi executada **ao pé da letra**. Um único arquivo de e2e foi
tocado, e nele um único seletor (`[id^="secao-"]` → `#divergencias`). `smoke` e `analise` ficaram
porque a quebra deles é de **contagem**, não de seletor. O `§0 Resultado` do TASKS 018 declara, na
mesma tabela, *"Piloto | 55 linhas em 22 seções | 58 linhas"* — o número que o `smoke.spec.ts`
ainda exige. Ninguém ligou os dois porque a suíte não foi rodada: aquele relatório fecha com
*"Testes de backend 405 → 423"* e não menciona navegador. As ESPECs 019 e 020 não o mencionam em
linha nenhuma.

E o `§14` que o status do TASKS 018 promete (*"desvios em §14"*) **não existe** — o arquivo
termina em §13.

**A décima falha não é expectativa desatualizada.** `a11y-estrutura:208` exige que o
`14.049.00054.00` apareça **uma vez** na tela, com a mensagem *"duas vezes é ruído; nenhuma é o
achado perdido"*. Hoje aparece duas: a ESPEC 018 `D-04`/`D-06` parou de omitir o que só a aba
conhece, e o item passou a existir no painel de análise **e** no bloco final. A regra de ouro do
TASKS 009 §2.3 e a decisão da ESPEC 018 se contradizem, e **ninguém decidiu**.

Nada disso é desta entrega, e nada disso entra nela — misturar *"a suíte voltou a valer"* com *"a
tabela nova existe"* faria com que nenhum dos dois pudesse ser revertido sozinho. Fica como
recomendação, em `K-26`.

**Fechamento medido.** Ao fim da entrega, a suíte de navegador terminou em **78 de 88** — os 84
originais mais os 4 da `derivadas.spec.ts`. As dez falhas são **as mesmas dez**, nos mesmos
arquivos e nas mesmas linhas: `a11y-estrutura:102`, `:208`, `a11y-teclado:67`, `analise:17`,
`:46`, `:127`, `:146`, `limpar:97`, `:246` e `smoke:22`. Nenhuma nova. É o critério do `P6`
emendado (PLANO 021 §10), e ele fechou.
