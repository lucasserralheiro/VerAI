# ESPEC 036 — A página que só diz que não tem nada

| | |
|---|---|
| **Status** | **Implementada** — 2026-08-31. As seis regras e a `V-ANX-01` entraram. Backend **1.517 → 1.527 passed**; `ruff` e `mypy` limpos. Documento do PGM: **21 → 18 seções**, **3 → 0** frases, **34 tabelas nos dois estados** — o delta é só de página. **Um artefato reancorado**, o `PACOTE_DO_PGM`, com a prova por desligamento; o piloto não se moveu, entrada por entrada. `D-04` entrou como escrito — `I-01` segue aberto e reversível em uma condição e um teste |
| **Versão** | **1.1** — 2026-08-31. A §8.3 previa *"32 tabelas antes, 32 depois"*: o número saíra de uma renderização **só dos anexos**, e no documento completo do PGM são **34**. O que a régua afirma não muda — tabela é conteúdo, e o número tem de ser o mesmo nos dois estados —, mas o valor era de outro artefato. Corrigido com o "antes" medido pela prova por desligamento. **1.0** — 2026-08-31 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) — os 19 anexos de detalhamento, implementada. É dela que vêm `anexos.json`, o leitor genérico e o comportamento que esta espec revisa |
| **Revisa** | [ESPEC 004](004-anexos-de-detalhamento.md) §9 (risco *"Anexo com aba vazia"*) e a `T-317`, que decidiram que anexo sem linhas sai **com título e observação**. A decisão foi certa para o problema de então — não quebrar — e resolve o problema errado: ninguém pediu a página; pediu-se que a geração não caísse. Também estende a [ESPEC 014](014-bordas-nas-areas-vazias-do-anexo.md) no ponto em que ela definiu o que é conteúdo (`_tem_conteudo`), aplicando o mesmo critério ao anexo inteiro |
| **Não toca** | A tabela de comprovação, a capa, o teste-âncora, o `.xlsx` da análise, a resposta da API, a tela, e **nenhum anexo que tenha conteúdo** — nem largura, nem corpo, nem corte de cabeçalho, nem ordem |
| **Referência normativa** | `backend/tests/fixtures/levantamento_pgm.xlsx` — **3 anexos vazios** de 19 (`Colocation`, `Comunicação Dados`, `CertificadosDigitais`); e `backend/tests/fixtures/levantamento.xlsx` — **zero**. A segunda é a régua de não-vazamento: se algo se mover no piloto, a mudança vazou |
| **Origem** | Conferência de quem fatura, sobre um documento gerado nesta semana: cinco páginas seguidas — `Detalhes`, `DetalhesSemDesenv`, `Servidores`, `ServidoresSemDesenv`, `BD` —, cada uma com o nome da aba em título e a frase *"A planilha não trouxe conteúdo para este anexo."* A planilha daquele órgão não está versionada; o caso reprodutível equivalente é o do PGM |

---

## 1. Problema

Um anexo cuja aba não veio na planilha produz **uma página inteira dizendo que não tem nada**:

```
Detalhes

A planilha não trouxe conteúdo para este anexo.
```

Não é caso de borda. Nas duas planilhas versionadas:

| Planilha | Anexos configurados | Vazios | Páginas assim |
|---|---|---|---|
| `levantamento.xlsx` (piloto/SMIT) | 19 | **0** | 0 |
| `levantamento_pgm.xlsx` | 19 | **3** | 3 |

E no documento medido do PGM (renderização real, 2026-08-31): **21 seções** — capa, corpo e 19
anexos —, **3 parágrafos** com a frase e **34 tabelas**. As três seções vazias não produzem tabela
nenhuma: são só a quebra de seção e dois parágrafos.

O documento vai ao órgão como peça de cobrança. Três — ou cinco — páginas que declaram ausência de
conteúdo não informam quem confere: **o anexo ausente já é visível pela ausência**, e a página
transforma um fato mudo em ruído impresso, no meio de um documento que o leitor percorre à procura
do que precisa conferir.

**A ausência, porém, nem sempre é inocente.** É o outro lado do problema, e é ele que impede a
correção de ser de uma linha. O [README](../../README.md) §"Limitações conhecidas" já o registra:

> Para uma planilha que nomeie as abas de outro jeito, ela produz dezenove seções dizendo *"a
> planilha não trouxe conteúdo para este anexo"* — em silêncio, sem achado e sem aviso. É a falha
> que a `R-GRD-06` existe para impedir, num lugar onde ela não foi aplicada.

Hoje aquelas dezenove páginas são o **único** sinal de que a planilha inteira pode estar com o
layout trocado. Apagá-las sem pôr nada no lugar troca ruído por silêncio — e silêncio, aqui, é pior.

## 2. O que foi levantado no código

### 2.1 Onde a página nasce

`DocxRenderer._anexos`
([docx_renderer.py:397-408](../../backend/src/infrastructure/report/docx_renderer.py#L397-L408)):

```python
for anexo in relatorio.anexos:
    secao = self._secao_do_anexo(documento, anexo)   # ← a seção nasce ANTES do teste
    if anexo.vazio:
        self._anexo_vazio(documento, anexo)
        continue
    self._tabelas_do_anexo(documento, anexo, secao)
```

e o texto em `_anexo_vazio`
([docx_renderer.py:433-450](../../backend/src/infrastructure/report/docx_renderer.py#L433-L450)) —
título em negrito com o dobro do corpo, mais o parágrafo da frase.

### 2.2 Apagar a frase não resolve; deixa a página

A ordem do §2.1 é o detalhe que decide o desenho. `_secao_do_anexo` chama
`documento.add_section(WD_SECTION.NEW_PAGE)` **antes** de o anexo ser interrogado. Remover só o
corpo de `_anexo_vazio` deixaria a quebra de seção de pé: o documento perderia o título e a frase e
**ganharia uma página em branco** no lugar de cada uma — com o timbrado, o cabeçalho e o rodapé
institucional, que são vinculados à seção.

Trocaria uma página que explica por uma página que não explica. A correção tem de anteceder a
criação da seção.

### 2.3 Por que o anexo chega vazio

`AnexoReader` monta **os 19 anexos configurados**, existam ou não as abas
([anexo_reader.py:56-62](../../backend/src/infrastructure/annex/anexo_reader.py#L56-L62)):

```python
forma = (
    self._leitor.ler(livro[config.aba])
    if config.aba in livro.sheetnames
    else FormaDaAba(linhas=(), mesclagens=(), proporcoes=())
)
```

É deliberado, e continua certo: `anexos.json` fixa dezenove abas medidas no GRC, e o escopo
contratado varia por órgão — o PGM não tem `Colocation` porque não contratou colocation. Derrubar a
geração por isso seria desproporcional, e o próprio módulo diz isso no cabeçalho.

O que está errado não é **ler** a ausência; é **imprimi-la**.

### 2.4 `vazio` pergunta a coisa errada

[annex.py:135-137](../../backend/src/domain/entities/annex.py#L135-L137):

```python
@property
def vazio(self) -> bool:
    return not self.linhas
```

Pergunta se a aba trouxe **linhas**, não se trouxe **conteúdo**. Dois casos escapam por aí, e os
dois foram medidos contra o renderizador, não deduzidos:

**a) Aba que existe só com resquício de formatação.** `AbaReader._colunas_uteis` apara as colunas
finais sem conteúdo e pode devolver **zero**; as linhas sobrevivem, vazias. O anexo então **não é
`vazio`**, e sai como tabela invisível:

```
Anexo(aba='SoResiduo', linhas=((), (), ()))
  → vazio? False · total_colunas 0
  → 1 seção nova, 1 tabela de 3 fileiras × 1 coluna, sem borda e sem texto
```

Ou seja: hoje esse caso já produz **página em branco**, sem sequer a frase. Não é hipótese — é o
mesmo defeito por outro caminho.

**b) Aba com figura ancorada e nenhuma célula.** `Anexo.blocos()` sabe emitir a figura mesmo com
`linhas` vazio — ela entra pelo ramo final, o das figuras ancoradas depois do fim da aba:

```
Anexo(aba='SoFigura', linhas=(), imagens=(png,))
  → vazio? True · blocos() = [(0, 0, ImagemAnexo(...))]
```

O `vazio` curto-circuita antes, imprime a frase e **perde a figura**. Nenhuma das duas planilhas
versionadas exercita este caso: `Internet` e `ServicosEmNuvem` têm figura *e* células.

### 2.5 Já existe um critério de conteúdo, e ele é da ESPEC 014

`_tem_conteudo` ([annex.py:43-51](../../backend/src/domain/entities/annex.py#L43-L51)) — texto ou
preenchimento, **borda não conta** (`R-BRD-02`). É o critério que decide a largura de cada bloco e
quais linhas saem sem grade. Esta espec **não inventa um segundo conceito de vazio**: usa o mesmo,
aplicado ao anexo inteiro em vez de a uma faixa de linhas.

### 2.6 Quem consome `Report.anexos`

Um só consumidor: o `DocxRenderer`. A `AnaliseDaMedicao`, a resposta da API e a tela não os leem —
a ESPEC 004 §10 nº 3 fechou isso (*"o detalhamento fica no `.docx`"*).

**E os achados não entram no `.docx`.** Nenhuma validação é impressa no documento; elas vão para a
tela e para a resposta da API. A consequência importa para a §8.3: **a validação nova desta espec
não move um byte de nenhum artefato**.

## 3. Objetivo

Que anexo sem conteúdo **não ocupe página nenhuma** do documento, e que a informação que a página
carregava — *"esta planilha não trouxe as abas de detalhamento"* — passe a ser dita onde é
acionável: no painel de achados, uma vez, quando de fato há o que dizer.

**Não é objetivo:** decidir quais abas cada órgão deve ter; ler abas que não estão em `anexos.json`;
nem impedir a emissão do documento por causa de anexo.

## 4. Escopo

### 4.1 Dentro do escopo

- A omissão da seção, do título e da frase para o anexo sem conteúdo.
- O critério de "sem conteúdo", estendido aos dois casos do §2.4.
- Um achado, e um só, para o caso em que **nenhuma** aba configurada trouxe conteúdo.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Abas presentes na planilha e **ausentes** de `anexos.json` — o PGM tem `Alta Plataforma`, `Impressao` e `ETL`, hoje descartadas em silêncio | É a falha simétrica desta, e é de **catálogo**, não de renderização. Misturá-las amarraria uma decisão de configuração a uma de apresentação, e a inclusão de uma aba nova exige medir a geometria dela no GRC. Registrada em `I-03` |
| `anexos.json` por órgão | Mesma razão. O catálogo único é decisão da ESPEC 004 §4.1, e nada aqui a contesta |
| Bloquear a geração por ausência de anexos | `D-05`. O levantamento já foi lido, a identidade já foi conferida, e a tabela de comprovação — que é o que fatura — está inteira |
| Alterar largura, corpo, corte ou ordem de qualquer anexo com conteúdo | `R-VAZ-05`. Esta espec só **subtrai** seções |
| A aba `Comunicação Dados Histórico` | `R-ANX-08` já a exclui do catálogo. Ela nunca foi anexo |

## 5. Regras

| ID | Regra |
|---|---|
| `R-VAZ-01` | **Anexo sem conteúdo não produz página.** Nem seção, nem quebra, nem título, nem observação. É omitido do documento inteiro |
| `R-VAZ-02` | **Sem conteúdo** é: nenhuma célula com texto ou preenchimento — o critério de `_tem_conteudo` da ESPEC 014, borda não conta (`R-BRD-02`) — **e** nenhuma figura ancorada. Anexo com figura e nenhuma célula **tem** conteúdo, e sai (§2.4b) |
| `R-VAZ-03` | O teste de `R-VAZ-01` acontece **antes** da criação da seção. É o que separa omitir de deixar página em branco (§2.2) |
| `R-VAZ-04` | **A leitura continua fiel.** Os 19 anexos configurados continuam sendo lidos e chegando ao `Report`; a omissão é decisão do renderizador. É o que mantém o fato disponível para `V-ANX-01` e o que impede que a supressão vire perda de informação na camada errada |
| `R-VAZ-05` | **Nenhum anexo com conteúdo muda.** O delta do documento é exatamente o conjunto de seções omitidas — nada mais se move, em nenhum dos dois pares |
| `R-VAZ-06` | Os anexos remanescentes saem na ordem de `anexos.json`, sem renumeração e sem qualquer marca de que houve omissão |

### 5.1 Validação nova

| ID | Severidade | Quando dispara |
|---|---|---|
| `V-ANX-01` | `AVISA` | **Nenhum** dos anexos configurados trouxe conteúdo, havendo anexos lidos. Um achado, não dezenove (`R-GRD-06`): a causa provável é a planilha nomear as abas de outro jeito, e as dezenove ausências são a consequência repetida |

Não dispara em nenhuma das duas planilhas versionadas — o PGM tem 16 anexos com conteúdo. É guarda
de anomalia, no precedente da `V-MED-04` (ESPEC 031) e da `V-CTR-06` (ESPEC 032).

Texto proposto, em quatro partes (`R-DOC-05`):

- **título:** *"Nenhuma aba de detalhamento foi reconhecida na planilha."*
- **causa:** *"As 19 abas de anexo esperadas não foram encontradas, ou vieram sem conteúdo. A tabela de comprovação foi lida normalmente."*
- **ação:** *"Confira se a planilha é a do levantamento completo. O documento sai sem os anexos de detalhamento."*
- **detalhe:** a lista das abas configuradas, para o suporte.

## 6. Decisões de engenharia

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Omitir a seção inteira, não só o texto** | §2.2, medido: a seção nasce antes do teste. Apagar só o corpo trocaria a página que explica por uma página em branco com timbrado |
| `D-02` | **O critério de vazio é o da ESPEC 014, estendido** | O domínio já tem `_tem_conteudo`, e ele já decide largura de bloco e grade. Um segundo critério de "vazio" ao lado do primeiro é a espécie de divergência que ninguém percebe até os dois discordarem |
| `D-03` | **A decisão é do renderizador; o leitor continua lendo os 19** | Omitir no leitor pareceria mais limpo e apagaria o fato: `Report.anexos` passaria a ter 16 no PGM, e `V-ANX-01` não teria como distinguir *"nenhuma aba veio"* de *"nenhum anexo foi configurado"*. Presença é fato da planilha; página é decisão de apresentação (`R-VAZ-04`) |
| `D-04` | **Ausência parcial não avisa** | 3 de 19 no PGM é o **escopo contratado**, não anomalia: aquele órgão não tem colocation. Avisar a cada competência transformaria um fato estável em ruído mensal, e `R-GRD-06` manda relatar a causa, não a consequência. Sujeito a `I-01` |
| `D-05` | **`AVISA`, não `BLOQUEIA`** | O `AnexoReader` já decidiu, com razão, que aba faltante não derruba a geração. Quando `V-ANX-01` dispara, o levantamento foi lido (`V-MED-01` passou) e a identidade foi conferida (`V-IDT-01`/`V-IDT-02`): o que fatura está inteiro, e o que falta é detalhamento. Bloquear seria decidir com informação parcial o que quem confere decide com informação inteira |
| `D-06` | **Reancorar o `PACOTE_DO_PGM` é consequência esperada; o `PACOTE_DO_PILOTO` não pode se mover** | O piloto tem zero anexos vazios (§1). Ele é a régua de não-vazamento desta espec, e vale mais que o hash do PGM: se ele se mover, o critério de `R-VAZ-02` está classificando como vazio algo que tem conteúdo |
| `D-07` | **A `T-317` é revista, não corrigida** | Ela pedia que anexo vazio *"não quebrasse"*, e a página foi o meio. O fim continua valendo — a geração não pode cair —, e o teste passa a afirmá-lo pela omissão. Está no §11 |

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/annex.py` | `Anexo.vazio` passa a perguntar por conteúdo e figuras (`R-VAZ-02`) |
| `infrastructure/report/docx_renderer.py` | `_anexos`: o teste antecede a criação da seção e o anexo vazio é pulado (`R-VAZ-01`, `R-VAZ-03`); `_anexo_vazio` **sai inteiro** |
| `infrastructure/validations/annex_validations.py` | **Arquivo novo** — `v_anx_01_nenhuma_aba_de_anexo_reconhecida` |
| `infrastructure/di/container.py` | Chamada da validação logo após a leitura dos anexos ([container.py:317](../../backend/src/infrastructure/di/container.py#L317)), que já só ocorre quando o relatório vai existir |
| `infrastructure/annex/anexo_reader.py` | **Nenhuma** (`D-03`) |
| `application/`, `api/`, `frontend/` | **Nenhuma.** Nenhum deles lê `Report.anexos` (§2.6) |
| `README.md` §"Limitações conhecidas" | O parágrafo das dezenove seções deixa de valer: passa a registrar o comportamento novo e a `V-ANX-01` |
| `docs/specs/004` §9 | A linha *"Anexo com aba vazia"* remete a esta espec |

## 8. Testes e critério de aceite

### 8.1 As regras

| Regra | Verificação |
|---|---|
| `R-VAZ-01` · `R-VAZ-03` | Relatório com um anexo vazio: o documento não ganha seção, não ganha parágrafo, **e a geração não levanta exceção** — o que a `T-317` sempre quis afirmar |
| `R-VAZ-02` a | Anexo com linhas e nenhuma célula útil (`linhas=((), (), ())`, o caso do §2.4a) é omitido. Hoje ele sai como página em branco |
| `R-VAZ-02` b | Anexo com figura e nenhuma célula **sai**, com a figura. Hoje ele imprime a frase e perde a figura |
| `R-VAZ-02` c | Anexo cujas células só têm **borda** é omitido — `R-BRD-02`, o critério não muda de lado |
| `R-VAZ-05` | No PGM: **34 tabelas antes e 34 depois**, com as mesmas larguras e o mesmo conteúdo. O delta é só de seções |
| `R-VAZ-06` | Os 16 anexos do PGM saem na ordem de `anexos.json` |
| `V-ANX-01` dispara | 19 anexos vazios → **um** achado, `AVISA` |
| `V-ANX-01` cala | 18 vazios e 1 com conteúdo → **nenhum** achado. É o teste que impede a regra de virar aviso de ausência parcial (`D-04`) |

### 8.2 Regressão

- `test_docx_anexos` — 19 seções, 14 retrato e 5 paisagem, larguras, figuras, cabeçalho repetido:
  **passam sem alteração**. A fixture é o piloto, e ele não tem anexo vazio;
- `test_api_e2e` — `len(documento.sections) == 2 + 19` **continua valendo**, pela mesma razão;
- o **teste-âncora** e as 55 linhas da tabela de comprovação: intocados (`R-ANX-09`);
- `test_desempenho` — a geração fica mais barata, nunca mais cara: anexo omitido é trabalho não
  feito;
- os dois `.xlsx` de análise: **byte a byte inalterados**. São o teste que falha se a alteração
  vazar para onde não devia.

### 8.3 O delta esperado

**Três seções somem do documento do PGM. Nada mais.**

| Âncora | Esperado |
|---|---|
| `PACOTE_DO_PILOTO` (`.docx`) | **Inalterado, entrada por entrada.** Régua de não-vazamento (`D-06`) |
| `PACOTE_DO_PGM` → `word/document.xml` | **Muda.** Reancoragem com justificativa, no rito do cabeçalho de `test_identidade_dos_artefatos.py` |
| `PACOTE_DO_PGM` → demais entradas | **A medir, não a prever.** `docProps/app.xml` é candidato a se mover; nenhuma outra deveria |
| Documento do PGM: seções | **21 → 18** (medido em 2026-08-31) |
| Documento do PGM: parágrafos com a frase | **3 → 0** |
| Documento do PGM: tabelas | **34 → 34** |
| `ANALISE_DO_PILOTO` e `ANALISE_DO_PGM` (`.xlsx`) | **Inalterados** |
| Achados de qualquer par | **Inalterados** — `V-ANX-01` não dispara em nenhum dos dois |
| `test_anexo_sem_linhas_sai_com_titulo_e_observacao` | **Invertido por decisão** (`D-07`). É a única alteração obrigatória em teste existente |

**Critério de aceite:** qualquer movimento no pacote do piloto reprova a entrega. Qualquer tabela a
mais ou a menos no PGM reprova a entrega. Qualquer achado novo nos dois pares reprova a entrega.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **A supressão apagar o sinal de planilha trocada** | `V-ANX-01`, e é a razão de a validação estar nesta espec e não numa seguinte. Entregar a omissão sem o achado é a única forma de esta espec sair pior que o defeito |
| O critério novo classificar como vazio um anexo que tem conteúdo | `D-06`: o `PACOTE_DO_PILOTO` é a rede, e ele cobre 19 anexos reais, com 15.955 células escritas. Um falso positivo move o hash |
| Alguém "simplificar" a omissão para dentro do leitor | `D-03` e o teste de `V-ANX-01` calando com 18 vazios: movido para o leitor, aquele teste não tem como ser escrito |
| A `V-ANX-01` virar ruído mensal | `D-04` — dispara só no caso total. Se `I-01` reverter a decisão, o aviso passa a ser por competência e o risco volta |
| Reancorar às cegas o pacote do PGM | O delta é provado **desligando só esta regra**: com `vazio` de volta ao critério antigo e sem a omissão, o pacote tem de voltar ao hash de hoje, entrada por entrada. É a mesma prova que a ESPEC 028 usou |
| A página omitida esconder de quem confere que o anexo existia | O documento nunca prometeu 19 anexos: `anexos.json` é catálogo interno, e o GRC de referência imprime o que o órgão contratou. Registrado em `I-02` |

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-01` | Avisar também na ausência **parcial**, listando as abas omitidas? Custo zero no documento (os achados não vão para o `.docx`, §2.6); custo em ruído na tela, toda competência, para órgãos cujo escopo é estável | **Sim, a fase D.** `D-04` decidiu que não; é decisão de negócio, não de engenharia |
| `I-02` | Deve haver, no documento, alguma menção de que aquele órgão não tem os anexos X, Y e Z? | Não. Fora do escopo desta espec; se vier, é linha da capa, não página de anexo |
| `I-03` | Abas presentes na planilha e ausentes de `anexos.json` (`Alta Plataforma`, `Impressao`, `ETL` no PGM) são descartadas em silêncio — o defeito simétrico | Não. Espec própria. É de catálogo, e envolve medir no GRC a geometria de cada aba nova (§4.2) |
| `I-04` | `V-ANX-01` nunca dispara nas planilhas conhecidas. Vale mantê-la? | Não bloqueia. Precedente de `V-MED-04` e `V-CTR-06`: guarda de anomalia que não se paga em ruído |

## 11. Relação com a ESPEC 004 e a `T-317`

A `T-317` dizia:

> Um anexo sem linhas deve sair com o título e uma observação — **não quebrar**.
>
> `Comunicação Dados Histórico` já mostra que abas vazias existem nesta planilha.

O **fim** era não quebrar, e continua valendo. O **meio** — a página com título e observação — foi
escolhido num incremento em que só existia uma planilha, a do piloto, onde nenhuma aba configurada
falta. Com uma planilha só, a página vazia era hipótese; com o PGM e com o documento que originou
esta espec, ela é comportamento observado — e o que se vê é que o meio não serve ao fim: a página
não protege a geração. Quem a protege é o `AnexoReader` devolver `FormaDaAba` vazia em vez de
estourar (§2.3), e isso não muda aqui.

Esta espec troca o meio e mantém o fim: a geração continua não caindo, e o teste passa a afirmá-lo
pela **ausência** de seção. É o mesmo movimento da ESPEC 028 sobre a linha zerada — o que a planilha
não tem, o documento não escreve.

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Inventário das âncoras que se movem e delta medido, antes de qualquer código (`D-06`) | PP |
| B | Testes escritos antes: os quatro casos de `R-VAZ-02` e os dois de `V-ANX-01` | P |
| C | `Anexo.vazio`, a omissão no renderizador e a remoção de `_anexo_vazio` | PP |
| D | `V-ANX-01` e registro no contêiner — depende de `I-01` | PP |
| E | Reancoragem do `PACOTE_DO_PGM`, com o delta provado por desligamento | P |
| F | `README` §"Limitações conhecidas" e a nota na ESPEC 004 §9 | PP |

**Estimativa: meio dia.** O código é curto e já foi medido; o trabalho está em A e E — e em decidir
`I-01`, que é a única parte que não se resolve lendo o repositório.
