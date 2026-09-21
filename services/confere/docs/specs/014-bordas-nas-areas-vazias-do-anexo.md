# ESPEC 014 — Sem bordas onde o anexo não tem conteúdo

| | |
|---|---|
| **Status** | **Implementada** — 376 testes verdes; `I-12` continua aberto e não bloqueia (§10) |
| **Versão** | 1.1 — 2026-08-11 |
| **Depende de** | [ESPEC 004](004-anexos-de-detalhamento.md) — implementada |
| **Revisa** | `R-ANX-06` da ESPEC 004 — o **alcance**, não a intenção. Ver §6 `D-06` |
| **Artefato de referência** | Página 6 do `SMIT_SUSTENTACAO_..._GRC.pdf` — a aba `Servidores` como o Excel a imprime |
| **Origem** | Captura da página do anexo `Servidores` no documento gerado: *"quando não houver cabeçalho na coluna ou não tiver conteúdo na linha, há como retirar as bordas?"* |

---

## 1. Problema

A primeira página do anexo `Servidores` sai com grade em duas regiões que não têm nada
dentro:

```
┌───────────────────────────────────┬────┬──────┬───┬───────┐┌──┬──┬──┬──┬──┬──┐
│ HOSPEDAGEM DE APLICAÇÃO - SMIT SUSTENTAÇÃO                 ││  │  │  │  │  │  │
│ Perfil de Servidores Disponíveis  │VCPU│ VRAM │Qtd│Total  ││  │  │  │  │  │  │   ← 6 colunas
│ …TIPO A - GERENCIADA … WINDOWS    │  0 │    2 │ 1 │    20 ││  │  │  │  │  │  │     sem cabeçalho
│ TOTAIS                            │  0 │130,25│ 28│1097,55││  │  │  │  │  │  │
├───────────────────────────────────┴────┴──────┴───┴───────┤│  │  │  │  │  │  │
│                                                           ││  │  │  │  │  │  │   ← linha em branco
└───────────────────────────────────────────────────────────┘└──┴──┴──┴──┴──┴──┘     emoldurada
```

A página 6 do GRC — o mesmo bloco, impresso pelo Excel — **não tem nenhuma das duas**: o bloco
de cima termina onde a última coluna com dado termina, e entre ele e a tabela de baixo há um vão
limpo.

O sintoma é o de sempre em documento que instrui faturamento: quem confere vê caixas vazias e
não sabe se falta dado ali ou se a moldura é decorativa.

---

## 2. O que foi medido

### 2.1 A tabela nasce com as colunas da **aba**, não do bloco

`Servidores` tem 15 colunas porque a **tabela de baixo** (linha 41 em diante) precisa de 15. O
bloco de cima usa 9 — `A` a `I`. As outras 6 existem em todas as tabelas do anexo.

Com as larguras medidas no GRC (`R-ANX-12`):

| | pt | % da tabela |
|---|---|---|
| Colunas `A`–`I` — o bloco de verdade | 285,4 | 55,6 % |
| Colunas `J`–`O` — sem cabeçalho | 227,7 | **44,4 %** |
| Total | 513,1 | |

A área fantasma ocupa **43 % da largura útil da página** (527,2 pt em retrato com as margens de
1,2 cm de `MARGEM_LATERAL_ANEXO`).

### 2.2 São **duas** causas, não uma

Inspecionado o `saida/relatorio.docx` gerado, célula a célula, no primeiro bloco de `Servidores`:

| Região | O que o XML traz | Causa |
|---|---|---|
| Colunas `J`–`O`, linhas 1–11 | `w:tcBorders` com os quatro lados em `w:val="none"` | A coluna **existe** na tabela e a grade declarada em `ooxml.contornar` a alcança |
| Linha 12 da aba (a em branco) | **sem** `w:tcBorders` — herda a grade cheia | As células dessa linha **têm borda na planilha**, e o leitor as copia (`R-ANX-06`) |

A segunda causa está inteiramente explicada pelo modelo: a linha em branco é emoldurada porque a
aba manda emoldurar. A primeira **não está** — o documento já pede que aquelas bordas não sejam
desenhadas, e na captura elas aparecem assim mesmo. Ver `I-12`.

Isso decide a forma da solução: não adianta pedir com mais ênfase que a borda não seja desenhada.
**A coluna que não existe não pode ser desenhada** — é o único caminho que não depende de como o
Word resolve conflito entre a borda da tabela e a da célula.

### 2.3 O alcance nos 19 anexos

Os 19 anexos produzem **37 tabelas** (cada anexo se parte no `corte` de `R-ANX-11` e nas figuras
de `R-ANX-13`). Medido sobre a planilha do piloto:

| | Quantidade |
|---|---|
| Tabelas ao todo | 37 |
| Tabelas com coluna a aparar | **8** |
| Colunas aparadas ao todo | **58** |
| Linhas sem conteúdo | 50 |
| …destas, as que **hoje saem emolduradas** | **21** |
| Colunas vazias que sobram **dentro** de um bloco | **0** |

As duas últimas linhas decidem o peso de cada regra. As 29 linhas em branco restantes já saem
limpas — a aba não declara borda nelas, e `R-ANX-06` as reproduz certo. E nenhuma coluna vazia
sobra no meio de bloco nenhum: a cobertura das mesclagens (§2.4) preenche todas. `R-BRD-03`
existe como regra sem caso no piloto, e por isso é testada por caso construído (§8).

Os oito blocos, e quanto cada um encolhe:

| Anexo | Colunas da aba | Aparadas no bloco de preâmbulo |
|---|---|---|
| `Comunicação Dados` | 22 | 16 |
| `SDWAN` | 19 | 13 |
| `Office365` | 16 | 9 |
| `Servidores` | 15 | 6 |
| `ServidoresSemDesenv` | 15 | 6 |
| `WIFI` | 10 | 6 |
| `SOA` | 5 | 1 |
| `ServicosEmNuvem` | 3 | 1 |

Nos outros 11 anexos nada muda de largura. `Detalhes`, `DetalhesSemDesenv`, `NAS`, `Colocation`
e `ServicosVcloud` já usam todas as colunas em todos os blocos.

### 2.4 A regra ingênua **quebraria 8 anexos**

Esta é a medição que mudou o desenho da solução. "Aparar as colunas do fim que não têm texto nem
preenchimento" é a regra óbvia, e ela está errada: o `openpyxl` deixa **vazias as células
cobertas por uma mesclagem** — o valor mora só na âncora. Uma faixa de título mesclada de ponta a
ponta parece, célula a célula, uma coluna com conteúdo seguida de colunas vazias.

| Anexo | Regra ingênua apararia | Correta apara | O que a ingênua destruiria |
|---|---|---|---|
| `WIFI` | 9 de 10 | 6 | A faixa `A1:D1` viraria uma coluna |
| `BD` | 5 de 7 | 0 | `A1:G1` |
| `Usuários` | 5 de 8 | 0 | `A7:H7` |
| `CertificadosDigitais` | 3 de 4 | 0 | `A1:D1`, `A2:D2` |
| `Central de Servicos` | 2 de 3 | 0 | `A1:C1`, `A3:C3` |
| `Internet` | 2 de 3 | 0 | `A1:C1`, `A3:C3`, `A5:C5` |
| `OutrosServicos` | 2 de 3 | 0 | `A1:C1`, `A2:C2` |
| `ServicosEmNuvem` | 2 de 3 | 0 | `A1:C1` |

A correção é uma linha de raciocínio, não de código complicado: **uma coluna coberta por
mesclagem cuja âncora tem conteúdo conta como usada**. Com ela, os oito voltam ao certo e os
outros onze não mudam.

### 2.5 Só **uma** mesclagem no piloto ultrapassa o novo total

Aplicada a regra corrigida, varridos os 37 blocos, exatamente uma mesclagem passaria da última
coluna: `SOA`, bloco de preâmbulo, linha 5 mesclada de `A` a `E` num bloco que fica com 4
colunas. A âncora dela é **vazia** — é uma das 21 linhas de respiro.

O número importa porque decide entre limitar e descartar (`D-05`): com um caso só, e vazio, as
duas escolhas dariam o mesmo resultado visual hoje. Limitar é o que continua certo quando
aparecer um caso não vazio.

---

## 3. Objetivo

A tabela do anexo termina onde o conteúdo dele termina, e a linha sem conteúdo sai sem moldura —
como a página do GRC.

Nada mais muda: as larguras, as cores, as fontes, as mesclagens e a altura de linha das colunas e
linhas que ficam são as mesmas de hoje.

---

## 4. Escopo

### 4.1 Dentro do escopo

- Decidir o total de colunas **por tabela**, e não por aba.
- Aparar as colunas vazias do fim de cada tabela.
- Retirar a borda das linhas sem conteúdo.
- Retirar a borda das colunas vazias que ficarem no meio.
- Completar a declaração de ausência de borda na célula (`R-BRD-07`).

### 4.2 Fora do escopo

| Item | Motivo |
|---|---|
| A capa e a tabela de comprovação | `R-ANX-09` — o teste-âncora das páginas 2–3 não pode se mover, e nada aqui as toca |
| As larguras medidas no GRC | `R-ANX-12` continua inteira. Esta espec escolhe **quantas** colunas entram, nunca a largura de uma delas |
| O `_colunas_uteis` do leitor de aba | Ele apara a **aba**, e continua como está (`D-04`). O que esta espec acrescenta é um segundo corte, por bloco, na hora de montar a tabela |
| A planilha de análise (XLSX) e a tela | Não têm anexo. Nada muda |
| Célula com preenchimento e sem texto | **Tem** conteúdo — é uma faixa de cor da aba. Continua com borda e com largura |
| Recortar a coluna vazia do **meio** | Mudaria a posição das colunas seguintes e desfaria a fidelidade de `R-ANX-12`. Ela perde a borda e mantém a largura (`R-BRD-03`) |

---

## 5. Regras

| ID | Regra |
|---|---|
| `R-BRD-01` | O total de colunas é decidido **por tabela**, a partir do recorte de linhas que ela recebe — não pela aba inteira |
| `R-BRD-02` | Uma coluna conta como **usada** no bloco quando alguma linha dele tem texto ou preenchimento nela, **ou** quando ela é coberta por uma mesclagem do bloco cuja âncora tem texto ou preenchimento (§2.4). **Borda não conta**, pelo mesmo motivo já registrado em `_colunas_uteis`: ela sobrevive em coluna que o Excel não imprime |
| `R-BRD-03` | Só as colunas não usadas **do fim** são aparadas. A que ficar no meio permanece, com a largura do GRC, e sai **sem borda** |
| `R-BRD-04` | Linha cujas células não têm texto nem preenchimento sai **sem borda**, mesmo que a aba declare uma. A linha **permanece**, com a altura do GRC: ela é o respiro entre blocos, e apagá-la colaria a tabela de baixo no bloco de cima |
| `R-BRD-05` | Mesclagem que ultrapassar o novo total é **limitada** à última coluna, nunca descartada (§2.5). Descartar desalinharia a faixa; limitar a encurta |
| `R-BRD-06` | Duas tabelas vizinhas de um anexo continuam separadas por um parágrafo. Já era verdade — a construção de `Anexo.blocos` nunca produz duas faixas de linhas seguidas, e o `corte` já insere o parágrafo de 1 pt —, mas **passa a ser carga estrutural**: com larguras diferentes, duas tabelas coladas seriam fundidas pelo Word e o encolhimento se desfaria |
| `R-BRD-07` | A ausência de borda numa célula é declarada por inteiro — `w:val="nil"`, `w:sz="0"`, `w:space="0"` e `w:color="auto"`. Hoje saem só os dois primeiros, e uma declaração incompleta é candidata a explicar `I-12` |
| `R-BRD-08` | O teste-âncora das páginas 2–3 continua valendo **sem alteração** (`R-ANX-09`), e a contagem de páginas do documento não muda: nenhuma linha é criada nem removida |
| `R-BRD-09` | `R-ANX-06` é revisada no **alcance**: borda continua vindo da aba, exceto onde a região é vazia — que é onde o GRC também não a desenha |

---

## 6. Decisões

| ID | Decisão | Por quê |
|---|---|---|
| `D-01` | **Não criar a coluna**, em vez de só pedir que a borda não seja desenhada | §2.2 — o documento de hoje já pede `w:val="none"` naquelas células e a grade aparece assim mesmo. Uma coluna que não existe não depende de conflito de borda para sumir. É a única das duas causas que a espec pode resolver sem saber a resposta de `I-12` |
| `D-02` | A linha em branco **fica**, e só perde a borda | Ela é medida no GRC como respiro entre blocos (`R-ANX-12`). Removê-la encostaria a tabela de baixo no `TOTAIS` de cima e mudaria a paginação de 19 anexos para resolver uma moldura |
| `D-03` | **Cobertura de mesclagem conta como conteúdo** | §2.4 — sem isso a regra destrói o cabeçalho de 8 dos 19 anexos, e o faz em silêncio: a faixa continua lá, só que com um terço da largura |
| `D-04` | O corte por bloco **soma-se** ao `_colunas_uteis` da aba, não o substitui | São perguntas diferentes. O da aba responde *"quantas colunas o Excel imprime desta aba"* — e a resposta vale para o anexo inteiro, inclusive para decidir as larguras. O novo responde *"quantas esta tabela usa"*. Fundir os dois faria a largura de uma coluna depender de qual bloco a pediu primeiro |
| `D-05` | Mesclagem que estoura é **limitada**, não descartada | §2.5 — hoje o código descarta (`if mesclagem.ate_coluna >= colunas: continue`), o que era inofensivo porque nunca acontecia. Passa a acontecer uma vez, e descartar deixaria a faixa partida em células soltas |
| `D-06` | `R-ANX-06` é **revisada, não revogada** | A intenção dela — *"reproduzir a apresentação do GRC sem declarar nada por anexo"* — é exatamente o que esta espec persegue. O que muda é que copiar a borda da planilha deixou de reproduzir o GRC em duas situações, e o critério continua sendo o documento impresso, não o arquivo |
| `D-07` | Sem opção de configuração | Não há caso de uso para "quero a moldura vazia de volta". Um interruptor aqui seria uma segunda apresentação para manter, e a ESPEC 004 tem uma só: a do GRC |

---

## 7. O que muda no código

| Camada | Mudança |
|---|---|
| `domain/entities/annex.py` | `Anexo` ganha o cálculo de colunas usadas num recorte de linhas (`R-BRD-02`) e o conjunto de linhas vazias dele (`R-BRD-04`). É pergunta sobre a **forma** do anexo, e é onde a forma mora |
| `infrastructure/report/docx_renderer.py` | `_tabela_do_anexo` passa a decidir o total de colunas e a fatiar as larguras pelo bloco; `_celula_do_anexo` recebe a informação de linha vazia; `_mesclar_anexo` limita em vez de descartar (`R-BRD-05`) |
| `infrastructure/report/ooxml.py` | `sem_bordas_na_celula` completa a declaração (`R-BRD-07`) |

**Nada muda em `application/`, `api/` nem no frontend.** O contrato da API não menciona colunas de
anexo, e `tests/test_architecture.py` continua valendo sem alteração.

O ponto delicado é um só, e é de ordem: `fixar_larguras` monta a grade da tabela **uma vez** por
razão de desempenho (`Usuários` tem 15 mil células e o acesso por linha é quadrático). O total de
colunas precisa estar decidido **antes** de `add_table`, não depois.

---

## 8. Testes

| Teste | O que acontece |
|---|---|
| `test_anchor_fidelity` — páginas 2–3 | **Passa sem alteração.** `R-BRD-08`. Se quebrar, o defeito está no renderizador e não nesta regra |
| `test_docx_anexos` — linhas, seções, orientação, altura, figuras | **Passam sem alteração** (24 dos 27). Nenhuma linha nasce ou morre; o que muda é a contagem de colunas de 8 tabelas |
| `test_comunicacao_dados_cabe_com_as_vinte_e_duas_colunas` | **Reapontado.** Media a tabela `[0]`, que é o preâmbulo e agora tem 6 colunas. As 22 sempre estiveram na tabela do corpo, que é a que quase não coube — é ela que a asserção sempre quis |
| `test_as_larguras_sao_as_medidas_no_grc` | **Reescrito, e mais forte.** Passa a comparar contra o **prefixo** da medição, e a afirmar que a tabela nunca tem mais colunas que o anexo. É o que impede o corte de virar redistribuição de largura |
| `test_a_largura_total_e_a_do_grc` | **Restringido às tabelas cheias**, mais a asserção de que todo anexo tem uma. A tabela aparada mede menos por construção — o preâmbulo de `Servidores` dá 285,4 pt contra os 519,1 do corpo —, e é assim no GRC |
| **Novo** — `R-BRD-01` | O bloco de preâmbulo de `Servidores` tem **9** colunas e o de baixo tem **15**, no mesmo anexo |
| **Novo** — `R-BRD-02` (o teste que importa) | `WIFI`: a faixa mesclada `A1:D1` continua com 4 colunas e `gridSpan` 4 depois do corte. É o teste que impede a regressão de §2.4, e o único cuja ausência deixaria o defeito passar sem sintoma — a faixa não sumiria, encolheria |
| **Novo** — `R-BRD-04` | A última fileira do preâmbulo de `Servidores` está vazia, **nenhuma** célula dela declara borda, e o `w:trHeight` continua lá — a linha é o respiro |
| **Novo** — `R-BRD-05` | A fileira mesclada de `SOA` (§2.5) sai com `gridSpan` 4 numa tabela de 4 colunas, em vez de virar cinco células soltas |
| **Novo** — `R-BRD-03`, **construído** | O piloto não tem coluna vazia no meio (§2.3). Um anexo de três colunas, com a do meio vazia e emoldurada na aba, sai com as larguras `50 / 100 / 50` pt e só a do meio sem borda. Sem o caso construído, a regra ficaria sem prova |
| `R-DOC-10` — duas execuções, bytes idênticos | **Passa sem alteração.** O corte é função dos dados, e os dados não mudam entre execuções |

O aceite formal é o de sempre: **abrir o documento** e comparar a página do anexo `Servidores`
com a página 6 do GRC. É a mesma exigência da ESPEC 003 e da ESPEC 013, pela mesma razão — o
`python-docx` relê perfeitamente o que ele mesmo escreveu, e borda é precisamente o que só o Word
mostra. É também o único caminho para fechar `I-12`.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| **Encolher o cabeçalho de um anexo** por não contar a cobertura da mesclagem | É o risco principal, e está medido: §2.4 nomeia os 8 anexos e o teste de `R-BRD-02` os cobre. Sem a medição, este seria o defeito que passa — a faixa não some, só encolhe |
| **O Word fundir duas tabelas vizinhas** de larguras diferentes | `R-BRD-06`. Hoje a fusão é invisível porque as larguras são iguais; a partir daqui não seria. A construção de `Anexo.blocos` já garante o parágrafo entre elas, e o teste de `R-BRD-01` afirma as duas contagens no mesmo anexo |
| **`I-12` continuar aberto** e a grade fantasma sobreviver | Não sobrevive: `D-01` remove a coluna, e o que não existe não é desenhado. O que continua dependendo de `I-12` é `R-BRD-03` — e ela **não tem caso no piloto** (§2.3), então a resposta não muda nenhuma página de hoje |
| **Uma aba futura com faixa mesclada inteiramente vazia** perder a moldura por `R-BRD-04` | Faixa de cor tem preenchimento, e preenchimento é conteúdo (§4.2). Some só a que é vazia de verdade — que é a que o GRC também não desenha |
| **A largura da tabela deixar de bater com o GRC** | As larguras não são recalculadas: `R-BRD-01` fatia a tupla de `R-ANX-12` pelo prefixo. A tabela encolhe pelo fim, e as colunas que ficam mantêm o valor medido |
| **Anexo novo entrar com forma inesperada** | O critério é da forma, não da aba: nenhuma regra aqui nomeia um anexo. É a mesma propriedade que a ESPEC 004 §7 já defende |

---

## 10. Pontos em aberto

| ID | Pergunta | Bloqueia? |
|---|---|---|
| `I-12` | Por que a grade aparece nas colunas `J`–`O` se o XML já declara `w:val="none"` nelas? Declaração incompleta (`R-BRD-07`), resolução de conflito do Word, ou a captura é de um documento anterior a `sem_bordas_na_celula`? | **Não.** `D-01` resolve o caso da imagem sem depender da resposta. A resposta decide se `R-BRD-03` — a coluna vazia do meio — funciona de fato. **Só se responde abrindo o documento no Word**: o ambiente onde esta espec foi escrita não tem Word nem LibreOffice, e nenhuma biblioteca Python renderiza DOCX |
| `I-13` | Alguma competência futura traz aba cuja última coluna seja usada **só** em blocos que não são o primeiro? | Não. Já é o caso hoje (`Servidores`) e a regra por bloco é o que o trata. Registrado para que ninguém "otimize" voltando a decidir por anexo |

---

## 11. Esforço

| Fase | Conteúdo | Tamanho |
|---|---|---|
| A | Colunas usadas e linhas vazias por recorte, em `Anexo` | P |
| B | `_tabela_do_anexo` corta e fatia as larguras; `_mesclar_anexo` limita | P |
| C | `R-BRD-04` e `R-BRD-07` — bordas da linha vazia e a declaração completa | PP |
| D | Cinco testes novos, sendo o de `R-BRD-02` o obrigatório | P |
| E | Abrir no Word e comparar com a página 6 do GRC — fecha `I-12` | PP |

**Total: meio dia.** O que torna barato é que o dado já está no modelo: `CelulaAnexo` já carrega
texto, preenchimento e borda, e `Anexo` já carrega as mesclagens e sabe se partir em blocos. Não
há leitura nova da planilha, nem medição nova no GRC.

A fase E não é opcional, e não é conferência de rotina: é a única forma de saber se `R-BRD-03`
funciona.

---

## 12. Histórico

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-08-11 | Redação inicial. §2.4 — a cobertura de mesclagem contar como conteúdo — saiu de medição sobre os 19 anexos, e mudou a regra depois de escrita: a versão anterior apararia 8 anexos errado |
| 1.1 | 2026-08-11 | **Implementada.** Três correções que só a implementação revelou: (a) `R-BRD-03` não tem **nenhum** caso no piloto — a contagem de colunas vazias no meio da §2.3 vinha da leitura ingênua, e a regra corrigida as zera; (b) três testes de largura precisaram mudar, contra o "passa sem alteração" que a §8 previa — eles mediam *todas* as tabelas do anexo, e a largura por bloco é precisamente o que deixou de ser uniforme; (c) as linhas sem conteúdo são 50, das quais 21 saíam emolduradas |