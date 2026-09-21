# ESPEC 003 — Relatório em DOCX com a identidade PRODAM

| | |
|---|---|
| **Status** | Proposta |
| **Versão** | 1.0 — 2026-08-06 |
| **Depende de** | [ESPEC 001](001-mvp-analise-medicao.md) e [ESPEC 002](002-painel-de-divergencias.md) — implementadas |
| **Modelo** | `docs/documentos/Papel de Carta e Capa de Apostila.docx` |

---

## 1. Problema

O relatório sai hoje como um PDF montado do zero pelo ReportLab. Ele reproduz as páginas 2 e 3 do
documento de comprovação, mas **não carrega a identidade visual da PRODAM** — não tem a capa, o
papel timbrado, o logo do cabeçalho nem o do rodapé.

Além disso, um PDF gerado por código não é editável. Um documento que instrui faturamento passa por
revisão, e revisar exige poder ajustar.

---

## 2. Objetivo

Substituir o PDF por um **`.docx`** gerado a partir do modelo institucional, com três páginas:

| Página | Conteúdo | Origem |
|---|---|---|
| **1** | Capa | **Exatamente** a página 1 do modelo, sem alteração |
| **2 e 3** | Tabela de comprovação | **Exatamente** o conteúdo e o formato do PDF atual, em orientação paisagem, sobre o papel timbrado do modelo |

O DOCX **substitui** o PDF. O ReportLab sai do projeto.

---

## 3. O modelo — estrutura verificada

Inspeção do pacote OOXML, não suposição:

| Aspecto | Constatação |
|---|---|
| Partes do pacote | 39 |
| Fontes embutidas | **7**, em formato ofuscado (`.odttf`) |
| Fontes dos estilos | `Parabolica Test` e `Exo 2` |
| Imagens | 3 — capa (1.190 × 1.684 px), logo do cabeçalho (1.190 × 258), logo do rodapé (1.190 × 126) |
| Seções | **1**, retrato A4 (21,0 × 29,7 cm) |
| Cabeçalho e rodapé | **Somente imagem**, sem texto; valem para todas as páginas |
| "Primeira página diferente" | **Não** há (`titlePg` ausente) |
| Margens | topo 3,5 cm · laterais 1,9 cm · base 2,5 cm |
| Estilos de tabela | Apenas `Normal Table` — **não existe `Table Grid`** |

### 3.1 A capa

Três caixas de texto ancoradas sobre a imagem de página inteira. Cada uma aparece **duplicada** no
XML, pelo mecanismo `mc:AlternateContent` de compatibilidade do Word — são 6 blocos no total.

| Caixa | Conteúdo |
|---|---|
| 1 | `UTILIZAÇÃO DE RECURSOS DE INFRAESTRUTURA` · `SECRETARIA MUNICIPAL DE INOVAÇÃO E TECNOLOGIA` · `SMIT SUSTENTAÇÃO` |
| 2 | `Contrato : TC 52/SMIT/2024 - TA 02` · *(linha vazia)* · `Proposta : PC-SMIT-240402-53 V1.0 / PA-SMIT-250220-15 V 1.4 /` · `PA-SMIT-260319-739` |
| 3 | `DIRETORIA DE INFRAESTRUTURA E TECNOLOGIA` · `GIO - GERÊNCIA DE OPERAÇÕESPA-SMIT-260319-739` |

Duas observações registradas, **sem ação nesta espec** por decisão do solicitante:

- As linhas `JULHO/2026` e `VERSÃO 2.0`, presentes na capa do relatório GRC, **não estão no modelo**.
- A caixa 3 traz o número da proposta concatenado sem espaço a `GERÊNCIA DE OPERAÇÕES`.

A capa é reproduzida **exatamente como está no modelo**. Corrigir qualquer um dos dois pontos é
editar o modelo, que é onde a capa vive — ver §9.1.

---

## 4. Regras

| ID | Regra |
|---|---|
| `R-DOC-01` | O documento nasce de uma **cópia do modelo**, nunca montado do zero. É o que preserva as 7 fontes embutidas, as 3 imagens, o cabeçalho, o rodapé e os estilos |
| `R-DOC-02` | A **capa não é tocada** — nem texto, nem posição, nem imagem. Nenhum valor é substituído |
| `R-DOC-03` | Uma **quebra de seção** separa a capa (retrato) do corpo (paisagem). A seção paisagem tem 29,7 × 21,0 cm |
| `R-DOC-04` | A seção paisagem usa margens laterais de **1,4 cm**, resultando em **26,9 cm** de largura útil — exatamente a largura da tabela medida no relatório GRC. As larguras de coluna não mudam |
| `R-DOC-05` | A seção paisagem **herda o cabeçalho e o rodapé** da capa, por vínculo com a seção anterior. O papel timbrado aparece nas páginas 2 e 3 sem duplicar recurso no pacote |
| `R-DOC-06` | O corpo reproduz **exatamente** o conteúdo e o formato do PDF atual: faixas de grupo e seção, cabeçalho de colunas repetido a cada seção, as **cinco colunas** e a formatação numérica por item (`R-MED-04`) |
| `R-DOC-07` | A coluna **Saldo não entra** no documento. Ela existe apenas no grid da tela (ESPEC 002 `R-DIV-08`) |
| `R-DOC-08` | Itens medidos sem previsão contratual **não entram** no documento, como já ocorre no PDF (`R-REC-01`). Seguem visíveis apenas no grid |
| `R-DOC-09` | A tabela é formatada por **propriedades diretas** — bordas e sombreamento aplicados célula a célula. O modelo não traz estilo de tabela utilizável |
| `R-DOC-10` | A geração é **determinística**: duas execuções com as mesmas entradas produzem documentos de conteúdo idêntico |

### 4.1 Tipografia do corpo

O corpo mantém a tipografia **medida no relatório GRC** — Calibri 5,6 pt, faixas em `#222854`,
coluna de medida em `#E6E6FA` — e não a dos estilos do modelo (`Parabolica Test`, `Exo 2`).

As duas exigências convivem sem conflito porque tratam de coisas diferentes: o modelo contribui com
o **papel timbrado** — página, margens, cabeçalho, rodapé, capa; o relatório GRC define o **conteúdo
da tabela**. `R-DOC-06` é explícito ao exigir identidade com o PDF atual.

---

## 5. Estrutura do documento gerado

```
┌─ Seção 1 — retrato 21,0 × 29,7 cm ──────────────────────────────────────┐
│  [cabeçalho: logo]                                                       │
│                                                                          │
│  Página 1 — CAPA, cópia literal do modelo                                │
│  imagem de página inteira + 3 caixas de texto                            │
│                                                                          │
│  [rodapé: logo]                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                          ╪ quebra de seção ╪
┌─ Seção 2 — paisagem 29,7 × 21,0 cm, margens laterais 1,4 cm ────────────┐
│  [cabeçalho e rodapé herdados da seção 1]                                │
│                                                                          │
│  Páginas 2 e 3 — bloco de título, faixas de seção e a tabela             │
│  de 5 colunas em 26,9 cm, idêntica à do PDF atual                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Decisões de engenharia

Todas verificadas em *spike* sobre o modelo real, antes de escrever esta espec.

### D-01 — `python-docx`, partindo de uma cópia do modelo

Abrir o modelo, acrescentar a seção paisagem e salvar **preserva o pacote inteiro**: 39 partes
antes, 39 depois, sem nenhuma perda. As 7 fontes, as 3 imagens, o cabeçalho, o rodapé e o
`styles.xml` sobrevivem, e a capa fica intacta.

**Alternativa descartada:** manipular o OOXML diretamente com `zipfile` e `lxml`. Daria controle
total, ao custo de reimplementar o que a biblioteca já faz corretamente.

### D-02 — Margens de 1,4 cm na seção paisagem

Com as margens do modelo (1,9 cm), a largura útil em paisagem é 25,9 cm — **1 cm a menos** que a
tabela. Reduzindo para 1,4 cm, dá exatamente **26,9 cm**.

**Alternativa descartada:** estreitar as colunas. Cada largura foi **medida no relatório GRC**, não
arbitrada; alterá-las quebraria a fidelidade que é o critério de aceite do projeto.

### D-03 — Cabeçalho e rodapé herdados, sem redimensionar

A seção paisagem herda o cabeçalho e o rodapé por vínculo, e as imagens mantêm o **tamanho original**
— 21,0 e 20,9 cm de largura numa página de 29,7 cm.

**Alternativa descartada:** esticar as imagens para a largura da página. A do cabeçalho passaria de
4,5 para 6,4 cm de altura, invadindo a área do corpo — 1,9 cm a menos por página, num documento cujo
conteúdo já ocupa duas páginas cheias.

Fica registrado que o timbrado não preenche a largura em paisagem. Se isso incomodar, a saída é o
modelo trazer uma variante das imagens para paisagem — não o gerador deformá-las.

### D-04 — Formatação por propriedades diretas

O modelo tem apenas o estilo `Normal Table`; `Table Grid` não existe e referenciá-lo levanta erro.
Bordas e sombreamento são aplicados célula a célula.

### D-05 — O ReportLab sai

Com o DOCX substituindo o PDF, `reportlab` deixa de ser dependência e
`infrastructure/report/reportlab_renderer.py` é removido. O port `IReportRenderer` permanece — é
justamente ele que torna a troca uma substituição de adaptador, e não uma reescrita.

O módulo `layout.py`, com as medidas extraídas do GRC, **permanece**: as cores, larguras e corpo de
fonte valem para qualquer renderizador.

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/` | Nenhuma. O agregado `Report` já tem tudo |
| `application/` | Nenhuma |
| `infrastructure/report/` | Sai `reportlab_renderer.py`; entra `docx_renderer.py`. `layout.py` permanece |
| `infrastructure/report/` | Entra o modelo como recurso, ao lado do catálogo padrão |
| `api/` | `pdf_base64` passa a `docx_base64`; o `Content-Disposition` e o nome do arquivo mudam |
| `frontend/` | O botão passa a "Baixar DOCX"; o *blob* muda de tipo MIME |
| `backend/pyproject.toml` | Sai `reportlab`, entra `python-docx` |

O modelo passa a viver em `backend/src/infrastructure/report/`, pelo mesmo motivo do catálogo
padrão: acompanha o código no container e no deploy.

---

## 8. Testes e critério de aceite

O **teste-âncora migra para o DOCX** e continua sendo o critério de aceite do projeto.

| Nível | Cobertura |
|---|---|
| Estrutura | O documento gerado tem 2 seções: retrato e paisagem, com as dimensões de `R-DOC-03` |
| Preservação | 39 partes no pacote, 7 fontes, 3 imagens, cabeçalho e rodapé — nada perdido (`R-DOC-01`) |
| Capa | O texto das 3 caixas é **byte a byte** o do modelo (`R-DOC-02`) |
| Largura | A tabela ocupa 26,9 cm e nenhuma coluna mudou de largura (`R-DOC-04`) |
| **Âncora** | As 55 linhas extraídas do DOCX conferem **célula a célula** com as páginas 2–3 do GRC — 54 idênticas, mais a divergência declarada do certificado |
| Determinismo | Duas execuções produzem documentos de conteúdo idêntico (`R-DOC-10`) |
| API | A resposta traz `docx_base64` que decodifica para um pacote OOXML válido |
| Navegador | O download entrega um `.docx` |

**Sobre o teste-âncora em DOCX:** a comparação passa a ler o XML do documento, e não o texto de um
PDF. É mais direto — o conteúdo está estruturado em células, sem depender de extração por
coordenada.

---

## 9. Riscos

### 9.1 A capa é conteúdo fixo

Reproduzir a capa exatamente como está no modelo significa que `TC 52/SMIT/2024`,
`PA-SMIT-260319-739` e `SMIT SUSTENTAÇÃO` ficam **fixos no documento**. Para outro contrato ou outra
competência, a capa sairá com os dados errados.

Isso contraria o princípio de configuração por dados que orienta o projeto — e é uma escolha
consciente do solicitante para este incremento, não um descuido.

**Mitigação registrada, não implementada:** as três caixas de texto são exatamente onde os valores
vivem. Torná-las dinâmicas é substituir texto em 6 blocos `mc:AlternateContent` — as duas cópias de
cada caixa, sob pena de o Word exibir a versão antiga. Um teste que gere o documento com um contrato
diferente e verifique a capa fecharia o risco.

### 9.2 Demais riscos

| Risco | Mitigação |
|---|---|
| Fontes embutidas com licença restrita | Não são geradas nem convertidas: o pacote do modelo é copiado como está |
| O Word exibir a versão antiga de uma caixa de texto | Não se aplica enquanto a capa não for tocada (`R-DOC-02`). Passa a valer se §9.1 for implementada |
| A tabela quebrar de página em ponto diferente do GRC | Já ocorre no PDF atual e está registrado. Não afeta o conteúdo |
| O timbrado não preencher a largura em paisagem | D-03. A saída é uma variante das imagens no modelo |
| Perda de fidelidade ao trocar o renderizador | O teste-âncora é a rede: se o DOCX divergir do GRC além do esperado, ele reprova |

---

## 10. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | `JULHO/2026` e `VERSÃO 2.0` devem voltar à capa? Hoje não constam do modelo | Conteúdo da capa |
| 2 | `GERÊNCIA DE OPERAÇÕESPA-SMIT-260319-739` é intencional? | Conteúdo da capa |
| 3 | A capa deve virar dinâmica num próximo incremento? Ver §9.1 | Uso em outros contratos |
| 4 | O PDF deve seguir disponível como segunda opção de download? Esta espec assume que **não** | Escopo |

Nenhum bloqueia a implementação: 1 e 2 são resolvidos editando o modelo, sem tocar em código.

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Modelo como recurso versionado; `docx_renderer` com a seção paisagem | M |
| B | Bloco de título, faixas e tabela com formatação direta | G |
| C | Teste-âncora migrado para leitura do DOCX | M |
| D | API e frontend: `docx_base64`, tipo MIME, rótulo do botão | P |
| E | Remoção do ReportLab e limpeza | P |

**Total: 2 a 3 dias.** O que sustenta a estimativa é o port `IReportRenderer`: o domínio, a
aplicação e as validações não mudam em nada — a troca é de adaptador.
