# TASKS 003 — Backlog do Relatório em DOCX

| | |
|---|---|
| **Especificação** | [ESPEC 003](../specs/003-relatorio-em-docx.md) |
| **Plano** | [PLANO 003](../plans/003-plano-relatorio-em-docx.md) |
| **Versão** | 1.0 — 2026-08-06 |
| **Total** | 26 tarefas · 3 insumos |
| **Status** | **Concluído** — 26 tarefas, 3 portões fechados |

> **Escrito antes da implementação**, ao contrário do TASKS 002. O desvio de processo registrado
> naquele documento não se repete aqui.

---

## 1. Convenções

**Identificadores** `T-2nn` seguem a numeração do PLANO 003. `J-nn` são insumos do solicitante.

**Definição de pronto de qualquer tarefa:** código e teste na mesma entrega; `ruff`, `mypy` e
`pytest` verdes; comentário explicando o *porquê* onde a escolha não for óbvia.

**Convenção de commit** `<tipo>(T-2nn): descrição`.

**Regra que atravessa o backlog:** se alguma tarefa exigir mudar `domain/`, `application/` ou
`infrastructure/validations/`, **pare**. O port `IReportRenderer` existe para que esta troca seja de
adaptador; mexer nessas camadas é sinal de que algo foi entendido errado.

---

## 2. Quadro geral

| Épico | Tarefas | Portão | Situação |
|---|---|---|---|
| **E0** A rede antes da obra | T-201 … T-204 | — | ✅ |
| **E1** Esqueleto do documento | T-205 … T-208 | **P1** | ✅ fechado |
| **E2** O conteúdo ⚠️ | T-209 … T-215 | **P2** | ✅ fechado |
| **E3** API e interface | T-216 … T-218 | **P3** | ✅ fechado, `J-02` aprovado |
| **E4** Remoção do ReportLab | T-219 … T-222 | irreversível | ✅ |
| **E5** Documentação | T-223 … T-226 | — | ✅ |

**Ponto de não retorno:** E4. Antes dele, reverter é apagar um arquivo novo.

### Resultado

| O que | Resultado |
|---|---|
| Teste-âncora sobre o DOCX | **54 de 55 linhas idênticas** ao GRC |
| Pacote gerado | 39 partes, 7 fontes, 3 imagens — nada perdido |
| Capa | idêntica ao modelo, caractere a caractere |
| Seções | retrato 21,0 × 29,7 e paisagem 29,7 × 21,0 |
| Suíte | 224 testes de backend, 2 de navegador |
| **Domínio, aplicação e validações** | **um comentário alterado** — a aposta do plano se confirmou |

### Desvios

| Tarefa | O que mudou | Por quê |
|---|---|---|
| **T-221** | Antecipada para o E2 | O `layout.py` precisava perder a dependência de ReportLab antes de o DOCX usar as cores |
| **T-211** | A descrição ficou 24 pt mais estreita que no GRC | A margem interna das células empurrava a tabela para fora da área útil. Só a descrição cede — as outras quatro não quebram linha |
| **T-214** | Exigiu normalizar o pacote inteiro | Um DOCX é um ZIP, e o ZIP grava a hora em cada entrada |
| — | Cinco correções vindas da conferência visual | Ver abaixo |

### O que só a conferência visual pegou

Nenhum destes quebrava teste — todos tinham as 55 linhas corretas. É a razão de
`J-02` estar marcado como o insumo que não pode faltar.

| Defeito | Causa |
|---|---|
| Página em branco entre capa e tabela | O modelo tem uma folha timbrada em branco, para preenchimento à mão |
| Coluna "Quantidade Medida" cortada | Margem interna de célula: 108 twips por lado × 5 colunas = 1,9 cm |
| Colunas desproporcionais | O `w:gridCol` ficava uniforme; só o `w:tcW` recebia as medidas |
| Timbrado torto na paisagem | No modelo o cabeçalho é ancorado à direita e o rodapé à esquerda |
| Faixa navy cobrindo linha demais | No GRC as linhas de rótulo têm navy só nas colunas de quantidade |
| Borda faltando no bloco de título | O divisor entre as duas linhas para em x=681 |

O padrão comum: **supor a estrutura em vez de medir**. As medidas sempre
estiveram disponíveis no PDF do GRC, e cada correção feita a partir de medição
fechou de primeira.

---

## 3. Épico E0 — A rede antes da obra

> Nenhum comportamento muda neste épico. É a rede de segurança mudando de forma para caber nos dois
> formatos, **antes** de qualquer coisa ser substituída.

#### T-201 — Modelo como recurso versionado
**Tamanho:** P · **Ref:** `R-DOC-01`

Copiar `Papel de Carta e Capa de Apostila.docx` para
`backend/src/infrastructure/report/modelo_prodam.docx`. Vive dentro de `src/`, pelo mesmo motivo do
catálogo padrão: acompanha o código no container e no deploy.

**Pronto quando:** o arquivo está versionado e um teste o abre com `python-docx` sem erro.

---

#### T-202 — Leitor de tabela de DOCX para os testes
**Tamanho:** M · **Depende de:** T-201

Em `backend/tests/`, uma função que extrai as linhas da tabela de um `.docx` na **mesma forma** que o
leitor de PDF já produz — a dataclass `Linha` com código, descrição, unidade, contratada e medida.

Ler DOCX é mais direto que ler PDF: o conteúdo já vem em células, sem depender de extração por
coordenada.

**Pronto quando:** dado um `.docx` com uma tabela conhecida, devolve as linhas na mesma estrutura que
o leitor de PDF.

---

#### T-203 — Teste-âncora parametrizado por renderizador
**Tamanho:** M · **Depende de:** T-202 · **Ref:** PLANO §1

Reescrever `test_anchor_fidelity.py` para receber o renderizador como parâmetro, mantendo **o PDF
como único caso hoje**. A comparação contra as páginas 2–3 do GRC não muda.

**Pronto quando:** o teste-âncora continua em **54 de 55 linhas idênticas** no PDF, agora por um
caminho que aceita um segundo renderizador sem alteração estrutural.

---

#### T-204 — Teste do recurso
**Tamanho:** P · **Depende de:** T-201

**Pronto quando:** um teste confirma que o modelo está no pacote, tem 39 partes e contém as 7 fontes
e as 3 imagens.

**Verificação do épico:** os 197 testes seguem verdes. Nada mudou de comportamento.

---

## 4. Épico E1 — Esqueleto do documento

#### T-205 — `DocxRenderer`
**Tamanho:** M · **Depende de:** T-201 · **Ref:** `R-DOC-01`

`infrastructure/report/docx_renderer.py`, implementando `IReportRenderer`. Abre uma **cópia** do
modelo — nunca monta o documento do zero, sob pena de perder as fontes embutidas.

**Pronto quando:** gera um `.docx` que abre no Word, ainda sem conteúdo de tabela.

---

#### T-206 — Seção paisagem
**Tamanho:** M · **Depende de:** T-205 · **Ref:** `R-DOC-03`, `R-DOC-04`

Quebra de seção após a capa; nova seção em 29,7 × 21,0 cm, margens laterais de **1,4 cm**, topo e
base herdados da capa.

**Pronto quando:** a largura útil da seção paisagem é **26,9 cm** — exatamente a soma das larguras de
coluna em `layout.py`. Um teste afirma a igualdade, e não uma aproximação.

---

#### T-207 — Timbrado herdado
**Tamanho:** P · **Depende de:** T-206 · **Ref:** `R-DOC-05`

**Pronto quando:** a seção paisagem não declara `headerReference` nem `footerReference` próprios — ela
herda por vínculo com a anterior, e o pacote não ganha recurso duplicado.

---

#### T-208 — Testes de preservação `[portão]`
**Tamanho:** M · **Depende de:** T-207 · **Ref:** `R-DOC-02`, **P1**

| O que afirmar | Valor |
|---|---|
| Partes do pacote | 39 |
| Fontes embutidas | 7 |
| Imagens | 3 |
| Cabeçalho e rodapé | presentes |
| Seções | 2 — retrato e paisagem |
| Texto das 3 caixas da capa | **idêntico** ao do modelo |

O teste da capa compara o texto das caixas caractere a caractere, incluindo
`GERÊNCIA DE OPERAÇÕESPA-SMIT-260319-739`. A capa é reproduzida como está, e o teste guarda isso.

**Pronto quando:** todas as afirmações acima passam. **Encerra o portão P1.**

**Verificação do épico:** abrir o documento no Word mostra a capa idêntica ao modelo e uma segunda
página em branco, com timbrado, em paisagem.

---

## 5. Épico E2 — O conteúdo ⚠️ caminho crítico

#### T-209 — Bloco de título
**Tamanho:** M · **Depende de:** T-208

Título, data do levantamento e contrato de referência, no topo da seção paisagem, como no PDF.

**Pronto quando:** o texto sai idêntico ao do PDF atual.

---

#### T-210 — Faixas de grupo e seção
**Tamanho:** M · **Depende de:** T-209 · **Ref:** `R-DOC-06`

Faixa de grupo quando houver, faixa de seção, e o **cabeçalho de colunas repetido a cada seção**.

**Pronto quando:** as 22 seções saem na ordem do catálogo, com os títulos corretos.

---

#### T-211 — Tabela de cinco colunas
**Tamanho:** G · **Depende de:** T-210 · **Ref:** `R-DOC-04`, `R-DOC-07`

Larguras vindas de `layout.py`, **sem alteração**. Cinco colunas — a de Saldo não entra.

**Pronto quando:** a soma das larguras é 26,9 cm; nenhuma coluna difere da do PDF; e nenhuma das 55
linhas transborda a célula.

---

#### T-212 — Formatação por propriedades diretas `[risco]`
**Tamanho:** G · **Depende de:** T-211 · **Ref:** `R-DOC-09`, ESPEC 003 §4.1

Bordas e sombreamento célula a célula: faixas em `#222854` com texto branco, coluna de medida em
`#E6E6FA`, Calibri 5,6 pt. O modelo não traz estilo de tabela utilizável — `Table Grid` não existe.

**Pronto quando:** as cores e o corpo de fonte conferem com `layout.py`, verificados no XML do
documento gerado.

> **É a tarefa onde o teste não protege.** A tabela pode sair com as 55 linhas certas e as bordas
> erradas, passando em tudo. A conferência visual no Word é obrigatória aqui — insumo `J-02`.

---

#### T-213 — Rodapé do relatório
**Tamanho:** P · **Depende de:** T-211 · **Ref:** ESPEC 001 `R-CTR-05`

Contrato e proposta que originou as quantidades.

**Pronto quando:** o rodapé nomeia a proposta lida do contrato.

---

#### T-214 — Determinismo
**Tamanho:** P · **Depende de:** T-213 · **Ref:** `R-DOC-10`

Sem carimbo de relógio e sem identificador aleatório nas propriedades do documento.

**Pronto quando:** duas execuções com as mesmas entradas produzem documentos de conteúdo idêntico.

> O ReportLab exigiu `invariant=1` para isto. Confirmar o equivalente no `python-docx`: as
> propriedades `created` e `modified` do pacote são carimbos de relógio.

---

#### T-215 — Teste-âncora sobre o DOCX `[portão]`
**Tamanho:** M · **Depende de:** T-214 · **Ref:** **P2**

Acrescentar o `DocxRenderer` como segundo caso do teste parametrizado de T-203.

**Pronto quando:** **54 das 55 linhas idênticas** às páginas 2–3 do GRC, com a divergência declarada
do certificado, **e o caso do PDF continua verde**. Os dois formatos provados lado a lado.
**Encerra o portão P2.**

---

## 6. Épico E3 — API e interface

#### T-216 — Resposta da API
**Tamanho:** P · **Depende de:** T-215

`pdf_base64` passa a `docx_base64`; tipo MIME
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`; nome do arquivo com
extensão `.docx`.

---

#### T-217 — Frontend
**Tamanho:** P · **Depende de:** T-216

Botão "Baixar DOCX"; *blob* com o tipo MIME correto; nome de arquivo no `download`.

---

#### T-218 — Testes de API e navegador `[portão]`
**Tamanho:** P · **Depende de:** T-217 · **Ref:** **P3**

**Pronto quando:** a resposta traz `docx_base64` que decodifica para um pacote OOXML válido; o teste
de navegador baixa um `.docx`; e o arquivo **abre no Word** — conferido à mão.
**Encerra o portão P3.**

---

## 7. Épico E4 — Remoção do ReportLab `[irreversível]`

> **Não iniciar antes de P3.** Concentrar o irreversível num único commit é o que torna a volta
> barata: depois daqui, reverter é `git revert`, não apagar arquivo.

#### T-219 — Remover o renderizador antigo
**Tamanho:** P

`reportlab_renderer.py`, `fonts.py` e o caso do PDF no teste-âncora.

---

#### T-220 — Remover a dependência
**Tamanho:** P · **Depende de:** T-219

`reportlab` sai do `pyproject.toml`; lockfile atualizado.

**Pronto quando:** `grep -ri reportlab backend/src backend/pyproject.toml` não retorna nada.

---

#### T-221 — Preservar `layout.py`
**Tamanho:** P · **Depende de:** T-219 · **Ref:** PLANO T-221

As medidas extraídas do GRC — cores, larguras, corpo de fonte — valem para qualquer renderizador e
**permanecem**. Só as importações de ReportLab saem.

**Pronto quando:** `layout.py` não importa ReportLab e os valores seguem intactos.

---

#### T-222 — Ajustar os scripts
**Tamanho:** P · **Depende de:** T-220

`scripts/gerar_relatorio.py` passa a emitir `.docx`. `scripts/sample_report.py` é removido — a
amostra do portão P1 da ESPEC 001 cumpriu seu papel.

---

## 8. Épico E5 — Documentação

| # | Tarefa | Tamanho |
|---|---|---|
| T-223 | README: o entregável é `.docx`; atualizar estrutura, testes e limitações | P |
| T-224 | CHANGELOG: a troca de formato, o motivo e a capa fixa como consequência aceita | P |
| T-225 | Este backlog atualizado com o que foi feito e os desvios | P |
| T-226 | Roteiro de demonstração: o documento agora tem capa institucional | P |

---

## 9. Insumos — dono: solicitante

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **J-01** | Confirmação de que a capa fica fixa neste incremento (ESPEC 003 §9.1) | T-205 | Segue fixa, como especificado |
| **J-02** | **Aceite visual do documento aberto no Word** | T-218 | Risco de retrabalho na formatação — é a única verificação de aparência que existe |
| **J-03** | Decisão sobre `JULHO/2026`, `VERSÃO 2.0` e o texto da caixa 3 | — | Não bloqueia: resolve-se editando o modelo, sem tocar em código |

---

## 10. Ordem de execução

| Lote | Tarefas | Objetivo |
|---|---|---|
| **1** | T-201 … T-204 | A rede aceita dois formatos; nada mudou ainda |
| **2** | T-205 … T-208 | Documento com capa e seção paisagem — **P1** |
| **3** | T-209 … T-215 | O conteúdo, provado pelo âncora — **P2** |
| **4** | T-216 … T-218 | Fluxo completo no navegador — **P3** |
| **5** | T-219 … T-222 | O ReportLab sai, num commit só |
| **6** | T-223 … T-226 | Documentação |

---

## 11. Definição de pronto global

1. `uv run pytest` passa integralmente, incluindo o teste-âncora sobre o DOCX.
2. `ruff`, `mypy --strict` e `bandit` sem apontamentos.
3. O documento reproduz **54 das 55 linhas** do GRC célula a célula.
4. O pacote gerado preserva as 39 partes, 7 fontes e 3 imagens do modelo.
5. A capa é idêntica à do modelo, verificada caractere a caractere.
6. Duas execuções produzem documentos de conteúdo idêntico.
7. **O documento abre no Word e foi conferido visualmente** — `J-02`.
8. Nenhuma referência a ReportLab no código ou nas dependências.
9. `domain/`, `application/` e `infrastructure/validations/` **não mudaram**.

O item 9 é o mais fácil de verificar e o mais revelador: se alguma dessas camadas mudou, a troca
deixou de ser de adaptador e algo precisa ser reexaminado.
