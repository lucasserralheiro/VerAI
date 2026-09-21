# PLANO 024 — Implementação de "O asterisco que explica o bloco final"

| | |
|---|---|
| **Especificação** | [ESPEC 024](../specs/024-o-asterisco-que-explica-o-bloco-final.md) v1.1 |
| **Versão** | 1.2 — 2026-08-19 — emenda em `T-2`/`T-6`: a frase de `R-NOT-02` fora escrita **sem** o `*` inicial, aqui e na ESPEC v1.0, e a implementação copiou o defeito fielmente. O texto correto começa por `*`<br>1.1 — 2026-08-18 — **executado**. Emenda em §7: o `P1` deste plano estava incompleto |
| **Backlog** | [TASKS 024](../tasks/024-tasks-o-asterisco-que-explica-o-bloco-final.md) — escrito depois da implementação, e diz por quê |
| **Estado inicial** | **556 testes de backend** (coleta ~10 s). O par piloto gera hoje **4 itens** no bloco final (ESPEC 018 §8.5 / ESPEC 021 §2.1); nenhum teste afirma o texto literal do título dessa faixa nem o conteúdo do rodapé além de contrato/proposta |
| **Instrumento existente** | `tests/leitura_relatorio.py::ler_docx` **não serve** a este plano: filtra linhas cujo primeiro texto seja um código (`CODIGO.match`), e nem o título da faixa nem o parágrafo do rodapé casam esse padrão. `test_docx_formatacao.py` e `test_docx_estrutura.py` já abrem o `.docx` direto por `docx.Document`, e é esse o caminho que este plano reaproveita |

---

## 1. O que este plano tem de diferente dos anteriores

Os planos 020 e 021 abrem com um oráculo transcrito de arquivo externo, porque a informação que
eles expõem já existe numa planilha ou num PDF e o risco é ler errado. **Aqui não há isso.** A
frase de `R-NOT-02` é texto autoral desta espec — não é transcrição de nada —, e por isso não há
"fonte externa" contra a qual conferir. O que substitui o oráculo é mais simples: o texto exato
já está fechado na ESPEC §5 (`R-NOT-01`, `R-NOT-02`), e os testes o citam literalmente.

> **A faixa do bloco final já é condicional — de graça.**
> `docx_renderer.py:242` só chama `_bloco_de_linhas(..., titulo=...)` quando
> `relatorio.demais_itens` não é vazio. Isso significa que `R-NOT-01` (o asterisco só aparece
> quando o bloco existe) **não pede nenhuma condicional nova**: basta o asterisco entrar na
> própria constante `TITULO_DEMAIS_ITENS`. A única condicional que este plano de fato escreve é a
> da frase do rodapé (`R-NOT-02`/`R-NOT-03`), porque `_rodape` roda sempre, bloco final existindo
> ou não.

> **`relatorio_vazio` já é o caso "sem bloco final".**
> A fixture de `conftest.py:101` monta um `Report` sem `demais_itens` — foi feita para testar a
> estrutura do documento isolada de conteúdo (T-208). Este plano não precisa de fixture nova para
> `R-NOT-03`: usa a que já existe, pela mesma razão pela qual foi criada.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Os testes reprovam pelo motivo certo** | Fim da F0 | Os três testes novos reprovam contra o código intocado: o do título por o texto não terminar em `"*"`, o da frase por ela não existir em parágrafo nenhum, e o de `relatorio_vazio` **passa já** (nada a mudar nesse caso) | Um teste que já esteja verde antes da F1 não está testando o que se pensa — mesmo defeito que o PLANO 021 nomeou no seu `P1` |
| **P1 — Implementado, e nada mais mudou** | Fim da F1 | Os três testes da F0 passam. `test_docx_formatacao.py` e `test_docx_estrutura.py` verdes **sem alteração** — nenhuma cor, largura ou contagem de linha muda. **Emendado (§7):** mais a âncora `test_capa.py::test_t1408`, que este plano não inventariou | Reverter a F1. O escopo vazou para fora do título e do rodapé |
| **P2 — O conjunto** | Fim da F2 | Suíte de backend verde, contagem 556 → 559 (três testes novos); `ruff` e `mypy` limpos | Não entregar |

---

## 3. Fases

### F0 — Os testes, escritos antes `[portão]`

**Objetivo:** ter, contra o código intocado, uma prova de que a mudança ainda não existe — e de
que o caso sem bloco final já está coberto sem precisar de nada novo.

| # | Tarefa | Ref. |
|---|---|---|
| T-1 | Em `test_docx_formatacao.py` (reaproveita a fixture `gerado`/`xml` do piloto): o título da faixa do bloco final é exatamente `"DEMAIS ITENS DO LEVANTAMENTO*"` | `R-NOT-01` |
| T-2 | No mesmo arquivo: o texto *"\*Itens presentes na aba de levantamento sem código correspondente na tabela de itens do contrato analisado."* — com o `*` inicial, ver emenda v1.2 — aparece em algum parágrafo do corpo do documento gerado para o piloto | `R-NOT-02` |
| T-3 | Novo teste, com `relatorio_vazio` (sem `demais_itens`) renderizado por `DocxRenderer().renderizar`: **nenhuma** tabela traz título terminado em `"*"`, e o texto de `R-NOT-02` não aparece em parte alguma do documento | `R-NOT-03` |
| T-4 | **[portão]** Rodar os três contra o `HEAD` atual: T-1 e T-2 reprovam (texto ausente); T-3 **passa já**, porque `relatorio_vazio` nunca teve bloco final | **P0** |

**Verificação:** P0.

> **T-3 passar antes de qualquer código novo não é folga — é o teste confirmando o próprio
> raciocínio da §1.** Se ele reprovasse contra o código intocado, a premissa de que `R-NOT-03` já
> vale por construção estaria errada, e o plano precisaria de uma fase extra.

**Tamanho:** PP — trinta minutos.

---

### F1 — A implementação `[publicável sozinha]`

**Objetivo:** os dois textos passam a existir, exatamente onde a ESPEC 024 §7 previu.

| # | Tarefa | Ref. |
|---|---|---|
| T-5 | `layout.py:85` — `TITULO_DEMAIS_ITENS` passa a `"DEMAIS ITENS DO LEVANTAMENTO*"`. Nenhuma condicional nova: o chamador em `docx_renderer.py:244` já só roda quando o bloco existe | `R-NOT-01`, `D-01` |
| T-6 | `layout.py` — nova constante `NOTA_DEMAIS_ITENS`, com o texto de `R-NOT-02`, ao lado de `TITULO_DEMAIS_ITENS` | `R-NOT-02` |
| T-7 | `docx_renderer.py::_rodape` — depois do parágrafo de contrato/proposta, **se** `relatorio.demais_itens`, escreve um parágrafo novo com `layout.NOTA_DEMAIS_ITENS`, mesma fonte e corpo do parágrafo existente (`layout.CORPO_FONTE`, `layout.FONTE_REGULAR`), sem negrito | `R-NOT-02`, `R-NOT-03`, `R-NOT-04` |
| T-8 | **[portão]** T-1, T-2 e T-3 passam. `test_docx_formatacao.py` e `test_docx_estrutura.py` inteiros, sem alteração de asserção alguma | **P1** |

**Verificação:** P1.

> **T-7 é a única tarefa com condicional, e é onde `R-NOT-03` de fato se decide.** `_rodape` hoje
> escreve sempre; a condicional entra **dentro** dela, não como um `if` externo que decida chamá-la
> ou não — `_rodape` continua responsável pelo parágrafo de contrato/proposta em qualquer caso.

**Tamanho:** PP — quarenta e cinco minutos.

---

### F2 — Fechamento `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-9 | Suíte de backend completa: 556 → **559**, sem regressão | **P2** |
| T-10 | `ruff` e `mypy` sobre os dois arquivos tocados | **P2** |
| T-11 | ESPEC 024: `Status` passa de `Proposta` para `Implementada`, com a data | — |

**Tamanho:** PP — quinze minutos.

---

## 4. Sequência

```
F0 ──► F1 ──────────► publicável sozinha
P0     P1             (título e nota existem;
                        nada mais mudou)
             │
             └──► F2
                  P2
```

Não há corte intermediário além do fim da F1: a mudança inteira é pequena o bastante para não
precisar de um estado publicável a meio caminho como os planos 020/021 tiveram.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~1h30 |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Escrever o teste do título a partir do que a implementação produzir, em vez do texto fechado na espec | T-1 e T-4 rodados **antes** de tocar `layout.py` — é o próprio P0 |
| A condicional de `R-NOT-03` acabar fora de `_rodape`, exigindo saber em dois lugares se o bloco existe | T-7 mantém a decisão dentro do método que já recebe `relatorio` |
| A frase entrar em negrito ou com cor nova "para destacar" | `R-NOT-04` e T-7 — mesma fonte e corpo do parágrafo vizinho, sem exceção |
| `test_docx_formatacao.py` acusar título mudado numa asserção que hoje conta ocorrências de `NAVY`/`LAVANDA` sem olhar texto | Não deveria: essas asserções contam cor, não conteúdo (§ estado inicial). T-8 confirma que continuam verdes |
| Alguém tentar implementar nota de rodapé nativa do Word por engano, lendo "nota de rodapé" ao pé da letra | `D-03` da espec e o texto de T-7 — é parágrafo de corpo, igual ao que já existe |

---

## 6. O que este plano não faz

- Não muda `Contract.posicao_de`, `Contract.aplicar`, nem qualquer critério de quais códigos
  entram em `demais_itens`.
- Não toca o XLSX de análise nem o manual de utilização (`I-02` da espec, registrado e fora).
- Não introduz nota de rodapé nativa do Word — é parágrafo de corpo, como `D-03` decidiu.
- Não toca frontend: a mudança é inteiramente dentro de `infrastructure/report/`.

---

## 7. Emenda de execução — o `P1` estava incompleto

**2026-08-18.** O `P1` nomeava dois arquivos como o universo de regressão do documento:
`test_docx_formatacao.py` e `test_docx_estrutura.py`. Os dois fecharam verdes — e a suíte completa
reprovou em **`test_capa.py::test_t1408`**, que este plano não menciona.

A `T-1408` é âncora **total** do corpo do `.docx`: contagem de `<w:t>` fora das caixas da capa,
contagem de códigos e `sha256` do conjunto. Esta entrega acrescenta texto ao corpo de propósito, e
ela acusou — fazendo exatamente o seu trabalho.

**A causa do erro é de método, e não de leitura apressada:** o inventário foi feito por **nome de
arquivo**, e a `T-1408` mora num arquivo chamado `test_capa.py` cuja asserção mais forte é sobre
tudo o que *não* é a capa. Uma varredura por `sha256`, por constante de contagem e por
`assert len(` teria achado em um minuto.

O precedente estava disponível: o PLANO 021 `T-1507` captura as linhas do documento **antes** de
qualquer edição, com a nota *"é a diferença entre saber que o documento não mudou e supor"*.

**Critério que passa a valer para toda entrega que toque `infrastructure/report/`:** o inventário
de âncoras se faz por **o que o teste afirma**, não por onde ele mora.

A reancoragem e a prova do delta estão no [TASKS 024 §6.1 e §6.2](../tasks/024-tasks-o-asterisco-que-explica-o-bloco-final.md).

**Resultado.** Backend **559 passed**, 556 na linha de base mais os três desta entrega. `ruff` e
`mypy` limpos nos arquivos tocados.