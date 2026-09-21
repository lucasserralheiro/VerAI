# PLANO 003 — Implementação do Relatório em DOCX

| | |
|---|---|
| **Especificação** | [ESPEC 003](../specs/003-relatorio-em-docx.md) |
| **Versão** | 1.0 — 2026-08-06 |
| **Estado inicial** | PDF em produção, 197 testes verdes, teste-âncora em 54 de 55 linhas |

---

## 1. O princípio que ordena este plano

Este incremento **substitui o componente que o teste-âncora protege**.

O teste-âncora é a rede de segurança do projeto: ele compara o relatório gerado com as páginas 2 e 3
do documento GRC, célula a célula. Trocar o renderizador sem cuidado abre uma janela em que a rede
não existe — o ReportLab já saiu e o DOCX ainda não está provado.

**Por isso a ordem é:** primeiro a rede passa a funcionar para os dois formatos; depois o DOCX nasce
e é provado; só então o ReportLab sai. Em nenhum momento o projeto fica sem garantia de fidelidade.

Esse princípio custa uma fase a mais — a F0 — e é o que torna o incremento reversível a qualquer
momento.

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P1 — Pacote preservado** | Fim da F1 | O documento gerado tem 39 partes, 7 fontes, 3 imagens, cabeçalho, rodapé e a capa intacta | Rever D-01: se `python-docx` perder partes, a saída é manipular o OOXML direto |
| **P2 — Fidelidade** | Fim da F2 | Teste-âncora sobre o **DOCX** em 54 de 55 linhas idênticas | Não avançar. Sem isso o DOCX não pode substituir o PDF |
| **P3 — Sem volta** | Início da F4 | P2 fechado **e** o fluxo completo verificado no navegador | Não remover o ReportLab. É o único ponto irreversível do plano |

**P3 é o portão que importa.** Enquanto ele não abrir, reverter é apagar um arquivo novo. Depois
dele, é restaurar código removido.

---

## 3. Fases

### F0 — A rede antes da obra

**Objetivo:** o teste-âncora passa a aceitar qualquer renderizador, sem que nada tenha mudado ainda.

| # | Tarefa |
|---|---|
| T-201 | Versionar o modelo em `backend/src/infrastructure/report/`, ao lado do catálogo padrão |
| T-202 | `leitura_docx.py` nos testes: extrai as linhas da tabela de um `.docx` na mesma forma que o leitor de PDF já produz |
| T-203 | Parametrizar `test_anchor_fidelity.py` por renderizador, mantendo o PDF como único caso hoje |
| T-204 | Teste de recurso: o modelo está no pacote e abre |

**Verificação:** os 197 testes seguem verdes; o teste-âncora agora roda por um caminho parametrizado
e continua em 54 de 55 no PDF.

**Nada de comportamento muda nesta fase** — é só a rede mudando de forma para caber nos dois casos.

**Tamanho:** P — meio dia.

---

### F1 — Esqueleto do documento

**Objetivo:** um `.docx` com a capa e a seção paisagem, ainda sem conteúdo de tabela.

| # | Tarefa | Ref. |
|---|---|---|
| T-205 | `DocxRenderer` implementando `IReportRenderer`, abrindo uma cópia do modelo | `R-DOC-01` |
| T-206 | Seção paisagem 29,7 × 21,0 cm, margens laterais de 1,4 cm | `R-DOC-03`, `R-DOC-04` |
| T-207 | Confirmar que o cabeçalho e o rodapé são herdados por vínculo | `R-DOC-05` |
| T-208 | Testes de preservação: 39 partes, 7 fontes, 3 imagens, capa byte a byte | `R-DOC-02`, **P1** |

**Verificação:** abrir o documento gerado no Word mostra a capa idêntica ao modelo e uma segunda
página em branco, com timbrado, em paisagem.

> O *spike* da ESPEC 003 §6 já provou que isso funciona. Esta fase transforma o *spike* em código de
> produção com teste — não é investigação, é consolidação.

**Tamanho:** M — meio dia. **Depende de:** F0. **Encerra:** P1.

---

### F2 — O conteúdo ⚠️ caminho crítico

**Objetivo:** a tabela das páginas 2 e 3, idêntica à do PDF.

| # | Tarefa | Ref. |
|---|---|---|
| T-209 | Bloco de título: título, data do levantamento e contrato de referência | ESPEC 001 §8 |
| T-210 | Faixas de grupo e de seção, com o cabeçalho de colunas repetido a cada seção | `R-DOC-06` |
| T-211 | Tabela de 5 colunas com as larguras de `layout.py`, sem alteração | `R-DOC-04`, `R-DOC-07` |
| T-212 | **[risco]** Formatação por propriedades diretas: bordas, sombreamento `#222854` e `#E6E6FA`, Calibri 5,6 pt | `R-DOC-09`, §4.1 |
| T-213 | Rodapé com contrato e proposta de origem | ESPEC 001 `R-CTR-05` |
| T-214 | Determinismo: sem carimbo de relógio, sem identificador aleatório | `R-DOC-10` |
| T-215 | **Teste-âncora sobre o DOCX** | **P2** |

**Verificação:** 54 das 55 linhas idênticas às páginas 2–3 do GRC, com a divergência declarada do
certificado. Duas execuções produzem documentos de conteúdo idêntico.

**Por que T-212 é o risco:** o modelo não traz estilo de tabela utilizável, então cada borda e cada
sombreamento é aplicado célula a célula. É onde a tradução de ReportLab para OOXML pode escorregar
sem quebrar teste nenhum — a tabela sai, só que torta. O teste-âncora cobre o **conteúdo**; a
conferência visual continua necessária.

**Tamanho:** G — um dia. **Depende de:** F1. **Encerra:** P2.

---

### F3 — API e interface

| # | Tarefa |
|---|---|
| T-216 | `pdf_base64` passa a `docx_base64`; tipo MIME e nome do arquivo mudam |
| T-217 | Frontend: botão "Baixar DOCX", *blob* com o tipo correto |
| T-218 | Ajustar os testes de API e o de navegador |

**Verificação:** o fluxo completo roda no navegador e o arquivo baixado abre no Word.

**Tamanho:** P — meio dia. **Depende de:** F2.

---

### F4 — Remoção do ReportLab `[irreversível]`

**Não iniciar antes do portão P3.**

| # | Tarefa |
|---|---|
| T-219 | Remover `reportlab_renderer.py` e o caso do PDF no teste-âncora |
| T-220 | Remover `reportlab` do `pyproject.toml` e atualizar o lockfile |
| T-221 | Manter `layout.py` — as medidas do GRC valem para qualquer renderizador |
| T-222 | Ajustar `scripts/sample_report.py` e `scripts/gerar_relatorio.py` |

**Verificação:** `grep -ri reportlab backend/src` não retorna nada; a suíte segue verde.

**Tamanho:** P — duas horas. **Depende de:** P3.

---

### F5 — Documentação e fechamento

| # | Tarefa |
|---|---|
| T-223 | README: o entregável é `.docx`; atualizar limitações e estrutura |
| T-224 | CHANGELOG: a troca de formato e o motivo |
| T-225 | TASKS 003 com o registro do que foi feito e dos desvios |
| T-226 | Roteiro de demonstração: o documento agora tem capa institucional |

**Tamanho:** P — duas horas.

---

## 4. Sequência e reversibilidade

```
F0 ──► F1 ──► F2 ──► F3 ──┬──► F4 ──► F5
   (rede)  P1     P2        │   P3
                            │
        reversível até aqui ┘   irreversível daqui
```

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | 2 a 3 dias |

Não há paralelização útil: as fases dependem umas das outras em linha reta, e o incremento é curto
demais para que dividir compense.

---

## 5. O que pode dar errado, e o que pega

| O que pode dar errado | O que pega | Quando |
|---|---|---|
| `python-docx` perder partes do pacote ao salvar | Teste de preservação (T-208) | F1 |
| A capa ser alterada por acidente | Comparação byte a byte do texto das caixas (T-208) | F1 |
| Uma coluna sair com largura diferente | Teste de largura (T-211) e o âncora | F2 |
| Uma quantidade sair com formatação errada | Teste-âncora — compara o texto da célula | F2 |
| A tabela estourar a largura útil | Soma das colunas conferida contra 26,9 cm | F2 |
| **Cores e bordas saírem erradas** | **Nada automático.** Conferência visual | F2 |
| O documento não abrir no Word | Conferência manual | F1 e F2 |

As duas últimas linhas merecem atenção: **o teste-âncora garante conteúdo, não aparência.** Um
documento com as 55 linhas certas e as bordas erradas passa em todos os testes. A conferência visual
no Word é parte do aceite, não um extra.

---

## 6. Reversão

| Momento | Como reverter |
|---|---|
| Até o fim da F3 | Apagar `docx_renderer.py` e desfazer a mudança da API. O PDF nunca deixou de funcionar |
| Depois da F4 | `git revert` do commit de remoção |

Por isso a F4 é uma fase separada, com um portão próprio, em vez de estar diluída na F2: concentrar
o irreversível num único commit é o que torna a volta barata.

---

## 7. Insumos

| # | Insumo | Necessário até | Se faltar |
|---|---|---|---|
| **J-01** | Confirmação de que a capa fica fixa neste incremento — ESPEC 003 §9.1 | F1 | Segue fixa, como especificado |
| **J-02** | Aceite visual do documento gerado, aberto no Word | F3 | Risco de retrabalho na formatação |
| **J-03** | Decisão sobre `JULHO/2026`, `VERSÃO 2.0` e o texto da caixa 3 | — | Não bloqueia: resolve-se editando o modelo, sem tocar em código |

**J-02 é o que não pode faltar.** É a única verificação de aparência que existe, e nenhum teste a
substitui.

---

## 8. O que este plano não faz

- **Não torna a capa dinâmica.** Está registrado como risco na ESPEC 003 §9.1, com a mitigação
  descrita, e fica para um incremento próprio.
- **Não mantém o PDF como segunda opção.** A ESPEC 003 assume substituição; se a intenção for
  conviver, o plano muda — a F4 desaparece e a API passa a devolver os dois formatos.
- **Não altera domínio, aplicação nem validações.** Se alguma dessas camadas precisar mudar, é sinal
  de que algo foi entendido errado: o port `IReportRenderer` existe exatamente para que esta troca
  seja de adaptador.
