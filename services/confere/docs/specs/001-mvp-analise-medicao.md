# ESPEC 001 — MVP: Análise de Medição Contratual

| | |
|---|---|
| **Status** | Implementado — ver estado real no [README](../../README.md) |
| **Versão** | 1.1 — 2026-08-05 (ver "Revisões posteriores", Anexo B) |
| **Referência de arquitetura** | [TRIADE](../triade_referencia/README.md) |
| **Caso-piloto** | Contrato TC 52/SMIT/2024 — SMIT Sustentação, competência Julho/2026 |

---

## 1. Problema

A conferência entre o que foi **contratado** e o que foi **medido** em contratos de prestação de
serviços de TIC é feita hoje de forma manual. O analista abre a proposta comercial em PDF, abre a
planilha de levantamento com 22 abas, e monta à mão a tabela de comprovação que instrui o
faturamento — o documento reproduzido nas páginas 2 e 3 do relatório
`SMIT_SUSTENTACAO_Levantamento_05969_TC_52SMIT2024_15072026_101414_V2.0___GRC.pdf`.

São **55 linhas de itens distribuídas em 22 seções**, cada uma exigindo localizar o código no
contrato, somar as linhas correspondentes, localizar o mesmo código na planilha e escolher a
variante correta da medição. O processo é repetido a cada competência, para cada contrato.

**O MVP automatiza exatamente essa tabela.** Dois arquivos entram, um PDF sai.

---

## 2. Objetivo e critério de sucesso

Gerar, a partir dos arquivos de origem, um PDF **idêntico às páginas 2 e 3** do relatório de
comprovação — mesmas seções, mesma ordem, mesmas 55 linhas, mesmos valores.

**Critério de aceite objetivo:** processando os dois arquivos do caso-piloto, o relatório gerado
deve reproduzir **54 das 55 linhas** com identidade célula a célula. A 55ª linha é uma divergência
real entre as fontes, documentada em §9.1, e sua reprodução exige decisão de negócio.

---

## 3. Escopo

### 3.1 Dentro do escopo

- Upload de dois arquivos: contrato (PDF) e levantamento (XLSX).
- Catálogo de apresentação **embutido na aplicação**, sem upload — ver §4.3.
- Extração das quantidades contratadas da tabela de itens do contrato.
- Leitura das quantidades medidas da aba `Levantamento`.
- Reconciliação por código de serviço, dirigida pelo catálogo.
- Validações de integridade das entradas, com relato explícito de falhas.
- Geração do PDF no layout do relatório de comprovação.
- Interface web mínima: envio dos arquivos, resultado das validações, download do PDF.

### 3.2 Fora do escopo do MVP

| Item | Motivo |
|---|---|
| OCR e LLM | Ambas as entradas são legíveis por máquina — ver §4.4. Introduzi-los seria custo e risco sem contrapartida. |
| Relatório de análise de divergências | O `Relatorio_Analise_Medição.xlsx` (Resumo Executivo, Itens Críticos, Divergências) é um segundo entregável; fica para a evolução — ver §13. |
| Banco de dados e persistência | O catálogo acompanha o código; a aplicação é sem estado. |
| Autenticação e multi-tenancy | Não há dado sensível persistido. |
| Consolidação de múltiplos aditivos | Um único PDF vigente por execução — ver §5.4. |
| Cálculo de valores financeiros | O relatório-alvo é de quantidades, não de preços. |
| Demais páginas do relatório GRC | As páginas 4 a 41 são anexos de detalhamento técnico. |

---

## 4. Entradas

### 4.1 Contrato — PDF

Exemplo: `PA-SMIT-260319-739 Q-00739-7.pdf` (32 páginas).

A tabela de itens ocupa as **páginas 26 a 29**, com sete colunas:

```
Código | Descrição | Unidade | Preço Unitário | Quantidade | Meses | Valor Total
```

São ~57 linhas de item. Um mesmo código pode aparecer em mais de uma linha, com dois significados
distintos — ver a regra `R-CTR-02`.

O que o MVP consome: **código, descrição e quantidade**. Preço, meses e total são ignorados.

### 4.2 Levantamento — XLSX

Exemplo: `SMIT SUSTENTAÇÃO_Levantamento_05969_TC 52SMIT2024_15072026_101414_V2.0.xlsx`
(22 abas). Apenas a aba **`Levantamento`** (166 linhas) é consumida; as outras 21 são o
detalhamento que a sustenta e não são lidas pelo MVP.

Estrutura da aba: blocos por seção, cada um com uma linha de cabeçalho e linhas de item. O layout
das colunas **varia entre blocos** — em alguns o código está na coluna B, em outros na coluna C:

```
Bloco com unidade:  A=Tipo  B=Código  C=Unidade  D=Qtd Contratada  E=Qtd Medida
Bloco sem unidade:  A=Tipo  B=(vazia) C=Código   D=Qtd Contratada  E=Qtd Medida
```

O leitor deve localizar o código por padrão (`\d{2}\.\d{3}\.\d{5}\.\d{2}`) em qualquer coluna da
linha, e não por posição fixa.

Do cabeçalho da aba são extraídos ainda a **data do levantamento** (linha 3) e o **contrato de
referência** (linha 4), usados no topo do relatório.

O que o MVP consome: **código e quantidade medida**. A coluna "Quantidade Contratada" da planilha
é **ignorada** — a fonte da verdade é o contrato.

### 4.3 Catálogo — XLSX

**Não é enviado pelo usuário: acompanha a aplicação.** Vive em
`backend/src/infrastructure/catalog/catalogo_padrao.json`, dentro de `src/`, e por isso segue o
código no container e no deploy.

É ele que carrega tudo o que **não está** nem no contrato nem na planilha: a taxonomia de seções,
a ordem de exibição e o tratamento de cada item. Ele **não participa da comparação** — quantidade
contratada vem do contrato, medida vem da planilha; o catálogo governa apenas a apresentação.

Como o objetivo declarado é reproduzir o relatório de comprovação atual, essa apresentação é
conhecida de antemão e não muda entre competências. Pedi-la a cada execução obrigaria o usuário a
carregar um arquivo que ele não tem e não sabe o que é.

O formato é JSON, e não planilha, de propósito: um aditivo que altere o catálogo aparece linha a
linha no diff da revisão, o que um arquivo binário esconderia.

Para um contrato cuja apresentação difira da do piloto, a API aceita um catálogo por upload no
campo opcional `catalogo`, que substitui o embutido. Isso preserva a generalidade da solução sem
poluir a tela do uso corrente.

| Coluna | Obrigatória | Descrição |
|---|---|---|
| `ordem` | sim | Inteiro que define a posição da linha no relatório |
| `grupo_codigo` | sim | Grupo de primeiro nível (`B`, `C`, `E`, `H`) |
| `grupo_titulo` | sim | Ex.: `E - DATACENTER` |
| `secao_codigo` | sim | Subseção (`C2`, `E1.1`, `E5.7`); igual ao grupo quando não houver |
| `secao_titulo` | sim | Ex.: `E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS - DESCONTANDO RECURSOS DE DESENVOLVIMENTO` |
| `exibir` | sim | `S`/`N`. A Seção A entra com `N` — ver `R-CAT-03` |
| `codigo` | sim | Código do serviço |
| `qualificador` | não | Discrimina linhas de mesmo código no contrato — ver `R-CTR-02` |
| `unidade_exibicao` | sim | Unidade como deve aparecer no relatório |
| `descricao_exibicao` | não | Sobrescreve a descrição do contrato quando preenchida |
| `tipo_quantidade` | sim | `NUMERICO` ou `PERFIL_PACOTE` — ver `R-REC-04` |
| `formato_quantidade` | sim | `MILHAR` ou `SIMPLES` — ver `R-MED-04` |

Por que o catálogo é necessário: a **ordem das linhas do relatório não segue nem o contrato nem a
planilha**. Na seção B o relatório lista `11.051.00012.00` antes de `11.027.00001.00`, invertendo
as duas outras fontes; na seção E1.1 ele ordena por código crescente, enquanto a planilha ordena
por tipo de servidor. Também a unidade exibida diverge do contrato em formatação
(`Servidor / Mês` no relatório, `SERVIDOR/MÊS` no contrato). Essas escolhas são editoriais e
precisam de um lugar próprio.

O catálogo do contrato-piloto não foi digitado: é derivado das próprias páginas 2 e 3 do relatório
modelo por `scripts/seed_catalog.py`, que também emite a versão em planilha usada como fixture do
caminho de upload.

### 4.4 Decisão: sem OCR e sem LLM

Diferente do TRIADE, cujas entradas são documentos digitalizados de terceiros, **as duas fontes
aqui são geradas por sistema e legíveis por máquina**. A validação foi feita nos arquivos reais:
`pdfplumber` extrai a tabela do contrato diretamente e `openpyxl` lê a planilha sem qualquer
tratamento de imagem.

Não há classificação, interpretação semântica nem julgamento a fazer — apenas correspondência por
chave exata. Introduzir um LLM aqui adicionaria custo por execução, latência, não-determinismo e
uma superfície de erro que o problema não tem. **O MVP é determinístico: a mesma entrada produz
sempre o mesmo relatório.**

---

## 5. Regras de negócio

### 5.1 Extração do contrato (`R-CTR-*`)

| ID | Regra |
|---|---|
| `R-CTR-01` | A quantidade contratada de um item é a que consta na coluna `Quantidade` da tabela de itens do contrato. |
| `R-CTR-02` | Quando o mesmo código aparece em várias linhas: se a entrada do catálogo **não** tem `qualificador`, as quantidades são **somadas**; se tem, casa-se a linha do contrato cuja descrição contenha o qualificador, sem somar. Exemplo de soma: `10.050.00001.00` = 300 + 4.000 + 480 = 4.780. Exemplo de qualificador: `14.025.00011.00` gera **duas** linhas no relatório, `IT0101` e `SG0721`, cada uma com quantidade 1. |
| `R-CTR-03` | A descrição exibida é a do contrato, salvo se o catálogo trouxer `descricao_exibicao`. |
| `R-CTR-04` | Códigos presentes no contrato e ausentes do catálogo não entram no relatório, mas são reportados como aviso (`V-CAT-02`). |

### 5.2 Leitura da medição (`R-MED-*`)

| ID | Regra |
|---|---|
| `R-MED-01` | A quantidade medida é lida da coluna `Quantidade Medida` da aba `Levantamento`. |
| `R-MED-02` | **Sempre descontar recursos de desenvolvimento.** Quando o mesmo código aparece mais de uma vez na aba, prevalece a ocorrência cujo título do bloco **ou** cuja descrição da linha contenha `DESCONTANDO RECURSOS DE DESENVOLVIMENTO`. Casos reais: `14.049.00047.00` → 2 e não 4 (bloco E1.1 descontado, linha 72); `14.024.00005.00` → 762,55 e não 1.097,55 (linha 129). |
| `R-MED-03` | Código do catálogo sem correspondência na planilha recebe quantidade medida **0**, e o fato é reportado como aviso. |
| `R-MED-04` | A formatação de cada quantidade vem da coluna `formato_quantidade` do catálogo: `MILHAR` aplica ponto de milhar, `SIMPLES` o omite. O separador decimal é sempre a vírgula, com duas casas quando houver parte fracionária. **Regra global de formatação não serve:** o relatório modelo grafa `1500` e `4.000` na mesma página, e uma regra única reprovaria o teste-âncora. *(Revisada em 2026-08-05; a redação anterior — sempre com separador de milhar — estava incorreta.)* |

### 5.3 Catálogo e composição (`R-CAT-*`, `R-REC-*`)

| ID | Regra |
|---|---|
| `R-CAT-01` | O catálogo é a **espinha dorsal** do relatório: cada linha exibida corresponde a exatamente uma entrada de catálogo com `exibir = S`. |
| `R-CAT-02` | Seções sem nenhuma linha visível são suprimidas, inclusive seus cabeçalhos. |
| `R-CAT-03` | A **Seção A — Sistemas de Informação** (`10.050.*`) entra no catálogo com `exibir = N`, reproduzindo o relatório atual, que não a apresenta. A exclusão fica declarada em dado, não em código. |
| `R-REC-01` | **Itens com quantidade contratada 0 são omitidos**, mesmo quando há medição. Caso real: `14.049.00054.00`, contratada 0 e medida 2, ausente do relatório GRC. Ver o risco associado em §9.2. |
| `R-REC-02` | A reconciliação é por chave exata `(codigo, qualificador)`. Não há correspondência aproximada nem por descrição. |
| `R-REC-03` | O relatório não calcula saldo, percentual ou classificação — apenas as duas colunas de quantidade. |
| `R-REC-04` | Itens marcados como `PERFIL_PACOTE` no catálogo entram **sempre como 1 contratado e 1 medido**, independentemente do conteúdo da planilha. Aplica-se a `14.048.00008.00` (perfil D contratado, C medido), `14.046.00010.00`, `14.025.00011.00` e `14.070.00002.00` (`PACOTE`). Ver a perda de informação em §9.3. |

### 5.4 Contrato vigente

`R-CTR-05` — O MVP aceita **um único PDF por execução**, assumido como a proposta vigente que
consolida todas as quantidades. O relatório registra no rodapé qual proposta originou os números.
Consolidar contrato original mais aditivos em ordem cronológica está fora do escopo.

---

## 6. Validações

Herdando o padrão de *guardrails* do TRIADE: cada validação é uma unidade nomeada, com arquivo e
teste próprios, e o resultado é apresentado ao usuário antes do download. Validações `BLOQUEIA`
impedem a geração; `AVISA` permitem gerar com ressalva registrada.

| ID | Verificação | Efeito |
|---|---|---|
| `V-CTR-01` | A tabela de itens foi localizada no contrato e tem ao menos uma linha | BLOQUEIA |
| `V-CTR-02` | Todo código do catálogo com `exibir = S` foi resolvido no contrato | BLOQUEIA |
| `V-CTR-03` | Toda linha de item do contrato foi extraída com código, descrição e quantidade completos | BLOQUEIA |
| `V-MED-01` | A aba `Levantamento` existe e tem a estrutura esperada | BLOQUEIA |
| `V-MED-02` | A data do levantamento e o contrato de referência foram localizados no cabeçalho | AVISA |
| `V-CAT-01` | O catálogo não tem `(codigo, qualificador)` duplicado nem `ordem` repetida | BLOQUEIA |
| `V-CAT-02` | Códigos presentes no contrato e ausentes do catálogo | AVISA |
| `V-CAT-03` | Códigos do catálogo sem correspondência na planilha | AVISA |
| `V-REC-01` | Divergência entre a quantidade contratada do contrato e a da planilha | AVISA |
| `V-REC-02` | Quantidade não numérica em item marcado como `NUMERICO` | AVISA |

`V-CTR-03` merece destaque. A tabela do contrato tem **células com quebra de linha**, e as
estratégias ingênuas falham: extração por linha de texto resolveu apenas **15 de 60** linhas nos
testes, e `extract_tables()` sozinho resolveu **55 de 57**, perdendo `12.074.00005.00` e
`14.048.00008.00` justamente por quebra de célula. **Nenhum item pode receber quantidade zero por
falha silenciosa de extração** — daí a validação bloqueante. Ver §9.4.

---

## 7. Arquitetura

### 7.1 Princípios herdados do TRIADE

1. Clean Architecture com regra de dependência apontando para dentro.
2. *Ports & adapters*: o domínio declara contratos, a infraestrutura os implementa.
3. Configuração por dados, não por deploy — aqui materializada no catálogo.
4. Validações como unidades nomeadas, uma por arquivo, com teste dedicado.
5. Comentários que explicam o **porquê**, principalmente onde a escolha parece contraintuitiva.

### 7.2 O que foi deliberadamente deixado de fora

O TRIADE resolve um problema de outra natureza — documentos digitalizados de terceiros,
julgamento semântico, múltiplas organizações, trilha de auditoria com valor jurídico. Nada disso
se aplica aqui. Ficam fora: PostgreSQL e Alembic, Entra ID e NextAuth, Azure OpenAI e Document
Intelligence, Blob Storage, multi-tenancy, *background tasks* e trilha de auditoria.

O que sobra é um **serviço sem estado**: recebe arquivos, devolve PDF, nada persiste.

### 7.3 Estrutura do backend

```
backend/src/
├── api/                          # FastAPI
│   ├── main.py                   # app, CORS, headers de segurança
│   ├── routers/reports.py        # POST /reports  (multipart → PDF)
│   └── schemas.py                # Pydantic v2
│
├── application/
│   ├── use_cases/
│   │   └── generate_measurement_report.py   # orquestra o fluxo de §7.5
│   └── dtos/
│       ├── report_request.py
│       └── report_result.py                 # linhas + achados de validação
│
├── domain/                       # sem dependência de framework
│   ├── entities/
│   │   ├── catalog_entry.py
│   │   ├── contract_item.py
│   │   ├── measurement_item.py
│   │   └── report.py             # Report, ReportSection, ReportLine
│   ├── value_objects/
│   │   ├── service_code.py       # valida o formato NN.NNN.NNNNN.NN
│   │   └── quantity.py           # decimal + formatação pt-BR
│   └── interfaces/
│       ├── contract_extractor.py     # IContractExtractor
│       ├── measurement_reader.py     # IMeasurementReader
│       ├── catalog_reader.py         # ICatalogReader
│       ├── report_renderer.py        # IReportRenderer
│       └── validation.py             # IValidation
│
└── infrastructure/
    ├── contract/pdfplumber_extractor.py   # estratégia de §9.4
    ├── measurement/levantamento_reader.py
    ├── catalog/xlsx_catalog_reader.py
    ├── report/reportlab_renderer.py
    ├── validations/                        # v_ctr_01.py … v_rec_02.py
    └── di/container.py                     # IoC manual, como no TRIADE
```

### 7.4 Frontend

Next.js (App Router), TypeScript, Tailwind e o mesmo design system do TRIADE — reaproveitando
`triade.tokens.ts` e `triade.components.tsx` para manter a identidade visual do portfólio.

Uma única rota, `/`, com três estados: envio dos arquivos, resultado das validações, download.
Sem SWR, sem NextAuth, sem middleware — a página conversa com um único endpoint.

### 7.5 Fluxo de processamento

```
   contrato.pdf      levantamento.xlsx      catalogo.xlsx
        │                    │                    │
        ▼                    ▼                    ▼
  IContractExtractor   IMeasurementReader   ICatalogReader
        │                    │                    │
   {código →           {código →            [entradas
    (desc, qtd)}        qtd medida}          ordenadas]
        │                    │                    │
        └────────────┬───────┴────────────────────┘
                     ▼
              Reconciliação  (R-REC-*, dirigida pelo catálogo)
                     │
                     ▼
              Validações  (V-*)  ──► bloqueia? ──► devolve achados
                     │ não
                     ▼
              IReportRenderer  ──►  relatorio.pdf
                                    (DOCX desde a ESPEC 003)
```

Síncrono, em memória, sem fila nem estado. O tempo de processamento esperado é de segundos: o
contrato tem 32 páginas e a aba consumida da planilha tem 166 linhas.

---

## 8. Layout do relatório

Reprodução das páginas 2 e 3, em A4 paisagem.

**Cabeçalho**, repetido em todas as páginas:

```
LEVANTAMENTO - COMPROVAÇÃO <NOME DO CONTRATO> - CATÁLOGO DE SERVIÇOS DIT

Data do Levantamento : <dd/mm/aaaa>                    Quantidade    Quantidade
*Valores conforme contrato : <identificação>           Contratada*   Medida
```

**Corpo**, por seção do catálogo:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ E - DATACENTER                                                             │  ← grupo
│ E1.1 - HOSPEDAGEM DE APLICAÇÃO - TOTAL DE RECURSOS - DESCONTANDO ...        │  ← seção
├─────────────────┬──────────────────────┬───────────┬────────────┬──────────┤
│ Código          │ Descrição            │ Unidade   │ Quantidade │Quantidade│
│                 │                      │           │ Contratada │ Medida   │
├─────────────────┼──────────────────────┼───────────┼────────────┼──────────┤
│ 14.049.00037.00 │ HOSPEDAGEM DE APLI…  │ Servidor…│          1 │        1 │
└─────────────────┴──────────────────────┴───────────┴────────────┴──────────┘
```

O cabeçalho de colunas se repete a cada seção, como no documento atual. **Rodapé** com a
identificação do contrato, a proposta que originou as quantidades (`R-CTR-05`) e o carimbo de
geração.

Total esperado no caso-piloto: **22 seções e 55 linhas de item**.

---

## 9. Riscos e pontos de atenção

### 9.1 Divergência de quantidade contratada — decisão pendente

Item `11.027.00001.00` (Certificado Digital SSL):

| Fonte | Quantidade |
|---|---|
| Contrato `PA-SMIT-260319-739`, página 26 | **10** |
| Texto do aditivo, página 1: *"De 6 certificados Para 10 certificados"* | **10** |
| Planilha `Levantamento`, linha 14 | **10** |
| Relatório GRC, página 2 | **6** |

Como a decisão é extrair do contrato, **o relatório gerado exibirá 10**, divergindo do documento
atual nessa única célula. As três fontes concordam entre si; o relatório GRC é que destoa —
aparentemente por não ter incorporado o aumento do aditivo.

**Encaminhamento:** confirmar com a área de negócio se 10 é o número correto. Se for, o relatório
gerado está certo e o GRC atual contém um erro — o que, por si só, já demonstra o valor da
automação. A validação `V-REC-01` existe para tornar esse tipo de caso visível.

### 9.2 Consumo sem previsão contratual fica invisível

`R-REC-01` omite itens com quantidade contratada zero. No caso-piloto isso esconde
`14.049.00054.00` — hospedagem Tipo C não gerenciada Linux, **contratada 0 e medida 2**. É
consumo sem cobertura contratual, exatamente o tipo de achado que uma conferência deveria
evidenciar.

A regra reproduz fielmente o comportamento atual, e essa foi a decisão. Fica registrado que uma
seção de anexo listando esses itens seria de baixo custo e alto valor — candidata natural à
primeira evolução.

### 9.3 Itens de perfil perdem informação

`R-REC-04` transforma perfis e pacotes em `1 / 1`. Com isso, `14.048.00008.00` — banco de dados
**contratado no perfil D e medido no perfil C** — aparece como se não houvesse diferença, e é
classificado como "sem divergência" na análise atual. Um perfil menor que o contratado é uma
diferença comercialmente relevante.

O layout de duas colunas numéricas não comporta essa informação. Registrado para evolução.

### 9.4 Extração da tabela do contrato — ~~maior risco técnico~~ **RESOLVIDO**

> **Encerrado em 2026-08-05.** A extração atinge 60 de 60 linhas e o checksum confere
> exatamente: a soma dos totais das linhas bate com o `TOTAL` declarado no contrato,
> `BRL 10.637.425,00`. O registro abaixo é mantido porque explica por que a solução tem a forma
> que tem.

As medições feitas nos arquivos reais:

| Estratégia | Linhas resolvidas |
|---|---|
| Regex sobre linhas de texto | 15 de 60 |
| `pdfplumber.extract_tables()` | 55 de 57 |
| Necessário | 57 de 57 |

A causa é a quebra de linha dentro das células de descrição e unidade.

**Solução adotada** — diferente da mitigação prevista, e melhor: a grade da tabela **está desenhada
no PDF**, em retângulos de 0,7 pt que formam as bordas. Derivando as fronteiras desses traços e
atribuindo cada palavra à célula que a contém, a descrição multilinha cai naturalmente numa única
célula — sem heurística de continuação.

Restava um caso: a moldura **não fecha no rodapé**, e a última linha de cada página fica abaixo da
última borda horizontal. Era essa a causa de `12.074.00005.00` e `14.048.00008.00` se perderem.
Resolvido com um limite inferior sintético.

A conferência cruzada com `extract_tables()` ficou **superada**: comparar contra uma estratégia que
sabidamente perde duas linhas só geraria ruído. Em seu lugar, `V-CTR-03` confere o checksum, que é
prova exata.

Como o layout da proposta comercial é gerado por sistema, a expectativa é de estabilidade — mas a
validação bloqueante garante que uma mudança de layout falhe alto, e não produza silenciosamente
um relatório com zeros.

> **Emenda — 2026-08-12, [ESPEC 017](017-grade-do-contrato-derivada-do-documento.md).** O parágrafo
> acima estava certo sobre o comportamento e errado sobre a expectativa. A validação **falhou
> alto**, como prometido: o contrato `PA-PGM-251015-159` bloqueou em vez de sair com zeros. Mas
> "gerado por sistema" não implica "gerado pelo mesmo sistema" — outro órgão, outra margem, e a
> tabela ficou 17 pt à direita.
>
> **O que foi revisado é o meio, não a intenção.** A reconstrução da grade a partir das bordas
> desenhadas permanece intacta — é ela que resolve a descrição multilinha, e é o achado desta
> seção. O que mudou é *como as fronteiras são descobertas*: eram comparadas contra as coordenadas
> medidas neste piloto e passaram a ser derivadas do próprio documento, pela repetição do conjunto
> de oito divisórias entre as páginas da tabela.
>
> A frase do cabeçalho do extrator — *"localizada por âncora de conteúdo, nunca por posição
> fixa"* — passou a valer também para as colunas, e não só para as páginas. O limite inferior
> sintético do rodapé, `V-CTR-03` e o checksum continuam exatamente como descritos aqui.

### 9.5 Demais riscos

| Risco | Mitigação |
|---|---|
| Mudança de layout da planilha de levantamento | Busca do código por padrão em qualquer coluna (§4.2); `V-MED-01` bloqueia se a aba não for reconhecida |
| Catálogo desatualizado após novo aditivo | `V-CAT-02` avisa sobre códigos do contrato ausentes do catálogo |
| Fidelidade visual do PDF | Critério de aceite por comparação célula a célula (§10), não por semelhança visual |

---

## 10. Testes e aceite

Seguindo o TRIADE: `pytest`, um arquivo por área, nomeados `test_<área>_<aspecto>.py`.

| Nível | Cobertura |
|---|---|
| Unitário | Cada regra `R-*` e cada validação `V-*` isoladamente |
| Integração | Extrator contra o PDF real; leitor contra o XLSX real |
| Ponta a ponta | Os dois arquivos do caso-piloto → PDF gerado |
| Regressão de fidelidade | **Teste-âncora**: extrai as 55 linhas do PDF gerado e compara célula a célula com as 55 linhas extraídas das páginas 2–3 do GRC |

O teste-âncora é o coração do aceite. Ele parte com **uma divergência esperada e declarada**
(§9.1); qualquer outra diferença reprova a suíte. O comparador já existe — foi usado na análise
que originou esta espec.

**Critérios de aceite do MVP:**

1. As 22 seções aparecem na ordem do catálogo, com os títulos corretos.
2. As 55 linhas aparecem na ordem do catálogo.
3. 54 linhas idênticas ao GRC em código, descrição, unidade e as duas quantidades.
4. A linha `11.027.00001.00` exibe a quantidade do contrato, com a divergência sinalizada.
5. Números formatados em pt-BR.
6. Um arquivo corrompido ou fora do padrão produz mensagem de erro clara, nunca um PDF errado.
7. Duas execuções com as mesmas entradas produzem PDFs de conteúdo idêntico.

---

## 11. Fases de entrega

Cada fase é entregável e verificável isoladamente, no formato de fases do TRIADE
(contexto, plano, verificação).

| Fase | Conteúdo | Verificação | Tamanho |
|---|---|---|---|
| **F1** | Domínio e contratos: entidades, *value objects*, interfaces | Testes de domínio passam sem nenhuma dependência de infraestrutura | P |
| **F2** | Extrator do contrato (§9.4) | 57 de 57 linhas extraídas do PDF real | **G** |
| **F3** | Leitor do levantamento e do catálogo | Códigos e quantidades conferem com a planilha, com `R-MED-02` aplicada | M |
| **F4** | Reconciliação e validações | 55 linhas montadas corretamente; cada `V-*` com teste próprio | M |
| **F5** | Renderização do PDF | Teste-âncora com 54 de 55 linhas idênticas | M |
| **F6** | API e frontend | Fluxo completo pelo navegador | M |
| **F7** | Empacotamento e documentação | Container sobe e processa os arquivos do piloto | P |

**F2 é o caminho crítico** e concentra o risco técnico. Recomendo executá-la primeiro, como prova
de conceito isolada, antes de comprometer prazo com o restante.

O catálogo do contrato-piloto precisa ser produzido como insumo — 55 linhas derivadas do relatório
GRC atual. É trabalho de preenchimento, não de engenharia, e pode correr em paralelo a partir da F1.

Não há estimativa de calendário nesta versão: ela depende da alocação de time, que ainda não foi
definida (§12).

---

## 12. Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | A quantidade correta de `11.027.00001.00` é 10 (contrato) ou 6 (relatório atual)? | Define se o MVP reproduz o GRC integralmente ou o corrige |
| 2 | Quem mantém o catálogo e onde ele fica versionado entre execuções? | Sem persistência, o arquivo precisa de um dono e um repositório |
| 3 | Nome do produto e identidade visual do relatório gerado | Cabeçalho, logotipo e rodapé do PDF |
| 4 | Alocação de time e prazo desejado para a apresentação ao cliente | Cronograma das fases da §11 |
| 5 | Onde o MVP será hospedado — local, container interno ou Azure? | Empacotamento da F7 |
| 6 | Há outros contratos com o mesmo par proposta + levantamento para validar a generalização? | Um segundo caso exercitaria o catálogo de verdade |

---

## 13. Evolução prevista

Fora do MVP, na ordem de valor percebido:

1. ✅ **Grid de divergências na tela** — entregue pela
   [ESPEC 002](002-painel-de-divergencias.md): os itens em que contratado e medido não batem,
   com a mesma estrutura do relatório. Ainda **não** cobre o `Relatorio_Analise_Medição.xlsx`
   completo — resumo executivo e itens críticos seguem fora.
2. ✅ **Consumo sem previsão contratual** — **§9.2 resolvido** pela ESPEC 002 §5: o item aparece
   em bloco próprio no grid, sem alterar o documento formal.
3. **Comparação de perfis** — resolve §9.3. Segue em aberto: o layout de duas colunas não comporta
   perfil contratado e perfil medido.
4. **Persistência do catálogo** com tela de administração, migrando para PostgreSQL e recuperando
   o princípio de configuração por dados do TRIADE em sua forma plena.
5. **Histórico de competências**, permitindo comparar medições mês a mês e identificar tendências.
6. **Consolidação de aditivos** (§5.4), quando houver contrato com histórico relevante.

---

## Anexo A — Fontes de cada coluna do relatório

| Coluna | Fonte | Regra |
|---|---|---|
| Seção e ordem | Catálogo | `R-CAT-01` |
| Código | Catálogo | `R-REC-02` |
| Descrição | Contrato, com sobrescrita opcional pelo catálogo | `R-CTR-03` |
| Unidade | Catálogo | §4.3 |
| Quantidade Contratada | Contrato | `R-CTR-01`, `R-CTR-02` |
| Quantidade Medida | Planilha, aba `Levantamento` | `R-MED-01`, `R-MED-02` |
| Data do levantamento | Planilha, cabeçalho | §4.2 |
| Contrato de referência | Planilha, cabeçalho | §4.2 |
| Proposta de origem | Contrato | `R-CTR-05` |

## Anexo B — Decisões registradas

Decisões tomadas na elaboração desta espec, com a alternativa descartada.

| # | Decisão | Alternativa descartada |
|---|---|---|
| 1 | Quantidade contratada extraída do PDF do contrato | Usar a coluna da planilha |
| 2 | Escopo restrito ao relatório das páginas 2–3 | Incluir a análise de divergências |
| 3 | Solução genérica com catálogo configurável | Mapeamento fixo para o TC 52/SMIT/2024 |
| 4 | Stack TRIADE reduzida, sem banco e sem autenticação | Stack TRIADE completa |
| 5 | Quantidade medida lida da aba `Levantamento` | Recalcular a partir das 21 abas de detalhe |
| 6 | Sempre descontar recursos de desenvolvimento | Configurável por contrato ou por execução |
| 7 | Catálogo enviado por upload a cada execução | SQLite embarcado ou YAML versionado |
| 8 | Saída em PDF fiel ao GRC | Excel ou visualização em tela |
| 9 | Seção A excluída do relatório | Incluir ou tornar configurável |
| 10 | Itens com contratada zero sempre omitidos | Exibir quando houver medição |
| 11 | Perfis e pacotes como 1 contratado e 1 medido | Preservar o perfil na descrição |
| 12 | Um único PDF de contrato vigente por execução | Consolidar contrato original e aditivos |
| 13 | Sem OCR e sem LLM | Reaproveitar o pipeline do TRIADE |

*Decisões 1 a 12 foram tomadas pelo solicitante durante o levantamento. A 13 é técnica, com a
justificativa em §4.4.*

### Revisões posteriores

| # | Data | Decisão | Revoga | Motivo |
|---|---|---|---|---|
| 14 | 2026-08-05 | **Catálogo embutido na aplicação**, sem upload; a tela pede dois arquivos | Decisão 7 | O terceiro campo pedia um arquivo que o usuário não tem e não sabe o que é. O catálogo não participa da comparação, só da apresentação — e a apresentação é conhecida de antemão. O upload segue disponível na API, como campo opcional, para um contrato diferente do piloto |
| 15 | 2026-08-05 | **Formatação numérica por item**, declarada no catálogo | `R-MED-04` original | O relatório modelo grafa `1500` e `4.000` na mesma página. Uma regra global de formatação reprovaria o teste-âncora |

A decisão 7 fica registrada, e não apagada: o histórico de por que a solução mudou de forma vale
mais que a aparência de um documento sempre coerente.
