# PLANO 036 — Implementação de "A página que só diz que não tem nada"

| | |
|---|---|
| **Especificação** | [ESPEC 036](../specs/036-a-pagina-que-so-diz-que-nao-tem-nada.md) v1.0 |
| **Versão** | 1.0 — 2026-08-31 |
| **Backlog** | TASKS 036, a escrever. Numeração continua de `T-2282`, a última do PLANO 035 — os `T-` deste plano começam em **`T-2283`** |
| **Estado inicial** | Ramo `feature/evolucao`, `HEAD` em `24acc9e`. **A árvore não está limpa:** a ESPEC 035 está entregue e **não commitada** — seis arquivos modificados (`contract.py`, `grid.py`, `pdfplumber_extractor.py`, `contract_validations.py`, `README.md`, `CHANGELOG.md`), mais `backend/tests/test_palavras_fora_da_grade.py` e os três documentos da 035. Backend: **1.517 testes coletados**, medido nesta árvore em 2026-08-31 |
| **Colisão conhecida** | **A ESPEC 035, aberta na árvore.** Sobreposição de **arquivo**: nenhuma — nenhum dos seis modificados é tocado por esta entrega; `README.md` e `CHANGELOG.md` são os únicos pontos de encontro, e em seções diferentes. Sobreposição de **âncora**: total — os quatro pacotes byte a byte de `test_identidade_dos_artefatos.py` são a régua desta entrega, e a 035 declara não ter reancorado nenhum. **Declara. A `T-2283` confere** (§7) |
| **Instrumento existente** | `backend/tests/pacote.py::partes` — hash por entrada do zip, sem o carimbo de hora. As fixtures de sessão `docx_do_piloto`, `documento_do_pgm` (~115 s, a mais cara da suíte) e os dois `.xlsx` derivados. `AnexoReader` serve de sonda direta: ler as duas planilhas e imprimir o veredito de `vazio` custa ~3 s e não precisa renderizar nada |

---

## 1. O que este plano tem de diferente dos anteriores

> **São duas mudanças com riscos opostos, e é por isso que são duas fases.**
> O critério (`R-VAZ-02`) decide **quem** é vazio e pode errar em silêncio nos dois sentidos. A
> omissão (`R-VAZ-01`) é mecânica: ela só executa o veredito. Entregues juntas, um documento que se
> mova não diz qual das duas o moveu. Separadas, a `F2` tem um portão que a `F3` não pode ter — e é
> o portão mais forte deste plano.

> **A `F2` não pode mudar um byte de documento nenhum, e isso é asserção, não expectativa.**
> Os vereditos dos dois pares versionados são conhecidos: piloto **0 vazios de 19**, PGM **3 de 19**.
> Um critério novo que produza os mesmos vereditos produz os mesmos documentos. Se qualquer um dos
> quatro pacotes se mover na `F2`, o critério classificou errado alguma coisa — e não há segundo
> lugar onde procurar.

> **O hash do piloto é o único oráculo do falso positivo.**
> `V-ANX-01` pega a planilha inteira trocada; nenhuma validação pega **um** anexo legítimo
> classificado como vazio. O que pega é o `PACOTE_DO_PILOTO`: 19 anexos reais, 15.955 células
> escritas, e qualquer um deles omitido move `word/document.xml`. Ele é portão em `P1` e em `P2`,
> e nunca é reancorado nesta entrega (`D-06` da espec).

> **O achado entra nesta entrega, não na seguinte.**
> `F3` sem `F4` deixa o produto pior do que está: hoje dezenove páginas denunciam a planilha com o
> layout trocado; depois da `F3`, nada denuncia. É a única forma de esta espec sair pior que o
> defeito, e está registrada como o primeiro risco do §5.

> **Não tocar o `AnexoReader`.**
> A leitura continua devolvendo os 19 anexos configurados (`R-VAZ-04`, `D-03`). Filtrar lá parece
> mais limpo e destrói a informação de que `V-ANX-01` depende — e o teste que distingue *"nenhuma
> aba veio"* de *"18 vieram vazias"* deixa de ser escrevível. Um `git diff` que toque
> `anexo_reader.py` reprova a revisão.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base, régua congelada, inventário, testes reprovando pelo motivo certo** | Fim da `F0`+`F1` | Os quatro pacotes reproduzidos **nesta árvore**, entrada por entrada. A sonda de anexos reproduzida (0/19 e 3/19, com as três abas nomeadas). A forma do documento do PGM medida: **21 seções, 3 frases, 34 tabelas**. Os testes novos reprovam pelo **valor**, e o de `V-ANX-01` por `ImportError`, declarado | Régua não reproduzida é régua de outra árvore — e esta árvore tem a 035 dentro (§7) |
| **P1 — O critério, documentariamente inerte** | Fim da `F2` | **Os quatro pacotes idênticos**, inclusive o do PGM. Vereditos: piloto 19 × `False`; PGM 16 × `False` e as três abas nomeadas × `True`; os quatro casos construídos de `R-VAZ-02` com o veredito esperado | Reverter a `F2`. Documento movido aqui é anexo classificado errado, e nenhuma outra rede o pega |
| **P2 — A omissão** | Fim da `F3` | PGM: **18 seções, 0 frases, 34 tabelas**. `PACOTE_DO_PILOTO` **idêntico**, entrada por entrada. `PACOTE_DO_PGM` movido **só** em `word/document.xml` — e o que mais se mover, medido e explicado, não previsto. Delta provado por desligamento (§7) | Reverter a `F3`. Tabela a mais ou a menos no PGM é conteúdo perdido, não página economizada |
| **P3 — O achado** | Fim da `F4` | `V-ANX-01` dispara com 19 vazios (**um** achado) e cala com 18 vazios e 1 com conteúdo. Os achados dos dois pares **inalterados**, lista por lista | Reverter a `F4`. Achado novo em par versionado é ruído entregue em produção |
| **P4 — O conjunto** | Fim da `F5` | Backend verde, **≥ 1.517** mais os testes novos. `ruff` e `mypy` limpos nos arquivos tocados. Nenhum artefato reancorado além do `PACOTE_DO_PGM`, e esse com a justificativa escrita no cabeçalho do arquivo | Não entregar |

---

## 3. Fases

### F0 — Linha de base, régua e inventário `[portão]`

**Objetivo:** congelar o que não pode mudar, **antes** de escrever código — e desta vez com uma
razão a mais: a árvore carrega uma entrega alheia (§7).

| # | Tarefa | Ref. |
|---|---|---|
| T-2283 | **Reproduzir os quatro pacotes nesta árvore**: `PACOTE_DO_PILOTO`, `PACOTE_DO_PGM`, `ANALISE_DO_PILOTO`, `ANALISE_DO_PGM`, entrada por entrada. É o que separa *"a 035 declara não ter reancorado"* de *"a 035 não reancorou, e eu conferi"* | **P1**, **P2**, §7 |
| T-2284 | Linha de base: `python -m pytest` completo, número declarado. Coletados hoje: **1.517** | **P4** |
| T-2285 | **Congelar a sonda de anexos**: `AnexoReader` nas duas planilhas, veredito de `vazio` por aba, com `Colocation`, `Comunicação Dados` e `CertificadosDigitais` nomeadas no PGM e **nenhuma** no piloto | **P1** |
| T-2286 | **Congelar a forma do documento do PGM**: 21 seções, 3 parágrafos com a frase, 34 tabelas (medido em 2026-08-31 — reproduzir, não copiar) | **P2** |
| T-2287 | Executar as buscas do §8 sobre `backend/tests/` e `frontend/`. **O resultado manda na tabela da ESPEC §8.3**, e não o contrário | **P0** |

> **A `T-2283` é a tarefa mais importante desta fase, e ela existe por causa do §7.** Medir o
> "antes" numa árvore que tem entrega alheia dentro é o defeito que o PLANO 034 §7 registrou. Aqui a
> sobreposição de arquivo é zero, mas a de âncora é total: os quatro pacotes são exatamente o que a
> ESPEC 035 prometeu não mover.

**Verificação:** `P0` (primeira metade). **Tamanho:** PP — vinte minutos, mais o tempo das suítes.

---

### F1 — Os testes, escritos antes `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2288 | `R-VAZ-01`/`R-VAZ-03`: relatório com um anexo vazio **não ganha seção nem parágrafo**, e a geração não levanta exceção. É a `T-317` invertida, e a única alteração obrigatória em teste existente | `R-VAZ-01`, `D-07` |
| T-2289 | `R-VAZ-02` a: anexo com `linhas=((), (), ())` é omitido. Hoje ele sai como tabela invisível de 3 × 1 numa página só dele | `R-VAZ-02` |
| T-2290 | `R-VAZ-02` b: anexo com figura e **nenhuma** célula sai, **com a figura**. Hoje imprime a frase e perde o PNG | `R-VAZ-02` |
| T-2291 | `R-VAZ-02` c: anexo cujas células só têm `borda=True` é omitido — `R-BRD-02` continua valendo do mesmo lado | `R-VAZ-02` |
| T-2292 | `V-ANX-01`: dispara com 19 vazios (**um** achado, `AVISA`) e **cala** com 18 vazios e 1 com conteúdo. Reprova hoje por `ImportError`, e isso é declarado aqui | `V-ANX-01`, `D-04` |
| T-2293 | `R-VAZ-05`/`R-VAZ-06` sobre `documento_do_pgm`: **34 tabelas**, 18 seções, e os 16 anexos na ordem de `anexos.json`. Usa a fixture de sessão que já existe — **nenhuma renderização nova** | `R-VAZ-05` |
| T-2294 | **[portão]** Rodar contra esta árvore e conferir **como cada um reprova**: `T-2288` a `T-2291` e `T-2293` pelo **valor**; `T-2292` por `ImportError` | **P0** |

> **`T-2290` reprova hoje por dois motivos ao mesmo tempo**, e é bom que reprove: falta a figura
> **e** sobra a frase. Depois da `F2` ele passa a reprovar por nenhum. Se passar já na `F1`, o caso
> construído está errado — provavelmente com célula não-vazia sobrando.

> **`T-2293` não renderiza nada.** `documento_do_pgm` é fixture de sessão do `conftest`, criada pela
> `T-2001` exatamente para não haver uma quarta renderização de PGM na suíte. Escrever um teste que
> gere o PGM de novo custaria ~115 s por execução, todo dia, para sempre.

**Verificação:** `P0`. **Tamanho:** P — uma hora.

---

### F2 — O critério, e ele não pode mudar documento nenhum `[portão]`

**Objetivo:** trocar a pergunta de `Anexo.vazio` sem que nada no mundo perceba.

| # | Tarefa | Ref. |
|---|---|---|
| T-2295 | `Anexo.vazio` passa a ser: nenhuma célula com texto ou preenchimento (`_tem_conteudo`, o critério da ESPEC 014) **e** nenhuma figura. `_tem_conteudo` **não muda** — é reusada | `R-VAZ-02`, `D-02` |
| T-2296 | **[portão]** Os quatro pacotes **idênticos** à `T-2283`. A `F2` sozinha não pode mover documento: os vereditos dos dois pares são os mesmos de antes | **P1** |
| T-2297 | **[portão]** A sonda da `T-2285` reproduzida: 0/19 no piloto, 3/19 no PGM, as mesmas três abas | **P1** |
| T-2298 | `T-2289` a `T-2291` **verdes**; `T-2288` e `T-2293` continuam vermelhos — a omissão ainda não existe | **P1** |

> **A `T-2298` é o teste do teste.** Os três casos de `R-VAZ-02` passam a dar o veredito certo, mas
> o documento continua imprimindo a página: `_anexos` ainda cria a seção. Um `T-2288` que fique
> verde aqui significa que alguém entregou a `F3` junto — e o portão `P1` perdeu o sentido.

**Verificação:** `P1`. **Tamanho:** PP — quinze minutos.

---

### F3 — A omissão `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2299 | `_anexos`: o teste de `vazio` **antecede** `_secao_do_anexo`, e o anexo vazio é pulado. `_anexo_vazio` **sai inteiro** — método e frase | `R-VAZ-01`, `R-VAZ-03`, `D-01` |
| T-2300 | **[portão]** `documento_do_pgm`: **18 seções, 0 frases, 34 tabelas** — as três medidas da `T-2286`, e a de tabelas é a que importa (`R-VAZ-05`) | **P2** |
| T-2301 | **[portão]** `PACOTE_DO_PILOTO` **idêntico**, entrada por entrada. Sem exceção e sem reancoragem | **P2**, `D-06` |
| T-2302 | **Prova por desligamento**: com `vazio` de volta ao critério antigo **e** sem o pulo, o `PACOTE_DO_PGM` volta ao valor da `T-2283`, entrada por entrada. Só então reancorar | **P2**, §7 |
| T-2303 | Reancorar `PACOTE_DO_PGM` e escrever a justificativa no cabeçalho de `test_identidade_dos_artefatos.py`, no rito que ele mesmo impõe: o que mudou, por qual espec, e qual era o valor anterior | **P2** |
| T-2304 | Remover o `test_anexo_sem_linhas_sai_com_titulo_e_observacao` e a busca por `"não trouxe conteúdo"` que sobrar na suíte | `D-07` |

> **A `T-2302` não é zelo: é a única prova de que o delta é o previsto.** Reancorar porque o teste
> ficou vermelho é admitir a mudança sem saber o tamanho dela. Desligar as duas linhas e ver o hash
> **voltar** é o que transforma *"mudou"* em *"mudou exatamente isto"*. É o procedimento que a ESPEC
> 028 usou para trocar dois hashes, e está descrito no cabeçalho do arquivo.

> **`docProps/app.xml` é candidato a se mover junto**, e a espec §8.3 diz *"a medir, não a prever"*.
> Se ele se mover, a `T-2303` explica por quê; se outra entrada qualquer se mover, **o portão
> reprova** até haver explicação.

**Verificação:** `P2`. **Tamanho:** PP — vinte minutos de código, mais duas renderizações de PGM.

---

### F4 — O achado `[portão]` · depende de `I-01`

**A decisão de `I-01` entra aqui.** `D-04` decidiu que ausência parcial **não** avisa; se o negócio
decidir o contrário, muda o corpo de `v_anx_01` e muda a `T-2292` — não muda mais nada deste plano.

| # | Tarefa | Ref. |
|---|---|---|
| T-2305 | `infrastructure/validations/annex_validations.py`, arquivo novo: `v_anx_01_nenhuma_aba_de_anexo_reconhecida`, em quatro partes (`R-DOC-05`), severidade `AVISA` | `V-ANX-01`, `D-05` |
| T-2306 | Registro no `DIContainer.gerar`, **logo após** a leitura dos anexos — que já só ocorre quando o relatório vai existir. Guarda sobre `anexos` vazio: sem anexos lidos, não há o que afirmar (`R-GRD-06`) | `V-ANX-01` |
| T-2307 | **[portão]** `T-2292` verde: um achado com 19 vazios, nenhum com 18 | **P3** |
| T-2308 | **[portão]** Os achados dos dois pares versionados **inalterados**, lista por lista. `V-ANX-01` não dispara em nenhum deles | **P3** |
| T-2309 | Conferir a guarda da `T-2094`: ela varre **três** módulos nomeados — os anteriores à ESPEC 029 — e o arquivo novo **não entra** naquela lista. O que se afirma dele é outra coisa: que registra `AVISA` | §8 nº 6 |

> **A guarda da `T-2094` é sobre `PERGUNTA`, não sobre "toda validação".** Acrescentar
> `annex_validations.py` à lista de "anteriores" seria mentir sobre a cronologia e não afirmaria
> nada útil. O que importa aqui é `D-05`: `AVISA`, e é o `T-2308` que o prova onde dói — nos dois
> pares que hoje geram documento.

**Verificação:** `P3`. **Tamanho:** PP — vinte minutos.

---

### F5 — O conjunto `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2310 | Suíte de backend completa, número declarado, comparado com a `T-2284` | **P4** |
| T-2311 | `ruff` e `mypy` nos arquivos tocados | **P4** |
| T-2312 | **Nenhum outro artefato reancorado:** `test_docx_formatacao`, `test_capa`, `pacote.py`, `linhas_do_documento.json`, `valores_do_contrato.json` e os dois `ANALISE_*` intocados no `git diff` | **P4** |
| T-2313 | `README.md` §"Limitações conhecidas": o parágrafo das dezenove seções sai e dá lugar ao comportamento novo mais a `V-ANX-01`. **Editar sem colidir com a edição da 035**, que está na mesma seção do mesmo arquivo (§7) | — |
| T-2314 | Nota na ESPEC 004 §9 (linha *"Anexo com aba vazia"*) remetendo à ESPEC 036; `Status` da ESPEC 036; entrada no `docs/CHANGELOG.md` | — |

> **A suíte de navegador não roda nesta entrega, e a razão é verificável, não conveniência.**
> Nenhum arquivo de `frontend/` ou de `api/` é tocado; o contrato `Achado` é genérico
> (`validacao: string`, `severidade: "BLOQUEIA" | "AVISA"`), então `V-ANX-01` não exige mudança de
> tipo nem de tela; e ela não dispara em nenhum cenário versionado. **A `T-2287` confirma as três
> coisas** — se qualquer uma cair, a suíte de navegador entra e este parágrafo sai.

**Verificação:** `P4`. **Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5
P0     P0     P1     P2     P3     P4

F2  o critério muda e NADA muda           ← o portão mais forte do plano
F3  as três páginas do PGM somem          ← a única reancoragem da entrega
F4  a planilha trocada volta a ter voz    ← sem ela, F3 entrega um silêncio
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~2h30 de trabalho, mais três execuções de suíte completa (`T-2284`, `T-2294`, `T-2310`) e as renderizações de PGM que os portões `P1` e `P2` exigem |

**A `F4` pode ficar bloqueada por `I-01`.** Se a decisão demorar, `F0` a `F3` entregam sozinhas — mas
**não devem ser commitadas sozinhas**: é o primeiro risco do §5.

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| **Entregar a omissão sem o achado**, e trocar ruído por silêncio | Nada automático pega isso — é decisão humana, e por isso está no §1, na `F4` e aqui. A regra é: `F3` não vai para `main` sem `F4` |
| **Um anexo com conteúdo classificado como vazio** e omitido em silêncio | `T-2296` e `T-2301`: o `PACOTE_DO_PILOTO`, 19 anexos e 15.955 células. É o único oráculo dessa falha |
| A `F2` mudar documento e alguém atribuir isso à `F3` | As duas são fases separadas com portões separados. `P1` roda com a `F3` inexistente |
| Reancorar o PGM sem saber o tamanho do delta | `T-2302`, a prova por desligamento. Reancoragem sem ela reprova a revisão |
| **Perder tabela junto com as seções** — omitir um anexo que tinha conteúdo | `T-2300`: 34 tabelas antes, 34 depois. Seção é página; tabela é conteúdo |
| Filtrar os vazios dentro do `AnexoReader` | §1, `D-03`, e o `T-2292` com 18 vazios: movido para o leitor, aquele teste não é escrevível |
| A frase sobreviver em algum canto | `T-2304` — a busca por `"não trouxe conteúdo"` na suíte inteira, e não só o teste conhecido |
| Medir o "antes" numa árvore com a ESPEC 035 dentro | `T-2283`, e §7 |
| Colidir com a edição da 035 no `README.md` | `T-2313`: seções diferentes do mesmo arquivo, editadas conscientemente. Um `git diff` do README antes de commitar |
| `V-ANX-01` virar ruído mensal | `T-2292` (cala com 18) e a decisão de `I-01`. Se `I-01` reverter `D-04`, o risco é aceito com os olhos abertos |

---

## 6. O que este plano não faz

- **Não toca o `AnexoReader`** (`D-03`). Os 19 anexos continuam sendo lidos.
- **Não toca `anexos.json`** nem acrescenta aba nenhuma ao catálogo. As abas `Alta Plataforma`,
  `Impressao` e `ETL` do PGM continuam fora — é o `I-03` da espec, e é espec própria.
- **Não altera `_tem_conteudo`** (`R-BRD-02` da ESPEC 014). Ele é reusado exatamente como está.
- **Não altera largura, corpo, corte, ordem ou grade de nenhum anexo com conteúdo** (`R-VAZ-05`).
- **Não bloqueia geração nenhuma** (`D-05`). `V-ANX-01` é `AVISA`, e `bloqueado` não muda de valor
  em cenário nenhum.
- **Não toca o `frontend/`** nem os esquemas da API (§3, `F5`).
- **Não reancora nada além do `PACOTE_DO_PGM`** — e esse com a prova da `T-2302`.

---

## 7. A árvore não está limpa, e a régua desta entrega é justamente o que a 035 prometeu não mover

É o ponto de operação mais afiado deste plano, e ele não aparece em nenhum arquivo que a ESPEC 036
vai editar.

```
HEAD 24acc9e ──► árvore de trabalho ──► esta entrega
                 └─ ESPEC 035 dentro:  grid.py, pdfplumber_extractor.py,
                    contract_validations.py, contract.py, README, CHANGELOG
                    + test_palavras_fora_da_grade.py
```

**Sobreposição de arquivo: zero.** A ESPEC 036 mexe em `annex.py`, `docx_renderer.py`,
`annex_validations.py` (novo) e `container.py`. Nenhum deles está modificado hoje.

**Sobreposição de âncora: total.** Os quatro pacotes byte a byte são a régua desta entrega, e são
exatamente o que a ESPEC 035 declara não ter movido (*"não-regressão integral… nenhum artefato
reancorado"*). A declaração é provavelmente verdadeira e **não serve como linha de base**: linha de
base é medição na árvore em que se vai trabalhar. Daí a `T-2283`.

**Se a `T-2283` reprovar** — algum pacote diferente das constantes do arquivo —, esta entrega
**para** antes da `F1`. Não se corrige a 035 dentro do PLANO 036; registra-se o achado, resolve-se
lá, e a `F0` recomeça.

**A prova por desligamento da `T-2302`, em ordem:**

1. com a `F3` entregue, medir `PACOTE_DO_PGM` → valor novo, e guardá-lo;
2. desfazer **só** as duas linhas da `F3` (o pulo em `_anexos`) e **só** a `F2` (`vazio`), sem tocar
   testes → medir de novo;
3. o pacote tem de voltar **entrada por entrada** ao valor da `T-2283`;
4. refazer a `F2` e a `F3`, conferir que o valor novo do passo 1 volta, e só então escrever a
   constante.

Duas renderizações de PGM a mais, ~4 min. É o preço de trocar um hash com a justificativa que o
cabeçalho de `test_identidade_dos_artefatos.py` exige — e o mesmo procedimento que a ESPEC 028 usou
quando trocou dois.

**E o `README.md` é editado pelas duas entregas, em seções diferentes.** A 035 escreveu na
§"Limitações conhecidas" sobre o descarte da grade; a 036 remove, da mesma seção, o parágrafo das
dezenove páginas. Editar sem ler o que a 035 pôs ali é como se perde um parágrafo alheio num `git
add -A`.

---

## 8. O inventário, e as buscas

Sobre `backend/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 1 | `vazio`, `_anexo_vazio`, `não trouxe conteúdo` | tudo que afirma o comportamento de hoje | `docx_renderer.py:405,433-450`; `test_docx_anexos.py:299-311`; `README.md:325`. **Três lugares, e o do README é prosa** — a `T-2304` fecha os da suíte |
| 2 | `SECOES_ANTES_DOS_ANEXOS`, `TABELAS_ANTES_DOS_ANEXOS`, `2 + 19` | quem conta seções e tabelas | `test_docx_anexos.py:29,32,143` e `test_api_e2e.py:105`. **Os dois usam o piloto**, que não tem anexo vazio: passam sem alteração. É hipótese verificada por leitura — confirmar na execução |
| 3 | `PACOTE_DO_`, `ANALISE_DO_`, `partes(` | as âncoras byte a byte | `test_identidade_dos_artefatos.py`, `pacote.py`. É a régua (§7) |
| 4 | `documento_do_pgm`, `artefatos_do_pgm`, `docx_do_piloto` | quem já paga renderização de sessão | `conftest.py:416+`, `test_capa.py`, `test_identidade_dos_artefatos.py`, `test_docx_formatacao.py`. **Nenhuma renderização nova é criada** por esta entrega |
| 5 | `Anexo(` construído à mão | quem quebraria com mudança de campo | `test_docx_anexos.py`, `test_desempenho.py:100-113`. O de desempenho monta anexo **com conteúdo** e chama `_tabelas_do_anexo` direto: não é alcançado por nenhuma das duas mudanças |
| 6 | `PERGUNTA`, `Severity.` | a guarda da `T-2094` | `test_identidade_contratual.py:388`. Varre **três** módulos nomeados; o arquivo novo não entra na lista (`F4`, `T-2309`) |
| 7 | `anexos` em `application/`, `api/` | quem mais consumiria `Report.anexos` | Só o `DocxRenderer` (ESPEC §2.6). Confirmar que continua só ele |

Sobre `frontend/`:

| # | Busca | O que acha | O que já se sabe |
|---|---|---|---|
| 8 | `Achado`, `severidade`, `AVISA` | se a tela precisa conhecer a validação nova | `src/lib/types.ts:3-7` — `validacao: string`, severidade em união de literais. **Genérico: nada a fazer.** É o que autoriza não rodar a suíte de navegador (`F5`) |
| 9 | `anexo`, `não trouxe` | asserção de tela sobre anexos | `e2e/identidade.spec.ts:20` (comentário) e `LinhasDerivadas.tsx:104` (**outra** frase, da ESPEC 021 — *"a planilha não trouxe um número"*). **Nenhuma asserção**. A semelhança das duas frases é a armadilha desta busca |

**O resultado das nove manda na tabela da ESPEC §8.3**, e não o contrário.

> **A busca 9 é a que engana.** `LinhasDerivadas.tsx` tem uma frase quase igual à que esta entrega
> apaga, de outra espec e sobre outra coisa. Uma substituição por texto no repositório inteiro a
> alcançaria, e o vermelho apareceria na suíte de navegador — que este plano decidiu não rodar. A
> busca sozinha não decide; abrir o arquivo decide.

---

## 9. Emenda de execução

*A preencher na execução, com o que o plano não previu.*
