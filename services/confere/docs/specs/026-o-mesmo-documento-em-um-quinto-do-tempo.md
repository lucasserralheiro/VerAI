# ESPEC 026 — O mesmo documento em um quinto do tempo

| | |
|---|---|
| **Status** | **Proposta** — 2026-08-19 |
| **Versão** | 1.0 — 2026-08-19 |
| **Depende de** | [ESPEC 003](003-relatorio-em-docx.md), [ESPEC 004](004-anexos-de-detalhamento.md), [ESPEC 012](012-responsividade-durante-a-geracao.md), [ESPEC 014](014-bordas-nas-areas-vazias-do-anexo.md) — implementadas |
| **Revisa** | A ESPEC 012 §4.2, que pôs *"acelerar a renderização do DOCX"* fora de escopo, e o `I-09` que ela deixou aberto: *"há apetite para uma espec de desempenho?"* — esta é a resposta |
| **Não toca** | Nenhuma regra de negócio. Nenhum arquivo de `domain/` ou `application/`. **Nenhum byte** dos dois artefatos — `R-DES-01` é a espec inteira em uma linha |
| **Referência normativa** | Os dois pares reais: `contrato.pdf` + `levantamento.xlsx`; `contrato_pgm.pdf` + `aditivo_pgm.pdf` + `levantamento_pgm.xlsx` |
| **Origem** | *"faça uma análise se é possível otimizar o desempenho do processamento, geração do relatório ao clicar em 'Gerar relatório' sem causar regressão nos cenários que estão funcionando adequadamente"* |

---

## 1. Problema

A ESPEC 012 mediu 19 s de renderização de DOCX, declarou-os fora de escopo com um argumento
correto — *"misturar as duas coisas faria uma mudança de desempenho passar de carona numa
correção de disponibilidade"* — e registrou o assunto em `I-09`. A correção de disponibilidade
foi entregue e está estável. O assunto volta agora, sozinho, com o critério de aceite que lhe
falta.

O que mudou desde então não foi a opinião: foi a amostra. A ESPEC 019 trouxe o par do PGM com
aditivo, e ele **não custa 22 s**.

| Par | Tempo total de `POST /reports` |
|---|---|
| Piloto (SMIT) | **31 s** |
| PGM, com um aditivo | **~115 s** |

Três consequências, em ordem de gravidade:

1. **O teto do frontend está a 180 s** (ESPEC 012 `D-05`), e foi dimensionado com folga de 8×
   sobre os 22,8 s medidos em produção. Sobre 115 s a folga é de 1,6×. Um levantamento
   moderadamente maior que o do PGM estoura o *timeout*, e o usuário recebe *"a geração passou
   de três minutos"* — uma mensagem que descreve o sintoma e nomeia a causa errada.
2. **`CapacityLimiter(1)`** (ESPEC 012 `D-02`) serializa por réplica. Duas conferências na mesma
   competência significam quase quatro minutos para a segunda pessoa. O `I-08` — *"quantas
   conferências simultâneas o uso real produz?"* — continua aberto, e a resposta a ele fica
   muito mais fácil se cada geração custar 35 s em vez de 115.
3. **A própria suíte paga.** O `conftest.py` já registra, em comentário medido, *"renderizar
   DOCX com os 19 anexos — 29,0 s, a etapa mais cara da suíte"*, e por isso cacheia o documento
   em fixture de sessão. Medida agora, a suíte inteira leva **26 min 54 s** para 578 testes, e
   os doze mais lentos — 950 s, quase 60% do total — são **todos** renderização de DOCX
   (§8.5). O custo é da mesma função.

Nada disso é o problema em si. O problema é que **os 19 s da ESPEC 012 nunca foram
diagnosticados** — foram atribuídos, plausivelmente, a *"emitir ~25 mil células, uma a uma"*.
A medição mostra que a atribuição está errada em quase toda a sua extensão: o custo não é o
volume de células, é o caminho pelo qual cada uma delas é escrita.

---

## 2. O que foi medido

`cProfile` sobre `feature/evolucao`, máquina de desenvolvimento, com as fixtures do repositório.
Os tempos de parede foram tomados **fora** do perfilador; os de perfil estão marcados como tal.

### 2.1 O tempo por fase

| Fase | Piloto | PGM | Onde |
|---|---|---|---|
| Extração do contrato (PDF) | 6,1 s | 7,0 s | `pdfplumber_extractor.py` |
| Extração do aditivo (PDF) | — | 3,4 s | idem |
| Leitura da aba `Levantamento` | 0,1 s | 0,1 s | `levantamento_reader.py` |
| Validações e reconciliação | ~0,3 s | ~0,7 s | `container.gerar` |
| Leitura dos anexos | 2,8 s | 7,7 s | `anexo_reader.py` |
| **Renderização do DOCX** | **22,1 s** | **96,6 s** | `docx_renderer.py` |
| Renderização do XLSX da análise | 0,1 s | 0,1 s | `xlsx_analise_renderer.py` |
| **Total** | **~31 s** | **~115 s** | |

A ESPEC 012 §2.2 registrou que o renderizador da análise não agravou nada, e continua não
agravando: 0,1 s em 115. Fica confirmado pela segunda vez, para que a suspeita não se repita.

**A renderização do DOCX é 71% do piloto e 84% do PGM.** É o único alvo que muda o número.

### 2.2 `ooxml.escrever` — 22,1 s dos 34 s de perfil, e não por causa das células

`escrever` é chamada 15.955 vezes no piloto e 31.048 no PGM. O perfil do piloto:

```
ncalls   tottime  cumtime  função
587.924    4,769    5,619  docx/oxml/xmlchemy.py:380(get_child_element)
114.112    4,183    5,564  docx/oxml/xmlchemy.py:656(first_child_found_in)
 60.714    3,690    3,690  docx/oxml/xmlchemy.py:687(xpath)
139.409    2,025    2,659  docx/oxml/parser.py:44(OxmlElement)
 15.955    0,721   22,169  infrastructure/report/ooxml.py:202(escrever)
```

O corpo de `escrever` faz sete atribuições de propriedade do `python-docx`
(`space_before`, `space_after`, `bold`, `font.size`, `font.name`, `font.color.rgb`, mais o
`rFonts` à mão). **Cada uma delas** passa por `get_or_add_child` → `insert_element_before`,
que avalia um **XPath sobre a lista de sucessores** para descobrir em que posição do esquema
OOXML o elemento entra.

São 114 mil avaliações de XPath para escrever elementos cuja ordem já é conhecida em tempo de
escrita: `w:rFonts`, `w:b`, `w:color`, `w:sz`. O `w:pPr` e o `w:rPr` **nascem vazios** — não há
nada a procurar.

Não são as 25 mil células. São as sete buscas por célula.

### 2.3 As mesclagens dos anexos são quadráticas

Este é o gargalo do PGM, e não aparece no piloto com força suficiente para ser notado. Perfil da
renderização do PGM, já com a correção de §2.2 aplicada (para isolar o efeito):

```
ncalls   tottime  cumtime  função
 62.464   40,313   40,432  docx/oxml/xmlchemy.py:397(get_child_element_list)
 37.884    7,562   51,910  docx/oxml/table.py:778(_tr_idx)
  3.157    0,580   71,871  docx/oxml/table.py:508(merge)
```

**`merge` responde por 71,9 s de 82 s de perfil, em 3.157 mesclagens.**

A causa está em `CT_Tc.merge`:

```python
def merge(self, other_tc):
    top, left, height, width = self._span_dimensions(other_tc)   # ← O(fileiras)
    top_tc = self._tbl.tr_lst[top].tc_at_grid_offset(left)       # ← O(fileiras)
    top_tc._grow_to(width, height)                               # ← O(fileiras) por linha
```

`_span_dimensions` chama `_tr_idx`, que é `self._tbl.tr_lst.index(self._tr)` — **reconstrói a
lista de todas as fileiras da tabela a cada mesclagem**, e depois procura a fileira nela. Em uma
aba como `Office365`, com uma mesclagem por linha de dados, o custo total é quadrático no número
de linhas.

O `ooxml.mesclar` já matou **metade** deste problema, e o registrou:

> *"`Table.cell` remonta a grade a cada chamada. `Office365` tem 698 mesclagens (…) sozinho,
> respondia pela maior parte dos cinco minutos que a primeira versão levava."*

A metade que sobrou está dentro da biblioteca, e por isso não foi vista: passar as células
prontas evitou a remontagem da grade, mas `merge` continua varrendo as fileiras por conta
própria.

**A curva foi medida, e é a de um algoritmo quadrático.** Tabela sintética de 8 colunas, uma
mesclagem de linha inteira por fileira, dobrando o número de fileiras:

| | 400 fileiras | 800 fileiras | razão |
|---|---|---|---|
| `ooxml.mesclar` (hoje) | 6,43 s | 26,69 s | **4,15×** |
| `mesclar_regiao` (proposta) | — | — | **1,16×** |

Dobrar a entrada quadruplica o custo. É esse `4,15` que `T-2011` transforma em asserção, e é
por ele que o teto de `2,6` é folgado dos dois lados (§8.1, `D-07`).

### 2.4 A informação que falta à biblioteca já está no chamador

`_span_dimensions` existe para descobrir, a partir de duas células diagonais, qual é o retângulo
`(topo, esquerda, altura, largura)`. Mas [`_mesclar_anexo`](../../backend/src/infrastructure/report/docx_renderer.py)
**calcula esse retângulo** para depois destruí-lo em duas células:

```python
primeira = (mesclagem.linha - inicio) * colunas + mesclagem.coluna
ultima   = (mesclagem.ate_linha - inicio) * colunas + ate_coluna
ooxml.mesclar(grade[primeira], grade[ultima])
```

Ou seja: a varredura de O(fileiras) redescobre, dentro da biblioteca, o que o chamador tinha em
mãos duas linhas antes. Passar as coordenadas em vez das células torna a operação O(1) por
mesclagem, e o resto de `merge` — `_span_to_width` e `_swallow_next_tc` — já é local aos irmãos
e barato.

A invariante que isso exige é a que `_mesclar_anexo` **já declara** no seu próprio comentário:

> *"as regiões mescladas do Excel nunca se sobrepõem: fundir uma não invalida as células de
> outra"*

Mais uma, que a leitura do `python-docx` confirma: mesclar remove `w:tc`, **nunca `w:tr`** — a
lista de fileiras da tabela não muda durante o laço.

### 2.5 O que o protótipo produziu

As duas correções foram implementadas em memória (sem tocar no repositório) e executadas contra
os dois pares reais, comparando o `sha256` do pacote gerado antes e depois:

| Par | DOCX antes | DOCX depois | Pacote idêntico? |
|---|---|---|---|
| Piloto | 22,1 s | **5,3 s** | **sim** |
| PGM (+ aditivo) | 96,6 s | **16,5 s** | **sim** |

Projeção sobre o pipeline completo: piloto **31 s → ~14 s**; PGM **~115 s → ~35 s**.

Três divergências apareceram no caminho até a identidade, e as três importam porque são
exatamente o que uma reimplementação descuidada erra em silêncio:

| O que o `python-docx` faz | O que a primeira tentativa fez | Como apareceu |
|---|---|---|
| `add_run("")` **não emite** `<w:t>` | Emitia `<w:t></w:t>` | 4 células a mais no `document.xml` |
| `sz` é `int(Emu(Pt(x)).pt * 2)` — **truncamento** | `round(x * 2)` | corpo 4,8 pt saía `10` em vez de `9`. **Seis dos catorze corpos de `anexos.json` divergem** entre truncar e arredondar — 4,3 · 4,4 · 4,8 · 5,8 · 6,4 · 8,9 —, um em cada um destes anexos: `Servidores`, `ServidoresSemDesenv`, `Detalhes`, `WIFI`, `NAS`, `ServicosVcloud` |
| `add_run` converte `\t` em `<w:tab/>` e `\n` em `<w:br/>`, e marca `xml:space="preserve"` | Escrevia o tab literal no `<w:t>` | as abas de anexo têm `DATA DE ATIVACAO\t:\t26/06/2023` |

Nenhuma das três seria vista por inspeção, e nenhuma quebraria um teste de conteúdo — o texto
lido de volta é o mesmo. As três foram encontradas pelo `diff` do `document.xml`. É o argumento
de `D-05`.

### 2.6 O que **não** compensa mexer, e por quê

Medido, para que a decisão fique registrada e não seja refeita:

| Candidato | Medição | Veredito |
|---|---|---|
| Extração do PDF (6–10 s) | `parse_objects` do `pdfminer` responde por **17,0 s dos 17,8 s** de perfil. O trabalho pós-parse — `extract_words`, `extract_text`, montagem da grade — é 0,8 s | **Irredutível em processo.** Não há caminho barato: as bordas da tabela exigem interpretar o *content stream* de todas as páginas |
| Leitura dos anexos (2,8 s / 7,7 s) | **2,15 s são apenas `load_workbook(data_only=True)`**; a varredura de 27 mil células é 0,6 s. `read_only=True` abre em 0,10 s — 20× mais rápido — e **expõe fonte, preenchimento e borda** | Tentador, mas `read_only` **não** dá `merged_cells` nem `column_dimensions`, que os anexos usam. Ficaria um segundo leitor de XML de pacote. **Fora do escopo** por `D-06` |
| `tabela._cells` resolvido duas vezes por tabela | 1,5 s de perfil, ~0,25 s de ganho | Real, mas ruído perto dos outros dois. Entra como limpeza, não como objetivo |
| `_normalizar_pacote` recomprime o pacote inteiro | ~0,4 s | Idem |
| `pdf.pages[0].extract_text()` chamado 3× | ~0,1 s | Limpeza. O *docstring* de `_identificar` afirma que *"nenhuma página é aberta de novo"*, o que é verdade, mas o texto **é** recomputado |
| Resposta sem `GZipMiddleware` | DOCX de 3,85 MB → 5,1 MB de base64 no JSON | Ganho de ~25% de tráfego, uma linha. **Fora do escopo**: é rede, não CPU, e merece medição própria |

### 2.7 A identidade de bytes já é critério deste projeto

`R-DOC-10` exige que duas execuções da mesma entrada produzam o mesmo documento, e o
[`_normalizar_pacote`](../../backend/src/infrastructure/report/docx_renderer.py) existe só para
isso — carimbo de hora fixo em cada entrada do zip. A suíte já explora essa propriedade em dois
lugares:

- `test_quantitativo_consolidado.py::_partes` — `sha256` de **cada entrada** do pacote, excluindo
  `docProps/core.xml`, que carrega o `dcterms:modified`;
- `test_capa.py::test_t1408_o_corpo_do_documento_nao_se_move` — `sha256` do corpo de texto
  inteiro, com o comentário *"reancorada pela ESPEC 024"* registrando que reancorar é um ato
  deliberado.

**Esta espec não precisa inventar um critério de aceite: ela precisa usar o que já existe, com
o escopo aberto para o pacote inteiro.**

---

## 3. Objetivo

Reduzir o tempo de `POST /reports` em ~55% no piloto e ~70% no par do PGM, **sem que um único
byte dos dois artefatos mude**.

Não é uma espec de produto: nada na tela muda, nada na API muda, nenhuma regra de negócio é
tocada. É uma espec de mecanismo, e o seu critério de aceite é a ausência de diferença.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Reescrever `ooxml.escrever` para emitir o `w:pPr` e o `w:rPr` diretamente, na ordem do esquema.
- Substituir a mesclagem de anexo por uma que use as coordenadas que o chamador já conhece.
- Fixar a versão do `python-docx` no `pyproject.toml` (`R-DES-07`).
- Testes de equivalência com a API pública da biblioteca, de identidade de bytes e de
  complexidade (§8).
- As duas limpezas de §2.6 que estão no caminho: `tabela._cells` resolvido uma vez, e o
  `extract_text()` da página 1 lido uma vez.

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| Leitura dos anexos em `read_only` | O ganho é real (2 a 6 s) mas exige um leitor de `mergeCells` e `column_dimensions` direto do pacote. É **outra** mudança, com outro risco — fidelidade de anexo, que é o critério da ESPEC 004 e da 014. Ver `D-06` e `I-31` |
| Cache do `Contract` por hash do PDF | Resolveria 6–10 s em resubmissão, que é o caso comum de quem corrige a planilha. Mas guarda dado derivado entre requisições, e a ESPEC 001 §7.2 decidiu que a aplicação é sem estado. Não é uma decisão para uma espec de desempenho derrubar de lado. Ver `I-32` |
| `GZipMiddleware` na resposta | Ganho de rede, não de CPU. Uma linha, mas merece medição própria — inclusive porque o DOCX já é um zip |
| Paralelismo real (processos) | A ESPEC 012 `D-03` decidiu threads, e a decisão continua valendo: vazão vem de réplicas. Com a geração em 35 s, a pressão para reabrir isso cai, não sobe |
| Remover o `CapacityLimiter(1)` | ESPEC 012 `D-02`, e o `I-08` que o sustenta, continuam abertos. Ver `D-09` |
| Trocar o `python-docx` por escrita de OOXML própria | Ver `D-02` |
| Mudar a resposta da API, a tela ou qualquer regra | `R-DES-01` e `R-DES-02` |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-DES-01` | O `.docx` e o `.xlsx` gerados são **byte a byte idênticos** aos de hoje, nos **dois** pares reais, excetuada apenas `docProps/core.xml` (o `dcterms:modified`). Verificado por `sha256`, não por inspeção |
| `R-DES-02` | Nenhum arquivo de `domain/` ou `application/` é tocado. `tests/test_architecture.py` continua valendo sem alteração |
| `R-DES-03` | `ooxml.escrever` produz **o mesmo XML** que a implementação atual via API pública do `python-docx`, incluindo os três casos de §2.5: texto vazio, `\t`/`\n`/`xml:space`, e o truncamento de `w:sz` |
| `R-DES-04` | A mesclagem de anexo produz o mesmo XML que `_Cell.merge` produzia, com custo **O(1) por mesclagem**: `CT_Tc._tr_idx` não é chamado nenhuma vez durante a renderização dos anexos |
| `R-DES-05` | Nenhuma dependência nova. Só `lxml` (já presente, é a base do `python-docx`) e o próprio `python-docx` |
| `R-DES-06` | O acoplamento a interno de biblioteca é **declarado e testado**: um teste compara a saída rápida com a da API pública, e é ele que falha quando a biblioteca mudar. Não fica por comentário |
| `R-DES-07` | A versão do `python-docx` passa a ser fixada com **teto** no `pyproject.toml` (`>=1.2.0,<2`). `R-DES-01` depende do comportamento dela, e dependência sem teto transforma identidade de bytes em promessa não verificada até o próximo `uv lock` |
| `R-DES-08` | A meta é: renderização do DOCX do piloto **≤ 8 s** e do PGM **≤ 25 s** na máquina de referência. O número **não vira asserção de teste** — ver `D-07` |
| `R-DES-09` | `ooxml.mesclar` e `ooxml.mesclar_linha` continuam existindo: o bloco de título usa a segunda, e são três células. Otimizar o que custa 3 mesclagens seria fazer trabalho para gerar risco |
| `R-DES-10` | Nenhum `# type: ignore` novo. `mypy --strict` continua limpo, e `ruff` também |
| `R-DES-11` | `ooxml.escrever` continua sendo a **única** porta de escrita de célula. Não existe caminho rápido e caminho lento: ver `D-08` |

---

## 6. Decisões

### `D-01` — Emitir o XML direto, em vez de tentar acelerar o `python-docx`

A alternativa seria memorizar posições de inserção ou remendar `xmlchemy`. Ambas dependeriam de
interno mais profundo e cobririam menos: o custo está espalhado por sete atribuições, e o que as
torna caras é a **generalidade** de `insert_element_before`, que precisa funcionar sobre um
elemento com filhos em qualquer ordem.

Nós não estamos nesse caso. O `w:p` da célula nasce com zero filhos, e a ordem canônica dos
quatro filhos do `w:rPr` é fixa e conhecida. Construir com `etree.SubElement` é a operação que
a situação pede, e é a que o próprio `python-docx` faria se soubesse o que nós sabemos.

O caminho continua passando por uma função só (`R-DES-11`), com o mesmo nome e a mesma
assinatura. De fora, `escrever` continua sendo `escrever`.

### `D-02` — Não trocar de biblioteca

O documento nasce de uma **cópia do modelo institucional** (`R-DOC-01`), com 7 fontes embutidas,
3 imagens, cabeçalho e rodapé. O `python-docx` é quem sabe abrir esse pacote, manter as relações
e salvá-lo. Escrever OOXML do zero jogaria fora a única coisa que a ESPEC 003 conseguiu de graça.

O que esta espec faz é usar a biblioteca para o pacote e o `lxml` para as folhas — que é a
divisão que o próprio `ooxml.py` já adota desde a ESPEC 003 (`sombrear`, `contornar`,
`fixar_larguras`, `bordas_da_celula` já montam elementos à mão).

### `D-03` — A mesclagem recebe coordenadas, não células

`_span_dimensions` custa O(fileiras) para descobrir um retângulo que `_mesclar_anexo` acabou de
calcular. Passar `(topo, esquerda, altura, largura)` elimina a busca inteira.

Isso apoia-se em duas invariantes, e as duas são declaradas, não presumidas:

1. as regiões mescladas do Excel nunca se sobrepõem — já está escrito em `_mesclar_anexo`, e é
   consequência do formato, não do arquivo;
2. mesclar remove `w:tc`, nunca `w:tr` — verificado no código da biblioteca, e é o que permite
   resolver a lista de fileiras **uma vez por tabela**.

`R-DES-04` transforma a segunda em teste: se um dia deixar de valer, a contagem de `_tr_idx`
deixa de ser zero.

### `D-04` — A recursão vertical é reimplementada, não reaproveitada

`_grow_to` é barato exceto por `_tc_below`, que faz `tr_lst.index(self._tr)` a cada linha do
vão vertical. Como já temos a lista de fileiras e o índice corrente, a descida é
`trs[linha + 1].tc_at_grid_offset(deslocamento)`.

O resto — `_span_to_width`, `_swallow_next_tc`, `_move_content_to` — é local aos irmãos, é
correto, e é reaproveitado como está. **Só o que é O(fileiras) é reescrito.** Reimplementar
`_span_to_width` seria copiar lógica de mesclagem horizontal sem nenhum ganho, e é onde um bug
de fidelidade nasceria.

### `D-05` — Identidade de bytes é o critério, não *"o documento parece igual"*

As três divergências de §2.5 não quebrariam nenhum teste de conteúdo: o texto lido de volta é o
mesmo, as células estão nos mesmos lugares, o número de linhas não muda. Um `w:sz` de `10` em
vez de `9` é um anexo inteiro com o corpo errado, e um teste que leia `cell.text` passa.

O projeto já sabe disso — é por isso que `test_capa` ancora um `sha256` e não uma contagem.
Esta espec estende a mesma disciplina ao pacote inteiro.

### `D-06` — Uma espec, dois gargalos, e nada além

A leitura dos anexos em `read_only` vale 2 a 6 s e está medida (§2.6). Fica de fora porque tem
outro risco: mexe em **como o anexo é lido**, e o critério de aceite da ESPEC 004 e da 014 é a
fidelidade visual da página, que `sha256` de pacote também protege, mas cuja falha teria causa
completamente diferente.

É o mesmo argumento que a ESPEC 012 §4.2 usou para deixar o DOCX de fora — e que esta espec
respeita ao voltar sozinha ao assunto.

### `D-07` — O teste de desempenho afirma **complexidade**, não segundos

Um `assert duracao < 8.0` é um teste que falha na máquina de outra pessoa, no CI carregado, ou
no dia em que a fixture crescer — e que **passa** se a mudança for revertida numa máquina
rápida. Mede o ambiente, não o código.

O que esta espec afirma é o que a correção realmente muda:

- **`_tr_idx` não é chamado** durante a renderização dos anexos (`R-DES-04`). Contagem, não
  relógio: determinística, roda em qualquer máquina, e falha se alguém reintroduzir
  `_Cell.merge` no laço.
- **O custo é linear no número de linhas**: renderizar 2N linhas custa menos de 2,6× renderizar
  N. Hoje esse fator é ~4. É uma razão entre duas medidas do **mesmo** ambiente, então a
  velocidade da máquina se cancela.

O `R-DES-08` fica como meta registrada e verificada no portão `P2`, à mão, com número — não como
asserção automatizada.

### `D-08` — Sem caminho rápido e caminho lento

A tentação seria manter a implementação atual como fallback (para textos com tab, por exemplo) e
usar a rápida no resto. Isso criaria dois caminhos que precisam concordar, e o teste de §8 só
exercitaria um.

`escrever` continua sendo uma função só. O caso do `\t` é tratado **dentro** dela, com a mesma
regra da biblioteca.

### `D-09` — O `CapacityLimiter(1)` fica

Tentador removê-lo agora que a geração cabe em 35 s. Mas a ESPEC 012 `D-02` não o pôs ali por
lentidão: pôs por concorrência nunca exercitada, e essa razão não mudou nem um pouco com esta
espec. Remover é uma linha, no dia em que houver teste que sustente (`I-08`).

---

## 7. O que muda no código

| Arquivo | Mudança |
|---|---|
| `infrastructure/report/ooxml.py` | `escrever` reescrita (`D-01`). Nova função `mesclar_regiao(fileiras, topo, esquerda, altura, largura)` (`D-03`, `D-04`). `mesclar` e `mesclar_linha` intocadas (`R-DES-09`) |
| `infrastructure/report/docx_renderer.py` | `_mesclar_anexo` passa coordenadas em vez de células. `_tabela_do_anexo` resolve `tabela._cells` uma vez e o repassa a `fixar_larguras` |
| `infrastructure/contract/pdfplumber_extractor.py` | O texto da página 1 é lido uma vez e repassado a `_proposta`, `_cliente` e `_identificar` (limpeza de §2.6) |
| `backend/pyproject.toml` | `python-docx>=1.2.0,<2` (`R-DES-07`) |
| `backend/tests/test_desempenho.py` | **Novo** — §8.1 e §8.3 |
| `backend/tests/test_identidade_dos_artefatos.py` | **Novo** — §8.2 |

**Nada em `domain/`, `application/` ou `api/`.** A ESPEC 012 mexeu onde o HTTP encontra o
trabalho; esta mexe onde o trabalho encontra o XML. Entre os dois, nada.

Esboço do núcleo, para fixar a forma e não a sintaxe:

```python
# ooxml.py — a ordem canônica é conhecida; não há o que procurar (D-01)
def escrever(celula, texto, *, negrito=False, cor=layout.PRETO,
             alinhamento="left", corpo=None) -> None:
    p = celula._tc.find(_P)                       # o w:p nasce vazio
    pPr = SubElement(p, _PPR)
    espaco = SubElement(pPr, _SPACING)
    espaco.set(_BEFORE, "0"); espaco.set(_AFTER, "0")
    if alinhamento != "left":
        SubElement(pPr, _JC).set(_VAL, alinhamento)

    r = SubElement(p, _R)
    rPr = SubElement(r, _RPR)                     # rFonts, b, color, sz — nesta ordem
    ...
    # `int`, e não `round`: é o que ST_HpsMeasure faz (§2.5)
    SubElement(rPr, _SZ).set(_VAL, str(int(int(pt * 12700) / 12700.0 * 2)))
    if texto:
        _texto_do_run(r, texto)                   # \t -> w:tab, \n -> w:br, xml:space
```

```python
# ooxml.py — o retângulo vem pronto; nada a varrer (D-03, D-04)
def mesclar_regiao(fileiras, topo, esquerda, altura, largura):
    tc = fileiras[topo].tc_at_grid_offset(esquerda)
    _crescer(fileiras, topo, tc, largura, altura, top_tc=tc)
    return tc
```

```python
# docx_renderer.py — a lista de fileiras é resolvida uma vez por tabela
fileiras = tabela._tbl.findall(qn("w:tr"))
for mesclagem in anexo.mesclagens:
    ...
    ooxml.mesclar_regiao(fileiras, topo, esquerda, altura, largura)
```

---

## 8. Testes

Três camadas, e elas respondem a perguntas diferentes. **A ordem importa:** §8.2 é escrita e
ancorada **antes** de qualquer linha de produção mudar — os `sha256` precisam vir do código
atual, ou não provam nada.

### 8.1 Aceite — provam que a alteração faz o que promete

| ID | Teste | Afirma | Como falha hoje |
|---|---|---|---|
| `T-2010` | `test_desempenho.py::test_a_mesclagem_nao_varre_as_fileiras` — renderiza o piloto com `CT_Tc._tr_idx` e `CT_Tc._tr_below` instrumentados por `monkeypatch`; **conta zero** no trecho dos anexos | `R-DES-04` | Hoje conta 10.452 (piloto) e 37.884 (PGM). É a asserção que se inverte com a correção |
| `T-2011` | `test_desempenho.py::test_o_custo_de_um_anexo_e_linear` — tabela sintética de 8 colunas com N=400 e N=800 fileiras, uma mesclagem de linha inteira por fileira; afirma `t(800) / t(400) <= 2,6` | `R-DES-04`, `D-07` | Hoje o fator medido é **4,15** (§2.3); com a correção, **1,16**. Razão entre duas medidas do mesmo ambiente: a máquina se cancela |
| `T-2012` | `test_desempenho.py::test_escrever_nao_consulta_a_ordem_do_esquema` — instrumenta `docx.oxml.xmlchemy.insert_element_before`; afirma **zero** chamadas durante `ooxml.escrever` | `R-DES-03` (o mecanismo) | Hoje são 7 por chamada |

Nenhum dos três olha o relógio para decidir aprovação — `T-2011` olha, mas para uma **razão**
(`D-07`).

### 8.2 Regressão — provam que nada do que funciona mudou

Esta é a metade que importa, e ela é curta porque o critério é forte.

| ID | Teste | Afirma |
|---|---|---|
| `T-2020` | `test_identidade_dos_artefatos.py::test_o_docx_do_piloto_e_byte_a_byte_o_de_sempre` — `sha256` de **cada entrada** do pacote, exceto `docProps/core.xml`, contra um dicionário de constantes medido antes da mudança | `R-DES-01` no piloto: 19 anexos, 15.955 células escritas, 871 mesclagens |
| `T-2021` | idem para o par do **PGM com aditivo** | `R-DES-01` no par que exercita **3.157 mesclagens** e 31.048 células — o caso que o piloto não alcança |
| `T-2022` | `test_identidade_dos_artefatos.py::test_o_xlsx_da_analise_e_byte_a_byte_o_de_sempre`, nos dois pares | O segundo artefato. Não é tocado por esta espec, e é exatamente por isso que precisa estar no par: prova que a mudança ficou onde deveria |
| `T-2023` | `test_desempenho.py::test_escrever_reproduz_a_api_publica` — matriz de casos, comparando `etree.tostring` do `w:tc` produzido por `ooxml.escrever` com o de uma **implementação de referência** que usa a API pública do `python-docx` (o código de hoje, preservado no arquivo de teste) | `R-DES-03` e `R-DES-06` |
| `T-2024` | `test_desempenho.py::test_mesclar_regiao_reproduz_a_api_publica` — mesma técnica: duas tabelas sintéticas idênticas, uma mesclada por `_Cell.merge` e outra por `mesclar_regiao`, comparando o XML da tabela inteira | `R-DES-04` e `R-DES-06` |

**A matriz de `T-2023`** cobre, no mínimo, o produto de:

- texto: vazio, comum, com espaço nas pontas, com `\t`, com `\n`, com `&` e `<`, com acento;
- `negrito`: `True` e `False` — o `False` emite `<w:b w:val="0"/>`, e omiti-lo é a falha fácil;
- `corpo`: `None` mais **os catorze de `anexos.json`** — não uma amostra. Seis deles (4,3 · 4,4 ·
  4,8 · 5,8 · 6,4 · 8,9) expõem truncamento vs. arredondamento, e os outros oito não: uma amostra
  escolhida a esmo tem chance real de pegar só os oito silenciosos (§2.5);
- `alinhamento`: `left`, `center`, `right`;
- `cor`: padrão, com cerquilha, minúscula.

**A matriz de `T-2024`** cobre: mesclagem 1×N (horizontal), N×1 (vertical), N×M, mesclagem que
começa fora da linha zero, mesclagem aparada em `ate_coluna` (o caso `R-BRD-05` da ESPEC 014,
que a faixa vazia de `SOA` exercita), e duas mesclagens disjuntas na mesma tabela.

### 8.3 Contrato com a biblioteca

`T-2023` e `T-2024` **são** o teste de contrato, e por isso estão em §8.2 e não em §8.1: o seu
papel principal é detectar regressão, e a regressão que eles detectam pode vir de fora do
repositório. Com o teto de `R-DES-07`, uma atualização do `python-docx` que mude a ordem do
`w:rPr`, a conversão de `w:sz` ou o tratamento de `\t` falha aqui — no mesmo *commit* que a
introduziu, e com uma mensagem que aponta para a linha exata.

Sem esses dois, o teto de versão seria a única proteção, e teto de versão só adia o problema.

### 8.4 O que a suíte já cobre e continua valendo sem alteração

Nenhum destes muda uma linha. Todos precisam continuar verdes, e o valor deles é justamente que
foram escritos sem saber desta espec:

| Arquivo | O que protege |
|---|---|
| `test_capa.py` `T-1408` | `sha256` do corpo de texto inteiro — 16 mil textos. *"Um caractere que mude em qualquer das 16 mil células o derruba"* |
| `test_quantitativo_consolidado.py` | `sha256` por entrada do pacote, já com a exclusão de `docProps/core.xml` — a técnica que `T-2020` generaliza |
| `test_docx_estrutura.py`, `test_docx_formatacao.py` | Estrutura de seções, capa intocada, determinismo (`R-DOC-10`) |
| `test_docx_anexos.py` | Orientação, largura de coluna, altura de linha, corte de cabeçalho, mesclagens, figuras — a ESPEC 004 e a 014 inteiras |
| `test_anchor_analise.py`, `test_anchor_por_codigo.py` | As âncoras de conteúdo |
| `test_api_e2e.py` | A resposta de `POST /reports` — `R-RSP-05` da ESPEC 012 continua valendo palavra por palavra |
| `test_architecture.py` | A regra de dependência (`R-DES-02`) |
| `frontend/e2e/*.spec.ts` | A tela. Não é tocada, e a suíte de navegador roda mesmo assim — a ESPEC 012 §12.5 registra por que isso vale a pena |

### 8.5 O efeito colateral na própria suíte

Linha de base medida em `feature/evolucao`, antes de qualquer mudança:

```
578 passed, 1 warning in 1614.15s (0:26:54)
```

Os doze testes mais lentos, e o que eles são:

| Duração | Teste | O que custa |
|---|---|---|
| 255,0 s | `test_api_e2e::test_t1350_o_campo_de_aditivos_e_opcional` | duas gerações completas por HTTP |
| 152,6 s | `test_capa` (setup) | DOCX do piloto **e** do PGM |
| 145,1 s | `test_linhas_derivadas::…[pgm]` (setup) | DOCX do PGM |
| 130,4 s | `test_api_e2e::…o_par_do_pgm_com_aditivo_entra_por_http` | geração completa do PGM |
| 107,0 s | `test_anchor_por_codigo::…o_pgm_tem_58_linhas` (setup) | DOCX do PGM |
| 68,0 s | `test_responsividade::…duas_geracoes_simultaneas` | duas gerações serializadas |
| 53,3 s / 36,2 s / 35,0 s / 34,6 s / 34,4 s / 32,1 s | `test_capa`, `test_docx_anexos`, `test_api_e2e`, `test_responsividade` ×2, `test_anchor_por_codigo` | DOCX do piloto |

**Os doze somam ~950 s — quase 60% da suíte — e os doze são renderização de DOCX.** É a mesma
função de §2.2 e §2.3, vista pelo outro lado. A projeção, pelos fatores de §2.5, é uma suíte de
**8 a 10 min**.

**Medido depois (`T-2018`):**

```
1316 passed, 1 warning in 766.16s (0:12:46)
```

A contagem reconcilia: **578 + 738** — os 734 casos de `test_desempenho.py` (a matriz de
`T-2023` sozinha são 720) mais os 4 de `test_identidade_dos_artefatos.py`.

A suíte caiu de **26 min 54 s para 12 min 46 s** — 53% — **acrescentando 738 testes**. E o topo
mudou de natureza: o mais lento passou de 255 s para 33,6 s, e nenhum item da lista é mais
dominado por renderização.

| | Antes | Depois |
|---|---|---|
| testes | 578 | **1.316** |
| tempo | 26 min 54 s | **12 min 46 s** |
| mais lento | 255,0 s | **33,6 s** |

Isso é consequência, não objetivo, e por isso não vira portão: `P3` exige a suíte **verde**, não
rápida. E **`docx_do_piloto` continua como está** — o cache deixa de ser necessário por custo e
continua correto por desenho; mexer nele aqui seria mudar duas coisas ao mesmo tempo. Fica
registrado em `I-33`.

---

## 9. Portões

| ID | Portão | Fecha quando | Quando |
|---|---|---|---|
| `P0` | **Ancorar antes de mexer** | `T-2020`, `T-2021` e `T-2022` escritos e **verdes contra o código atual**, com os `sha256` medidos e registrados como constantes | Antes de qualquer mudança de produção |
| `P1` | **Ver falhar** | `T-2010` e `T-2012` **falham** contra o código atual, com as contagens de §2.2 e §2.3 | Antes da correção |
| `P2` | **Meta de tempo** | `R-DES-08` medido à mão nos dois pares, na máquina de referência, e registrado em §14 | Depois da correção |
| `P3` | **Suíte inteira verde** | Backend completo — **578 testes**, que é a linha de base medida em §8.5 — mais `mypy --strict`, `ruff` e `bandit`; e a suíte de navegador | Depois |
| `P4` | **Medir em produção** | Uma geração real no `ca-confere-backend` com o par do PGM, cronometrada — é lá que a ESPEC 012 `P1` mediu, e é lá que este número precisa aparecer | Depois |

`P0` antes de `P1` não é formalidade: se a âncora for tirada **depois** da mudança, ela ancora o
resultado da mudança, e a espec inteira perde o critério de aceite.

---

## 10. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| **Reimplementar a escrita do `run` diverge em um caso não previsto** — foi o que aconteceu três vezes no protótipo (§2.5) | Alta se passar | `T-2023` compara contra a API pública numa matriz, e `T-2020`/`T-2021` comparam o pacote inteiro dos dois pares reais. As três divergências do protótipo foram encontradas exatamente por esse par de testes |
| **Atualização do `python-docx` muda o XML e a identidade quebra** | Média | `R-DES-07` põe teto de versão; `T-2023`/`T-2024` acusam no *commit* da atualização, não em produção |
| **A invariante *"mesclar não remove fileira"* deixar de valer** | Baixa | `T-2024` compara o XML resultante com o da API pública; se a biblioteca passar a mexer nas fileiras, os dois divergem |
| **Mesclagem fora de ordem ou sobreposta produzir XML diferente** | Baixa | A não-sobreposição é propriedade do formato XLSX, já declarada em `_mesclar_anexo`. `T-2024` inclui o caso de duas mesclagens disjuntas e o de mesclagem aparada |
| **`T-2011` (linearidade) ficar instável em CI carregado** | Média — é o único teste com relógio | Teto de `2,6` contra `1,16` medido depois e `4,15` medido antes: margem de 2,2× para baixo e 1,6× para cima. A medida de `1,16` foi tomada, de propósito, **com a suíte inteira rodando em paralelo** — é o pior caso de contenção que este projeto produz, e a razão sobreviveu. Se ainda assim oscilar, marcar `@pytest.mark.lento` e tirar do laço rápido — nunca afrouxar o fator, que é o que ele mede |
| **Acoplamento a interno de biblioteca cresce** | Aceito, e declarado | Já é o estilo do arquivo desde a ESPEC 003 (`tabela._cells`, `celula._tc`, `_tbl.tblPr`, `_tr.get_or_add_trPr`). A diferença é que agora há teste que o cobre (`R-DES-06`), o que hoje **não** existe |
| **O ganho não aparecer em produção como apareceu aqui** | Baixa | O trabalho é Python puro e o perfil é de CPU. A ESPEC 012 §2.3 mostrou que a vCPU do Container Apps é mais rápida que a máquina de desenvolvimento — a direção é favorável. `P4` mede |

---

## 11. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-30` | Qual é o maior levantamento plausível? O PGM tem 3.462 linhas de anexo e 3.157 mesclagens; o piloto, 1.947 e 871. Sem esse número, `R-DES-08` é meta e não requisito | Não. Decide se o teto de 180 s do frontend precisa ser revisto depois desta espec |
| `I-31` | A leitura de anexos em `read_only` (2 a 6 s, §2.6) vale uma espec própria? | Não. Fica registrada com a medição feita, para não ser redescoberta |
| `I-32` | Cache do `Contract` por hash do PDF resolveria 6–10 s na resubmissão — o caso mais comum de quem corrige a planilha. Fere a ESPEC 001 §7.2? | Não. Requer decisão de produto, não de desempenho |
| `I-33` | Com a renderização em ~5 s, o cache de `docx_do_piloto` no `conftest` ainda se paga? | Não. §8.5 |
| `I-08` (ESPEC 012) | Quantas conferências simultâneas o uso real produz? | Não. Continua aberto, e esta espec o torna menos urgente |

---

## 12. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | `P0` — âncoras de `sha256` dos dois pares, escritas e verdes contra o código atual | P |
| B | `P1` — `T-2010` e `T-2012` vendo falhar | PP |
| C | `escrever` reescrita + `T-2023` | P |
| D | `mesclar_regiao` + `T-2024` + as duas limpezas de §2.6 | P |
| E | `T-2011`, teto de versão, `P2` e `P3` | P |
| F | `P4` — medir em produção | PP |

**Total: um a dois dias.** O código muda pouco — duas funções e um laço. O que custa é a
verificação, e é ela que justifica a espec: sem `P0`, isto seria uma otimização com uma
promessa; com `P0`, é uma otimização com uma prova.

---

## 13. Relação com as especs anteriores

### 13.1 ESPEC 012 §4.2 e `I-09` — a espec que decidiu não fazer isto

A ESPEC 012 deixou os 19 s de fora com dois argumentos, e os dois foram respeitados:

> *"é outro problema, com outro critério de aceite (o teste-âncora) e outro risco"*

Certo, e é por isso que esta é uma espec separada, com o critério de aceite explicitado em
`R-DES-01` e §8.2 — que é o teste-âncora, generalizado ao pacote.

> *"misturar as duas coisas faria uma mudança de desempenho passar de carona numa correção de
> disponibilidade"*

Certo, e é por isso que esta espec não toca no `CapacityLimiter`, nos *probes*, no *timeout* do
frontend nem em nada da ESPEC 012 (`D-09`).

O que a ESPEC 012 **errou** foi a atribuição da causa em §2.1: *"o custo está onde a ESPEC 004
previu: emitir ~25 mil células, uma a uma"*. O volume é o mesmo; o custo por célula é que era 4×
maior do que precisava ser. A frase não era uma medição — era uma inferência plausível, e ficou
sem quem a conferisse por quatro incrementos.

### 13.2 ESPEC 004 e o comentário de `ooxml.mesclar` — meio caminho já andado

O comentário de `mesclar` descreve exatamente este defeito, um nível acima:

> *"`Table.cell` remonta a grade a cada chamada. `Office365` tem 698 mesclagens (…) sozinho,
> respondia pela maior parte dos cinco minutos que a primeira versão levava."*

Aquela correção passou de cinco minutos para 29 s. Esta passa de 29 s para 5 s, pela mesma
razão, um nível abaixo — e o que a tornou invisível foi ela estar **dentro** da biblioteca, onde
o perfil só aponta se alguém o rodar.

### 13.3 ESPEC 014 — o precedente de mexer no renderizador com âncora

A ESPEC 014 mudou a grade dos anexos bloco a bloco e sobreviveu porque o teste-âncora media as
mesmas 55 linhas nas páginas 2 e 3. Esta espec usa a mesma disciplina, com o alvo invertido: lá
o documento **devia** mudar em pontos específicos e não em outros; aqui ele não deve mudar em
lugar nenhum, o que é mais fácil de afirmar e mais fácil de verificar.

---

## 14. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-19 | Redação inicial. §2 com o perfil dos dois pares, a curva de escala medida e o resultado do protótipo verificado por `sha256`; §8.5 com a linha de base da suíte — 578 testes, 26 min 54 s |
| 1.1 | 2026-08-19 | **Implementada.** `P0` a `P3` fechados — backend 1.316 verdes, navegador 100/110 com as 10 falhas diagnosticadas como pré-existentes (TASKS §9.7). **`P4` aberto**, pendente de janela em produção. Medição de `R-DES-08` em §14.1 |

### 14.1 `R-DES-08` medido — portão `P2`

Máquina de referência, processo em repouso, depois das `T-2004`, `T-2008` e `T-2013`:

| Par | Fase | Antes | Depois |
|---|---|---|---|
| Piloto | `gerar()` | 8,8 s | 9,9 s |
| Piloto | **DOCX** | **22,1 s** | **4,6 s** — meta ≤ 8 s |
| Piloto | XLSX da análise | 0,1 s | 0,1 s |
| Piloto | **total** | **31,0 s** | **14,6 s** |
| PGM | `gerar()` | 18,9 s | 20,1 s |
| PGM | **DOCX** | **96,6 s** | **11,2 s** — meta ≤ 25 s |
| PGM | **total** | **~115 s** | **31,5 s** |

**Melhor que o protótipo** (5,3 s e 16,5 s), porque a `T-2013` entrou junto: a grade de
células deixou de ser resolvida duas vezes por tabela de anexo, o que o protótipo não fazia.

A variação de `gerar()` — 8,8 → 9,9 s no piloto — é ruído de medição sobre uma fase que esta
espec não toca; a `T-2014` só reduz uma extração de texto de página, e o efeito dela é menor
que a dispersão entre execuções.

**Três arquivos de `src/` alterados**, de 53: `report/ooxml.py`, `report/docx_renderer.py` e
`contract/pdfplumber_extractor.py`. Nada em `domain/`, `application/` ou `api/` (`R-DES-02`).

**Ponta a ponta, por HTTP**, contra o backend no ar com os dois arquivos do piloto: **14,8 s**,
contra os ~31 s de antes. É a medida que mais se aproxima do que o usuário sente ao clicar em
*Gerar relatório*, e a única desta tabela que passa pelo `multipart`, pelo `CapacityLimiter` e
pela serialização em base64.
