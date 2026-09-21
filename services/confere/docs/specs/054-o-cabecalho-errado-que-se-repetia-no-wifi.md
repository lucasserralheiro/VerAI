# ESPEC 054 — O cabeçalho errado que se repetia no WIFI

| | |
|---|---|
| **Status** | **Implementada** — 2026-09-10. `WIFI` ganhou `cabecalhos_adicionais` em `anexos.json`; sonda e teste ponta a ponta confirmados por caracterização. Backend **1.626 → 1.627 passed, 0 failed** (1641,37s), `ruff check` e `mypy src/` limpos. Moveu deliberadamente o `.docx` do **piloto** — `word/document.xml` foi a única entrada a se mover — e `test_identidade_dos_artefatos.py` foi reancorado, com o delta provado por desligamento. **Achado real na execução:** o PGM não moveu — a aba `WIFI` do PGM tem layout de colunas diferente (sem `TIPO de TC`) e só 8 linhas de dado, então a âncora nova não resolve lá e a tabela nem estoura página; o PGM não tem o defeito hoje |
| **Versão** | 1.1 — 2026-09-10 |
| **Depende de** | [ESPEC 037](037-a-linha-de-dados-que-virou-cabecalho.md) `R-CAB-01` a `R-CAB-06` — a localização de cabeçalho por rótulos; [ESPEC 051](051-o-cabecalho-que-ficou-pequeno-para-a-tabela.md) `R-SEG-01` a `R-SEG-07` — o mecanismo de âncoras adicionais e cortes múltiplos, que esta espec **usa sem alterar**; [ESPEC 026](026-o-mesmo-documento-em-um-quinto-do-tempo.md) `R-DES-01` — identidade byte a byte do `.docx` |
| **Revisa** | `R-SEG-07`: o conjunto de anexos com `cabecalhos_adicionais` passa de `{Servidores, ServidoresSemDesenv}` para `{Servidores, ServidoresSemDesenv, WIFI}` |
| **Não toca** | `Anexo.cortes`, `_faixa_de_tabelas`, `forma_do_bloco`, `localizar_cabecalho`, `ooxml.py` — o mecanismo inteiro da ESPEC 051 já resolve este caso, sem precisar de uma linha de código nova. `NAS` e `OutrosServicos` — o mesmo tipo de lacuna (`I-01` da ESPEC 037, `D-05` da ESPEC 051), mas **sem defeito visível hoje** (§2.4), e continuam fora, pela mesma razão que já estavam |
| **Referência normativa** | Duas capturas de tela reais anexadas em conversa (aba `WIFI`, contrato SMIT Sustentação): o `.docx` gerado e a planilha de levantamento; medição direta da aba com `openpyxl`; renderização real com a configuração proposta, conferida célula a célula |
| **Origem** | Print real anexado em conversa: ao quebrar página no meio da tabela `TIPO de TC`, o cabeçalho repetido no topo da página nova mostra `Unidade \| Quantidade Medida` — o cabeçalho do resumo, não o da própria tabela |

---

## 1. Problema

**A aba `WIFI` tem dois cabeçalhos de coluna — um para o resumo, outro para a tabela de equipamentos — e só o primeiro está declarado em `anexos.json`. Quando a tabela de equipamentos (21 linhas) estoura a página, o Word repete o único cabeçalho que conhece: o do resumo, que não corresponde às colunas da tabela que está sendo mostrada.**

## 2. O que foi levantado no código

### 2.1 A aba tem dois cabeçalhos, medidos diretamente

```
Linha 5  (1-based): 'Unidade' | 'Quantidade Medida'                           — cabeçalho do resumo
Linha 10 (1-based): 'Seq' | 'TIPO de TC' | 'Cod.Produto' | 'Recurso' | 'Cliente'
                     | 'Número de Série' | 'Mac Address' | 'Unidade'
                     | 'Data Instalação - Endereço' | 'CONTRATO'              — cabeçalho da tabela larga
```

`anexos.json` só declara o primeiro:

```json
{"aba": "WIFI", "corpo": 5.8, "linha_cabecalho": 5, "cabecalho": ["Unidade", "Quantidade Medida"]}
```

### 2.2 O efeito no renderizador

Sem uma segunda âncora, `Anexo.cortes` produz **um corte só**, na linha 5 (0-based: 4). Tudo da
linha 5 até o fim da aba — resumo **e** tabela larga — sai como uma única tabela no `.docx`, com a
linha 5 marcada `w:tblHeader`. Confirmado renderizando o documento real com a configuração atual:
a tabela de `WIFI` sai com **26 linhas numa tabela só**, e a única fileira marcada é a do resumo
(`Unidade | Quantidade Medida`). A linha 10 (`Seq | TIPO de TC | ...`) é uma linha de dado comum,
sem marca — e é o que o Word repete quando **não** há nada marcado mais próximo: a marca que existe,
que é a errada.

### 2.3 O mecanismo que resolve — já existe, não é novo

A ESPEC 051 generalizou exatamente este caso: um anexo pode declarar `cabecalhos_adicionais`, cada
entrada resolvida por `localizar_cabecalho` (a mesma função de sempre) e virando seu próprio corte,
com sua própria marca. Testado, sem alterar nenhuma linha de código, acrescentando em memória
`cabecalhos_adicionais=(("Seq", "TIPO de TC", "Cod.Produto"),)` à configuração de `WIFI` e
renderizando o documento inteiro:

```
Antes:  1 tabela para WIFI — 26 linhas, 1 marca ("Unidade | Quantidade Medida")
Depois: 3 tabelas para WIFI — título (4), resumo (5, marca "Unidade | Quantidade Medida"),
        tabela larga (22, marca "Seq | TIPO de TC | Cod.Produto | ... | CONTRATO")
```

A âncora nova (`Seq`, `TIPO de TC`, `Cod.Produto`) casa em **uma única linha** da aba — confirmado —,
e não colide com a âncora do resumo (que começa por `Unidade`, não por `Seq`).

### 2.4 Por que isto não é o mesmo caso de `NAS`/`OutrosServicos`

A ESPEC 051 (`D-05`) deixou `NAS` e `OutrosServicos` de fora deliberadamente: os dois têm cabeçalho
secundário não marcado, mas **sem defeito visível** — o bloco correspondente nunca estoura página, e
o texto sai certo mesmo sem a marca de repetição. `WIFI` é diferente: a tabela larga tem 21 linhas de
dado e **estoura a página no piloto**, e é aí que a ausência de marca troca de "cosmético" para
"cabeçalho visivelmente errado". A distinção é a mesma que a própria ESPEC 051 já registrou como
critério — resolver `NAS`/`OutrosServicos` continua sendo decisão própria, sem o defeito que motive.

## 3. Objetivo

Que a tabela `TIPO de TC` da aba `WIFI` repita o **seu próprio** cabeçalho de colunas ao quebrar
página, em vez do cabeçalho do resumo.

**Não é objetivo:** estender `cabecalhos_adicionais` a `NAS` ou `OutrosServicos` (`§2.4`); alterar o
mecanismo da ESPEC 051; medir ou mudar larguras — `medidas_grc.json` já traz as 10 larguras da
tabela larga, e elas já são usadas hoje (o defeito é de marcação de cabeçalho, não de geometria).

## 4. Escopo

### 4.1 Dentro do escopo

- `anexos.json`: a entrada de `WIFI` ganha `cabecalhos_adicionais: [["Seq", "TIPO de TC", "Cod.Produto"]]`.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Qualquer mudança em `annex.py`, `anexo_reader.py`, `docx_renderer.py`, `ooxml.py`, `cabecalho.py` | O mecanismo da ESPEC 051 já resolve o caso, verificado por experimento (`§2.3`) |
| `NAS`/`OutrosServicos` | `I-01` da ESPEC 037, `D-05` da ESPEC 051 — decisão própria, sem o defeito visível que motive (`§2.4`) |
| `medidas_grc.json` de `WIFI` | As 10 larguras já cobrem a tabela larga; não medido como incorreto |

## 5. Regras

| ID | Regra |
|---|---|
| `R-WIFI-01` | `WIFI` passa a declarar a âncora adicional `["Seq", "TIPO de TC", "Cod.Produto"]`, resolvida pelas mesmas `R-CAB-01` a `R-CAB-04` que a âncora primária já usa |
| `R-WIFI-02` | **Invariante de não regressão:** os outros 18 anexos — incluindo `Servidores`/`ServidoresSemDesenv`, que já têm âncora adicional — não mudam. Só a entrada de `WIFI` em `anexos.json` é tocada |

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Configuração, não código** | O mecanismo (`R-SEG-01` a `R-SEG-07`) já existe e já é genérico — a ESPEC 051 foi desenhada para exatamente este tipo de caso futuro. Escrever código novo duplicaria o que já está testado |
| `D-02` | **Não estender a `NAS`/`OutrosServicos` nesta entrega** | Critério já registrado (`D-05` da ESPEC 051): mudar um resultado hoje correto por um ganho cosmético, sem o defeito que motive, é decisão própria e separada — `WIFI` tem o defeito, os outros dois não |
| `D-03` | **A âncora usa três rótulos (`Seq`, `TIPO de TC`, `Cod.Produto`), não só o primeiro** | `Seq` sozinho é rótulo curto e genérico; três rótulos consecutivos reduzem o risco de casar com uma linha de dado por acidente numa planilha de outro órgão (o piloto tem só uma ocorrência de qualquer um dos três, mas a submissão real de outra secretaria pode ter uma coluna "Seq" solta em outra tabela) |

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/annex/anexos.json` | Entrada de `WIFI` ganha `cabecalhos_adicionais: [["Seq", "TIPO de TC", "Cod.Produto"]]` |
| `tests/test_anexos_configuracao.py` | Caso novo: `cabecalhos_adicionais` de `WIFI` não vazio, dos outros 18 (exceto `Servidores`/`ServidoresSemDesenv`) vazio |
| `tests/test_docx_anexos.py` ou `test_cabecalho_do_anexo.py` | Caso novo: a fileira marcada da tabela larga de `WIFI` bate com o cabeçalho `Seq \| TIPO de TC \| ...`, não com o do resumo |
| `tests/test_identidade_dos_artefatos.py` | Reancoragem esperada — `WIFI` está no piloto, e a mudança de 1 para 3 tabelas move `word/document.xml` |
| `annex.py`, `anexo_reader.py`, `docx_renderer.py`, `ooxml.py`, `cabecalho.py`, `medidas_grc.json` | **Nenhuma** |

## 8. Testes e critério de aceite

| Verificação | Como |
|---|---|
| `R-WIFI-01` | Sonda sem renderizar (`AnexoReader().ler(...)`): `WIFI.cortes == (4, 9)` (0-based) |
| Ponta a ponta | `WIFI` sai em 3 tabelas; a fileira `w:tblHeader` da tabela larga tem os rótulos de `Seq \| TIPO de TC \| ...`, não os de `Unidade \| Quantidade Medida` |
| `R-WIFI-02` | Os outros 18 anexos com a mesma contagem de tabela e a mesma fileira marcada de antes — suíte completa sem falha não explicada pela reancoragem |

**Critério de aceite:** `WIFI` sai em 3 tabelas com o cabeçalho certo em cada uma; nenhum outro
anexo muda; a suíte completa roda sem falha não explicada pela reancoragem de identidade.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| `word/document.xml` do piloto (e possivelmente do PGM, se a planilha real também tiver a mesma estrutura) muda de hash | **Confirmado só no piloto** — medido na execução: a aba `WIFI` do PGM tem layout de colunas diferente (sem `TIPO de TC`) e só 8 linhas, a âncora não resolve lá e a tabela não estoura página. Reancorado só o piloto, com o delta provado por desligamento (`I-01`) |
| A âncora nova casar com uma linha de dado, em outra submissão, por coincidência | `D-03` — três rótulos consecutivos, não um só; e o comportamento de `R-CAB-04` (âncora não encontrada ⇒ sem repetição) já protege contra pior caso: uma âncora que nunca resolve não quebra o anexo, só deixa de marcar |
| Confundir esta entrega com o `I-01` da ESPEC 037 e estender a `NAS`/`OutrosServicos` de passagem | `D-02`, e a checagem de escopo no fechamento — qualquer `git diff` em anexo diferente de `WIFI` é sinal de vazamento |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | O PGM (e submissões futuras de outras secretarias) pode ter a mesma tabela `TIPO de TC` estourando página, sob um layout de colunas diferente do piloto — a âncora `["Seq", "TIPO de TC", "Cod.Produto"]` não a alcançaria. Vale generalizar a âncora, ou aguardar um caso real? | Não — medido que o PGM de hoje não tem o defeito (`§9`, achado na execução); generalizar sem um caso real seria adivinhação |

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `anexos.json` + testes novos | PP |
| B | Suíte completa, reancoragem se necessária | PP |

**Estimativa: menos de uma hora** — é uma linha de configuração, com o mecanismo já pronto.

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-09-10 | Redação inicial, a partir de duas capturas de tela reais (aba `WIFI`, contrato SMIT Sustentação) e de verificação por experimento (configuração alternativa em memória, sem tocar o repositório) |
| 1.1 | 2026-09-10 | Implementada: `cabecalhos_adicionais` gravado em `anexos.json`, com testes de sonda e ponta a ponta, confirmados por caracterização. Backend 1.626 → 1.627 passed, 0 failed; `word/document.xml` reancorado **só no piloto** — achado na execução: o PGM não tem o defeito (layout de colunas diferente, tabela não estoura página), registrado como `I-01` |
