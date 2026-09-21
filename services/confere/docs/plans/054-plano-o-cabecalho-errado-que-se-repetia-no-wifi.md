# PLANO 054 — Implementação de "O cabeçalho errado que se repetia no WIFI"

| | |
|---|---|
| **Especificação** | [ESPEC 054](../specs/054-o-cabecalho-errado-que-se-repetia-no-wifi.md) v1.1 |
| **Versão** | 1.1 — 2026-09-10 — **executado** em 2026-09-10/11. Todos os quatro portões fechados; achado na execução: o PGM não tinha o defeito, e só o piloto foi reancorado (`§6`) |
| **Estado inicial** | Ramo `feature/evolucao`. **1.626 testes coletados**. `word/document.xml`: piloto `5a0c4fd5…`, PGM `6dd36e33…` |
| **Colisão conhecida** | A árvore carrega a implementação da ESPEC 053, testada e verde, ainda não commitada. Este plano soma-se a ela |
| **Numeração de tarefas** | `T-27nn`, continuando de `T-2796` — começa em `T-2797` |

---

## 1. O que este plano tem de diferente

> **É configuração, não código — o portão principal é a sonda, não o renderizador.** A causa e a
> correção já foram verificadas por experimento na própria ESPEC (§2.3), em memória, sem tocar o
> repositório. O que falta é gravar essa mesma configuração em `anexos.json` e travá-la com teste,
> não descobrir nada novo.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Linha de base** | Fim da `F0` | `1.626` coletados; hashes atuais registrados | Régua de outra árvore não serve |
| **P1 — A âncora, provada sem renderizar** | Fim da `F1` | `AnexoReader().ler(...)`: `WIFI.cortes == (4, 9)` (0-based); os outros 18 anexos com `cortes` idêntico ao de hoje | Reverter |
| **P2 — O documento, com o cabeçalho certo em cada tabela** | Fim da `F2` | `WIFI` sai em 3 tabelas; a fileira marcada da tabela larga tem os rótulos de `Seq \| TIPO de TC \| ...`; a do resumo continua com `Unidade \| Quantidade Medida` | Reverter |
| **P3 — O conjunto, com a reancoragem se necessária** | Fim da `F3` | Suíte completa verde, **≥ 1.626** mais os testes novos; `ruff`/`mypy` limpos; `git diff --stat` restrito a `anexos.json` e aos testes do inventário | Não entregar |

---

## 3. Fases

### F0 — Preparação `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2797 | Confirmar `1.626` coletados e os hashes atuais de `word/document.xml` | **P0** |

**Tamanho:** PP — cinco minutos.

---

### F1 — A âncora em `anexos.json`, provada sem renderizar `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2798 | `anexos.json`: entrada de `WIFI` ganha `cabecalhos_adicionais: [["Seq", "TIPO de TC", "Cod.Produto"]]` | `R-WIFI-01` |
| T-2799 | Teste novo em `test_anexos_configuracao.py`: `cabecalhos_adicionais` de `WIFI` não vazio; dos outros 18 (exceto `Servidores`/`ServidoresSemDesenv`) vazio | `R-WIFI-02` |
| T-2800 | **[portão]** Sonda sem `Document`: `AnexoReader().ler(...)` — `WIFI.cortes == (4, 9)`; os outros 18 com `cortes` idêntico ao de antes de `T-2798` | **P1** |

**Tamanho:** PP — vinte minutos.

---

### F2 — O documento, cabeçalho certo por tabela `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2801 | Teste novo (`test_docx_anexos.py` ou `test_cabecalho_do_anexo.py`): `WIFI` sai em 3 tabelas; a fileira `w:tblHeader` da tabela larga tem os rótulos `Seq \| TIPO de TC \| Cod.Produto \| ...`; a do resumo, `Unidade \| Quantidade Medida` | `R-WIFI-01` |
| T-2802 | **[portão]** `T-2801` verde | **P2** |

**Tamanho:** PP — vinte minutos.

---

### F3 — Fechamento, com reancoragem condicional `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-2803 | Suíte de backend completa; `ruff check`/`mypy src/` | **P3** |
| T-2804 | Se `test_identidade_dos_artefatos.py` reprovar (esperado — `WIFI` está no piloto): confirmar que só `word/document.xml` muda; prova por desligamento (revertendo `T-2798`, os pacotes voltam aos hashes de `T-2797`); reancorar com o parágrafo de justificativa | **P3**, `R-DES-01` |
| T-2805 | Suíte completa reexecutada, se `T-2804` rodou | **P3** |
| T-2806 | `git diff --stat`: restrito a `anexos.json` e aos três arquivos de teste do inventário — nenhum outro anexo, nenhum arquivo de produção fora de `anexos.json` | **P3** |
| T-2807 | Status da ESPEC 054 (Proposta → Implementada); "Incremento 054" em `README.md`; entrada em `CHANGELOG.md` | — |

**Tamanho:** PP — vinte minutos, mais o tempo da suíte.

---

## 4. O que este plano não faz

- **Não estende `cabecalhos_adicionais` a `NAS`/`OutrosServicos`** — `D-02` da ESPEC.
- **Não toca `medidas_grc.json` de `WIFI`** — as larguras já cobrem a tabela larga.
- **Não commita nada por conta própria.**

---

## 5. Esforço

| Fase | Tamanho |
|---|---|
| F0 | PP |
| F1 | PP |
| F2 | PP |
| F3 | PP |

**Estimativa: menos de uma hora**, mais o tempo de suíte completa (~20-25min).

---

## 6. Emenda de execução

Todos os quatro portões fecharam na ordem prevista. Um achado real na `F3`, fora do previsto:

**Só o pacote do piloto moveu — o PGM não.** A suíte completa reprovou apenas
`test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre`; `test_o_docx_do_pgm_e_byte_a_byte_o_de_sempre`
passou de primeira. Investigado: a aba `WIFI` do PGM (`levantamento_pgm.xlsx`) tem a tabela larga
com um layout de colunas diferente do piloto — `Seq | Recurso | Cliente | Número de Série | Mac
Address`, **sem** a coluna `TIPO de TC` —, e só 8 linhas de dado. A âncora
`["Seq", "TIPO de TC", "Cod.Produto"]` não casa com o prefixo dessa linha (`R-CAB-03`: prefixo, não
igualdade — "seq" bate, "recurso" ≠ "tipo de tc"), então `R-CAB-04` se aplica: sem âncora
encontrada, sem corte, sem mudança. E mesmo que casasse, 8 linhas não estourariam página no corpo
de `WIFI` (5,8pt) — o PGM não tem o defeito visível hoje, então não ter mudado é o resultado
correto, não uma lacuna. Registrado como `I-01` da própria ESPEC 054, não como pendência deste
plano.

A reancoragem (`T-2804`) foi ajustada para **um pacote só** — o mesmo padrão das reancoragens
036/037 (que também moveram só o PGM, na direção oposta), adaptado ao caso onde é o piloto que se
move e o PGM que fica parado.

**Números finais**, medidos nesta árvore:

| Medição | Valor |
|---|---|
| `WIFI.cortes`, antes/depois (0-based) | `(4,)` → `(4, 9)` |
| Suíte completa, antes da reancoragem | 1.626 passed, **1 failed** (só piloto — achado, `§6`) |
| Suíte completa, depois da reancoragem | **1.627 passed, 0 failed**, 1641,37s (0:27:21) |
| `ruff check` / `mypy src/`, arquivos tocados | Limpos (a checagem inicial incluiu por engano `anexos.json` no `ruff check` — `.json` não é Python; refeita só nos `.py` tocados) |
| `word/document.xml` — piloto | `5a0c4fd5…` → `53e23d39…` |
| `word/document.xml` — PGM | `6dd36e33…` — **inalterado** |
| `git diff --stat` (arquivos desta entrega) | `anexos.json`, `test_anexos_configuracao.py`, `test_docx_anexos.py`, `test_identidade_dos_artefatos.py` — nenhum arquivo fora do inventário |

A prova por desligamento (`T-2804`) reverteu só `cabecalhos_adicionais` de `WIFI` em `anexos.json`
e confirmou, rodando os quatro testes de `test_identidade_dos_artefatos.py`, que os dois pacotes
voltam aos hashes anteriores (`5a0c4fd5…` piloto, `6dd36e33…` PGM) antes de qualquer hash ser
trocado.

Uma interrupção sem consequência: a sessão foi reiniciada no meio da primeira tentativa de `T-2803`
(a suíte completa), sem nenhum resultado capturado — refeita do zero, sem perda de código.
