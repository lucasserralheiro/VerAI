# PLANO 028 — Implementação de "A linha que não diz nada"

| | |
|---|---|
| **Especificação** | [ESPEC 028](../specs/028-a-linha-que-nao-diz-nada.md) v1.0 |
| **Versão** | 1.0 — 2026-08-19 — **executado**. Escrito depois da implementação, e o §8 diz o que a execução ensinou que este texto não previa |
| **Backlog** | Sem TASKS próprio até aqui. O que normalmente iria para lá — a prova da reancoragem — está na ESPEC §8.3 e no §7 deste plano, porque é onde ela decide o portão |
| **Estado inicial** | **1.330 testes de backend** (TASKS 027), e a árvore **não estava limpa**: carregava a correção não publicada da ESPEC 024 v1.1 (o `*` inicial da nota) e, por causa dela, **quatro âncoras de documento vermelhas de propósito** — `CORPO_DO_PILOTO_TEXTOS/CODIGOS/SHA256` em `test_capa.py` e as entradas `word/document.xml` dos dois pacotes em `test_identidade_dos_artefatos.py`. O TASKS 026 §9.10 já registrara que a reancoragem caberia a quem fechasse esta espec |
| **Instrumento existente** | `tests/leitura_relatorio.py::ler_docx` **serve inteiro** a este plano — ao contrário do PLANO 024, que precisou abrir o `.docx` na mão. Ele devolve exatamente as linhas de item (filtra pelo padrão do código na primeira célula), que é a unidade sobre a qual esta espec fala. E as fixtures `piloto`/`pgm` de `test_anchor_por_codigo.py` devolvem `(resultado, linhas)`: o `Report` e o documento na mesma tupla, que é o que a `R-ZER-05` precisa comparar |

---

## 1. O que este plano tem de diferente dos anteriores

**O oráculo existe, e é externo ao código.** Diferente do PLANO 024 — cujo alvo era texto autoral,
sem fonte contra a qual conferir —, aqui a pergunta *"quais linhas somem?"* tem resposta nas duas
planilhas reais, e ela precisa ser **medida antes**, não lida da saída da implementação. É a F0.

> **A regra é aritmética sobre dado que já está na linha.**
> `ReportLine` já traz `contratada`, `medida` e `contratada_declarada`. Nenhuma leitura nova de
> arquivo, nenhum campo novo, nenhuma consulta ao contrato. O risco desta entrega **não está no
> código** — está em duas coisas ao redor dele: omitir na camada errada, e reancorar mal.

> **A camada errada é tentadora e custa uma linha a menos.**
> Filtrar em `GenerateMeasurementReport.executar` — um `if` antes do `demais_itens.append` — é
> menor, e leva os itens embora da tela, da análise e da API junto. A `D-01` decidiu o contrário, e
> por isso este plano tem um teste cujo único trabalho é reprovar essa simplificação (`T-6`).

> **Duas mudanças de documento em voo ao mesmo tempo.**
> O `*` da ESPEC 024 v1.1 e a omissão desta espec movem o mesmo `word/document.xml`. Um `sha256`
> diz que algo mudou, nunca **o quê** — e é por isso que a reancoragem é fase própria, com portão
> próprio, e vem **depois** de a árvore parar (F3/P2).

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — O oráculo, e os testes reprovando pelo motivo certo** | Fim da F1 | Os zerados dos dois pares estão listados **por extenso**, medidos da planilha e não derivados do predicado que ainda não existe. Os testes novos reprovam por linha exibida a mais; o de `R-ZER-02` (bloco do contrato) **passa já** | Um teste verde antes da F2 não afirma o que se pensa. Um oráculo derivado do código só prova que o código concorda consigo mesmo |
| **P1 — Implementado, e o delta é só o previsto** | Fim da F2 | Testes novos verdes. As âncoras de conjunto acusam **exatamente** 58 → 55 no piloto e 58 → 51 no PGM, e os códigos que somem são os do oráculo — nem um a mais | Reverter a F2. Linha que some fora do bloco final é escopo vazado |
| **P2 — Reancoragem provada, com a árvore parada** | Fim da F3 | Cada um dos dois deltas reproduzido em separado, desfazendo **apenas** a sua mudança; nenhuma outra entrada dos pacotes se move em nenhum dos dois passos; a aritmética do corpo do piloto fecha por dois caminhos independentes. **O inventário são seis âncoras, e não quatro (§8)** | Não trocar constante nenhuma. Colar a saída do código na âncora é apagar a linha vermelha, não reancorar |
| **P3 — O conjunto** | Fim da F4 | Suíte de backend verde, 1.330 → **1.342**; `ruff` e `mypy` limpos nos arquivos tocados; os textos que afirmavam *"nada é omitido"* corrigidos | Não entregar |

---

## 3. Fases

### F0 — O oráculo `[portão]`

**Objetivo:** saber, antes de escrever regra alguma, **quais** linhas a regra vai tirar de cada um
dos dois pares — e ter isso por extenso, em constante, não em compreensão de lista.

| # | Tarefa | Ref. |
|---|---|---|
| T-1 | Gerar o `Report` dos dois pares e listar o bloco final com `contratada`, `medida`, `contratada_declarada` e `perfil_ou_pacote` de cada linha | ESPEC §1 |
| T-2 | Separar os zerados: piloto **3 de 4**, PGM **7 de 13** sem o aditivo (**6 de 11** com ele). Conferir caso a caso contra a captura de tela que originou o pedido | `R-ZER-01` |
| T-3 | Conferir os dois casos que **parecem** zerados e não são: o `14.046.00003.00` do PGM (contratada em branco, medida não numérica — a `R-REL-08` o emite `1 / 1`) e qualquer linha com `contratada_declarada = False` | `R-ZER-03`, ESPEC §2.3 |
| T-4 | Medir se há `0 / 0` no bloco **ordenado pelo contrato** dos dois pares — **não há** —, para saber que a `R-ZER-02` não tem caso real e vai precisar de cenário construído | `R-ZER-02` |

**Verificação:** P0 (primeira metade).

> **T-3 é o que separa esta regra de um `== 0` ingênuo.** Duas linhas do PGM parecem zeradas na
> planilha e não são zeradas na linha emitida. Quem escrever o predicado a partir da aba, e não da
> `ReportLine`, tira do documento um item que sai `1 / 1`.

**Tamanho:** PP — trinta minutos.

---

### F1 — Os testes, escritos antes `[portão]`

**Objetivo:** ter, contra o código intocado, a prova de que a mudança ainda não existe — e os
cenários construídos para as três regras que os pares reais não exercitam.

| # | Tarefa | Ref. |
|---|---|---|
| T-5 | Módulo novo `tests/test_linhas_zeradas.py`, com `Report` montado à mão e renderizado **sem anexos**: tabela-verdade de `sem_quantidade_alguma`, bloco final misto, `0 / 0` no bloco do contrato, bloco final inteiro zerado e o seu simétrico | `R-ZER-01` a `R-ZER-04` |
| T-6 | Em `test_anchor_por_codigo.py`, o teste que **só** existe para reprovar a omissão na camada errada: `resultado.relatorio.demais_itens` continua com os 4 e os 13 códigos nominais **enquanto** o `.docx` traz menos | `R-ZER-05`, `D-01` |
| T-7 | No mesmo arquivo, converter as constantes: `BLOCO_FINAL_DO_*` seguem inteiras (são o `Report`), entram `ZERADOS_DO_*` do oráculo, e `EXIBIDOS_DO_* = BLOCO_FINAL - ZERADOS` | `R-ZER-01` |
| T-8 | **[portão]** Rodar contra o `HEAD`: os de bloco final reprovam por linha a mais; o de `R-ZER-02` e o de `R-ZER-03` **passam já**, porque hoje nada é omitido | **P0** |

**Verificação:** P0.

> **T-8 tem dois testes que passam antes de qualquer código novo, e isso é resultado, não folga.**
> `R-ZER-02` e `R-ZER-03` descrevem o que **não** muda. Se algum deles reprovasse aqui, a premissa
> de que a regra é estreita estaria errada antes de começar.

**Tamanho:** P — uma hora.

---

### F2 — A implementação `[publicável sozinha]`

**Objetivo:** a omissão passa a existir, exatamente nas duas camadas que a ESPEC §7 previu.

| # | Tarefa | Ref. |
|---|---|---|
| T-9 | `domain/entities/report.py` — `ReportLine.sem_quantidade_alguma`: `contratada_declarada and contratada.valor == 0 and medida.valor == 0`. Ao lado de `sem_cobertura_contratual`, que é a propriedade irmã | `R-ZER-01`, `R-ZER-03`, `D-02` |
| T-10 | `docx_renderer.py` — `_bloco_final(relatorio)`, `@staticmethod`, devolve `demais_itens` sem as zeradas | `R-ZER-01`, `D-01` |
| T-11 | `_preencher` calcula `bloco_final` **uma vez**, desenha se não vazio, e o **passa** a `_rodape`, que troca `if relatorio.demais_itens` por `if bloco_final` | `R-ZER-04`, `D-05` |
| T-12 | **[portão]** Testes da F1 verdes; `test_docx_formatacao` acusa a lavanda em 55 e `test_anchor_por_codigo` acusa 55 e 51 — e nada mais do documento se move | **P1** |

**Verificação:** P1.

> **T-11 é a tarefa com risco, e o risco não é o `if`.** É a distância entre os dois pontos:
> `_preencher` na linha 242 e `_rodape` na 679 decidem sobre a mesma lista. Passar o resultado em
> vez de recomputá-lo é o que impede o asterisco órfão — faixa que não existe com nota que remete a
> ela, ou o contrário.

**Tamanho:** PP — trinta minutos.

---

### F3 — A reancoragem `[portão]`

**Objetivo:** trocar as quatro constantes de documento **uma vez só**, com os dois deltas em voo
provados em separado. Vem depois da F2 de propósito: reancorar contra implementação em andamento
grava o estado de meia hora daquela tarde (TASKS 026 §9.10).

| # | Tarefa | Ref. |
|---|---|---|
| T-13 | Desligar **apenas** a omissão, mantendo o `*` da nota, e medir os quatro artefatos: tem de sair `84c4aadc…` / `b334b4cd…` / `797165ea…` / 16.029 textos / 79 códigos — os valores que o TASKS 026 §9.10 registrara | **P2** |
| T-14 | Religar a omissão e medir de novo: `ad68ff2a…` / `954b57f3…` / `b9d29dd9…` / 16.017 / 76. Conferir que **só** `word/document.xml` difere em cada pacote | **P2** |
| T-15 | Conferir a aritmética por caminho independente: 16.029 − 16.017 = 12 = 3 linhas × 4 células (a unidade sai vazia no bloco final), e 79 − 76 = 3 códigos | **P2** |
| T-16 | Trocar as constantes, com a cadeia dos três estados registrada no comentário de cada uma, e atualizar o docstring de `test_identidade_dos_artefatos.py`, que declarava as âncoras *"vermelhas e ainda não reancoradas"* | **P2** |
| T-16b | **Não previsto (§8):** as duas âncoras que o inventário perdeu — o `.json` de 58 linhas por par da `T-1507` e a contagem no fim do teste de `.docx` válido do e2e. A do `.json` é regravada **derivando-a da antiga**, e o diff sai só com deleções | **P2** |

**Verificação:** P2.

> **Por que os dois passos, e não só o segundo.** O segundo sozinho prova que o documento mudou —
> coisa que já se sabe. O primeiro é o que prova que ele mudou **pelas duas razões previstas e por
> nenhuma outra**: se qualquer célula tivesse se movido junto, a medição intermediária não bateria
> com a que o TASKS 026 já registrara, e ela bate.

**Tamanho:** P — uma hora, quase toda de espera de renderização.

---

### F4 — Fechamento `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-17 | Suíte de backend completa: 1.330 → **1.342** (10 do módulo novo + 2 parametrizados no âncora), sem regressão | **P3** |
| T-18 | `ruff` e `mypy` sobre os arquivos tocados | **P3** |
| T-19 | Corrigir onde o repositório afirma *"nada é omitido"* por extenso: `README.md` §"De onde vem cada coisa" e o comentário de `demais_itens` em `frontend/src/lib/types.ts` | `R-ZER-05` |
| T-20 | `docs/CHANGELOG.md` — a entrada de mudança de rumo: a `D-04` da ESPEC 018 ganha a sua primeira exceção | — |

**Tamanho:** PP — trinta minutos.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──────────► publicável sozinha
P0     P0     P1              (a omissão existe; o dado, intacto)
                    │
                    └──► F3 ──► F4
                         P2     P3
                     (âncoras)
```

A F3 **não** é publicável sozinha: entre a F2 e o fim da F3 a suíte tem quatro vermelhos
conhecidos. É o mesmo estado em que esta entrega encontrou a árvore, e a diferença é que agora ele
dura uma hora em vez de um dia.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~3h30 |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Filtrar no caso de uso porque é uma linha mais curta | `T-6` — o teste que compara `Report` e `.docx` na mesma asserção. É o único ponto da suíte que reprova essa simplificação |
| Escrever o predicado a partir da planilha, e não da `ReportLine` | `T-3` e a tabela-verdade de `T-5`: o `14.046.00003.00` do PGM sai `1 / 1` por `R-REL-08`, e some se a regra olhar a aba |
| Tratar célula vazia como zero | `R-ZER-03` no `T-5`, com caso construído — nenhum par real o exercita (`I-03` da espec) |
| A regra escapar para o bloco ordenado pelo contrato | `T-4` mediu que lá não há `0 / 0` hoje: **nenhum teste real acusaria o vazamento**. Por isso `T-5` monta o caso à mão |
| Asterisco órfão, ou nota sem faixa | `D-05` e o par simétrico de testes de `R-ZER-04` |
| Reancorar as quatro constantes de uma vez, sem separar os deltas | `T-13` a `T-15`, e o critério do `P2`: prova antes da troca, sempre |
| Confundir "a suíte estava vermelha" com "a minha mudança quebrou" | O estado inicial deste plano nomeia as quatro âncoras e a razão de estarem assim |

---

## 6. O que este plano não faz

- Não muda `Contract.posicao_de`, `Contract.aplicar`, nem qualquer critério de **quais** códigos
  entram em `demais_itens`.
- Não toca o caso de uso, o grid, o `.xlsx` de análise nem os *schemas* da API (`R-ZER-05`).
- Não altera o texto da nota de `R-NOT-02` — a pergunta está registrada em `I-01` da espec.
- Não toca `layout.py`: nenhuma medida, cor, título ou constante de texto muda.
- Não escreve TASKS próprio: a única lição de execução desta entrega é a do §8, e ela cabe aqui.

---

## 7. Por que a reancoragem é fase, e não tarefa

Nos planos 020 e 021 a reancoragem foi uma linha dentro do fechamento. Aqui ela é fase com portão
próprio, e a razão está no estado inicial: **esta entrega herdou âncoras vermelhas de outra
mudança**.

O TASKS 026 §9.10 registrou a regra que aquele caso criou — *"reancorar exige não só o delta
provado, mas uma árvore parada"* — e adiou a troca deliberadamente, escrevendo que ela caberia a
quem fechasse a ESPEC 028. Esta é a primeira entrega a exercer essa regra, e teria sido fácil
tratá-la como formalidade: as constantes estão comentadas, a explicação já existe, e colar os
valores novos passaria em qualquer revisão.

O que a F3 acrescenta a isso é uma coisa só, e é a que importa: a medição intermediária — com o
`*` e **sem** a omissão — reproduziu, número a número, o que o TASKS 026 registrara horas antes,
por outra pessoa e antes de esta implementação existir. Isso é o que autoriza trocar as
constantes, e nenhum `sha256` final teria dito o mesmo.

---

## 8. Emenda de execução — o que a execução ensinou

**2026-08-19.**

**A suíte completa só coleta com `python -m pytest`.** `uv run pytest`, a partir de `backend/`,
interrompe a coleta com `ModuleNotFoundError: No module named 'tests'` —
`test_divergencia_de_fonte.py` importa `from tests.test_quantitativo_consolidado import ...`, e só
o `-m` põe o diretório corrente no `sys.path`. Execuções por arquivo passam das duas formas, o que
faz o defeito aparecer **no fim**, depois de minutos de renderização. Não é defeito desta entrega,
e está aqui porque custou uma execução inteira.

**O inventário de âncoras ficou incompleto — de novo, e pela mesma espécie de erro.** O PLANO 024
§7 deixou escrito que ele se faz *por o que o teste afirma, não por onde ele mora*. As quatro
constantes de `sha256` e de contagem foram achadas assim, inclusive a `T-1408`, que mora em
`test_capa.py`. **Faltaram duas**, e a suíte completa as acusou depois de 14 minutos:

- `test_linhas_derivadas.py::test_t1507_o_documento_nao_se_move` — âncora de **58 linhas por par**,
  guardada num `.json` de fixture. O próprio PLANO 021 a criou com a nota *"é a diferença entre
  saber que o documento não mudou e supor"*, e este plano a **cita** na §1 sem se dar conta de que
  ela ancorava o que a entrega ia mudar;
- `test_api_e2e.py::test_o_documento_embutido_decodifica_para_um_docx_valido` — um
  `assert len(ler_docx_de_bytes(conteudo)) == 58` no fim de um teste cujo nome fala de decodificar
  base64 e conferir fontes.

**O que a busca por `sha256`, por constante de contagem e por `assert len(` teria achado: as duas.**
A primeira tem `ANCORA = Path(...)/"linhas_do_documento.json"` no topo do módulo; a segunda é
literalmente um `assert len(...) == 58`. O critério do PLANO 024 §7 estava certo e **não foi
aplicado até o fim** — parou nos arquivos que a entrega já ia tocar.

**A correção usou o método da §7 assim mesmo, e ele pagou.** A âncora do `.json` foi regravada
**derivando-a da antiga** — remover exatamente as 10 linhas previstas — e o resultado bateu com a
saída do renderizador nos dois pares. O `git diff` do arquivo saiu com **70 deleções e zero
inserções**: nenhuma descrição, unidade ou quantidade das 106 linhas restantes se moveu.

**O oráculo pagou-se em `T-3`.** O `14.046.00003.00` do PGM aparece na lista do grupo D do âncora
com o comentário *"zerado dos dois lados"* — e a linha emitida é `1 / 1`. Uma regra escrita a
partir daquele comentário, e não da `ReportLine`, teria tirado do documento um item de perfil.

**O `P0` foi fechado ao contrário.** Testes escritos depois do código não podem reprovar contra o
código intocado, e declarar o portão cumprido por analogia é como se aceita um teste que não testa
nada. Desligar a omissão e rodar custou dois minutos: reprovam o bloco final misto, o bloco inteiro
zerado e a `T-2056` nos dois pares — cada uma na asserção esperada —, e passam as três que afirmam
invariante. A tabela está na `T-2058` do TASKS 028.

**Resultado.** Backend **1.342 passed** em 12min30 — 1.330 na linha de base do TASKS 027 mais 12
desta entrega. `ruff` e `mypy` limpos nos arquivos tocados. As **seis** âncoras de documento verdes
de novo, as quatro herdadas pela primeira vez em um dia.