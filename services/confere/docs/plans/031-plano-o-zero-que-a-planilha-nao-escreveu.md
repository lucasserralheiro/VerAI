# PLANO 031 — Implementação de "O zero que a planilha não escreveu"

| | |
|---|---|
| **Especificação** | [ESPEC 031](../specs/031-o-zero-que-a-planilha-nao-escreveu.md) **v1.1** |
| **Versão** | 1.1 — 2026-08-20 — **`F0` executada.** Escrito antes da implementação; o `P1` foi emendado com o método de hash da `T-2138`. O §9 fica reservado para a emenda de execução |
| **Backlog** | TASKS 031, a escrever. O que decide portão está aqui; o que for lição de execução vai para lá |
| **Estado inicial** | **1.383 testes de backend, todos passando** — `1383 passed` em 13min03, medido na `T-2135`. **A suíte está verde apesar da árvore suja**, e é o que autoriza tratar qualquer vermelho depois da `F3` como desta entrega. A árvore **não está limpa**: `backend/src/infrastructure/di/container.py` (+27) e `test_identidade_contratual.py` (+54) carregam a `T-2111` da ESPEC 029; seis arquivos de `frontend/e2e/` carregam a ESPEC 030; `README.md`, `CHANGELOG.md` e os documentos das ESPECs 029 e 030 estão modificados ou não versionados. **Nada disso é desta entrega**, e o §5 diz o que pega quem confundir os dois |
| **Colisão conhecida** | O `container.py` modificado altera exatamente o bloco `if medicao.itens:` onde a `F3` registra a `V-MED-04` — duas linhas abaixo do `v_med_03_desconto_por_posicao`. Não é conflito de merge; é adjacência, e exige que a `F3` seja escrita **sobre** o estado atual do arquivo, não sobre o do `HEAD` |
| **Instrumento existente** | O **oráculo já foi medido** (ESPEC §2.4), com um simulador que aplica a regra sem tocar `src/`. `tests/leitura_relatorio.py::ler_docx` devolve as linhas de item do `.docx`. As fixtures `piloto`/`pgm` de `test_anchor_por_codigo.py` devolvem `(resultado, linhas)` — `Report` e documento na mesma tupla. `test_desconto_desenvolvimento.py` já traz `CONGELADOS_PILOTO` e `CONGELADOS_PGM`, que são a prova pronta de que a `R-MED-02` não se moveu |

---

## 1. O que este plano tem de diferente dos anteriores

> **O código é curto e o risco não está nele.**
> O domínio ganha um pareamento de títulos e um predicado; o caso de uso ganha um ramo guardado.
> São umas trinta linhas, e a ESPEC §2.5 já mostrou que a guarda é falsa para 118 dos 120 códigos.
> O risco está em três coisas ao redor: **a camada errada**, **o inventário de âncoras** e **a
> árvore suja**.

> **A camada errada é diferente da da ESPEC 028, e mais sedutora.**
> Lá a tentação era filtrar no caso de uso. Aqui é pôr o zero dentro de `item_para` — devolver a
> ocorrência bruta com `medida_texto` trocado por `'0'`. Fica em duas linhas, o número sai certo,
> e **mente sobre a célula**: `medida_texto` existe para preservar o conteúdo bruto, e a `R-PER-02`
> foi emendada na ESPEC 021 exatamente sobre essa promessa. Um `LinhaZerada` que cite
> `medida_texto` já adulterado não mostra nada a quem confere. A `D-03` decidiu o contrário, e a
> `T-9` é o teste cujo único trabalho é reprovar esse atalho.

> **A entrega é em uma fase por decisão de quem pediu (`D-07`), e isso muda o plano, não a regra.**
> Perde-se a régua *"nenhuma diferença é aceitável"* que uma entrega em duas fases daria de graça.
> O §7 mostra como recuperá-la **dentro** de uma fase só: ordenando o trabalho de modo que exista
> um instante — o fim da `F2` — em que o mecanismo está inteiro e o documento ainda não se moveu.
> Esse instante é o portão `P1`, e é o mais valioso deste plano.

> **O inventário de âncoras já falhou duas vezes, do mesmo jeito.**
> O PLANO 024 §7 escreveu o critério certo — *"por o que o teste afirma, não por onde ele mora"* —
> e o PLANO 028 §8 registrou que ele **não foi aplicado até o fim**: duas âncoras apareceram
> depois de 14 minutos de suíte. As duas eram achaveis por busca. Aqui o inventário é a `F0`, com
> as buscas nomeadas uma a uma (§8).

---

## 2. Portões

| Portão | Momento | Critério | Se falhar |
|---|---|---|---|
| **P0 — Inventário completo, oráculo confirmado, testes reprovando pelo motivo certo** | Fim da `F1` | As seis buscas do §8 executadas e o inventário fechado. O conjunto tocado remedido contra a árvore parada: `{14.049.00054.00}` e `{14.049.00037.00}`, por extenso e vindo da **planilha**, não do predicado que ainda não existe. Os testes novos reprovam, e cada um na asserção esperada; os que afirmam invariante **passam já** | Um teste verde antes da `F3` não afirma o que se pensa. Oráculo derivado do código só prova que o código concorda consigo mesmo |
| **P1 — O mecanismo existe e o documento não se moveu** | Fim da `F2` | Os quatro artefatos saem com os hashes da linha de base — `d7829ee0af3cb50f`, `0a0b779902f1d6ed`, `a1df03d46f3e5cc2`, `d4ef7185adf8fe47` —, medidos **por entrada do pacote, sem `docProps/core.xml`**: a `T-2138` provou que o `.xlsx` não é byte-estável entre execuções (ESPEC §8.4). A suíte inteira fica como estava. O domínio novo existe, tem teste próprio verde, e ninguém o chama | Diferença aqui é vazamento: o predicado alcançou o fluxo antes de a `F3` autorizar. Reverter a `F2` |
| **P2 — A emissão, com o delta exatamente o previsto** | Fim da `F3` | As âncoras de conjunto acusam **55 → 54** no piloto e **51 → 50** no PGM; críticos **1 → 0** e **4 → 3**; `total_linhas` continua **58** nos dois. Os códigos que somem são os dois do oráculo, nem um a mais. Nenhuma diferença fora da tabela da ESPEC §8.4 | Reverter a `F3`. Linha que se move fora da lista é escopo vazado, e a lista foi escrita antes justamente para isso |
| **P3 — Reancoragem provada, com a árvore parada** | Fim da `F4` | O delta reproduzido desligando **apenas** a `R-APU-03`; nenhuma outra entrada dos pacotes se move; a aritmética do corpo do piloto fecha por dois caminhos independentes (textos e códigos). O `.json` da `T-1507` regravado **por deleção**, com `git diff` de zero inserções | Não trocar constante nenhuma. Colar a saída do código na âncora apaga a linha vermelha; não reancora |
| **P4 — A tela** | Fim da `F5` | A tabela das linhas zeradas aparece com linha na aba, os dois títulos de bloco e o texto da célula bruta. Suíte de navegador sem falha **nova** — a linha de base de falhas é a que a ESPEC 030 deixou | Publicar o backend sem a tela é publicar inferência silenciosa, que é o que a `R-APU-08` proíbe |
| **P5 — O conjunto** | Fim da `F6` | Backend verde, contagem declarada; `ruff` e `mypy` limpos nos arquivos tocados; ESPEC 028 §1 e `README.md` corrigidos | Não entregar |

---

## 3. Fases

### F0 — Inventário e oráculo `[portão]`

**Objetivo:** saber **tudo** o que a mudança vai reancorar, antes de mudar coisa alguma — e
reconfirmar o conjunto tocado contra a árvore como ela está hoje.

| # | Tarefa | Ref. |
|---|---|---|
| T-1 | Executar as **seis buscas** do §8 e fechar o inventário. Comparar com a tabela da ESPEC §8.4: o que aparecer a mais entra nela antes de qualquer código | ESPEC §8.4 |
| T-2 | Rodar a suíte de backend inteira, **com `python -m pytest`**, e registrar a linha de base: quantos passam, quantos falham, e quais falham **por trabalho não commitado de outras especs** | Estado inicial |
| T-3 | Remedir o conjunto tocado com o simulador, sobre os dois pares reais **e** as duas fixtures de borda. Confirmar 2 códigos em 120, 4 blocos pareados, 0 sem par | `R-APU-09`, ESPEC §2.4 |
| T-4 | Confirmar que **nenhum dos dois congelados traz o órfão do seu próprio par**: `14.049.00054.00` não está em `CONGELADOS_PILOTO`, e `14.049.00037.00` não está em `CONGELADOS_PGM`. *(Cuidado com a leitura apressada: `14.049.00037.00` **está** em `CONGELADOS_PILOTO`, e ali não é órfão — no piloto ele aparece nos dois blocos.)* | `R-APU-02` |
| T-5 | Capturar os quatro artefatos da linha de base e conferir contra os hashes da ESPEC §8.4. **Divergindo, o plano para**: a árvore mudou desde a escrita da espec | **P1** |

**Verificação:** `P0` (primeira metade).

> **`T-5` é barato e decide o `P1` inteiro.** Todo o valor do portão do fim da `F2` está em
> comparar contra um número que se sabe verdadeiro **agora**. A espec o mediu ontem, numa árvore
> que já não é esta.

**Tamanho:** PP — trinta minutos, mais o tempo de suíte.

---

### F1 — Os testes, escritos antes `[portão]`

**Objetivo:** ter, contra o código intocado, a prova de que a mudança ainda não existe — e os
cenários construídos para as três regras que os pares reais não exercitam (`R-APU-05`, `R-APU-06`,
`R-APU-07`).

| # | Tarefa | Ref. |
|---|---|---|
| T-6 | Fixture nova e **mínima**: bloco bruto com 3 códigos, apuração descontada com 2. Gerada de forma que a faixa chegue ao leitor como no arquivo real — a ESPEC 018 §2.8 registra que `openpyxl` regrava a mesclagem e apaga as células não-âncora, e foi assim que a suíte testou por meses uma forma que a produção nunca vê | `R-APU-03` |
| T-7 | Módulo novo `tests/test_apuracao_descontada.py`: pareamento dos quatro blocos reais; título com marca abreviada **não** pareia; ausência rende zero; ocorrência bruta não numérica cai na `R-REL-08` | `R-APU-01`, `R-APU-03`, `R-APU-05`, `R-APU-07` |
| T-8 | Teste do limite declarado: `14.024.00005.00` — marca na **descrição**, bloco `E5.1` não é apuração descontada, nada nele é zerado, e a contratada continua `3500` | `R-APU-04`, `R-APU-06`, `D-05` |
| T-9 | O teste que reprova o atalho da camada errada: `LinhaZerada.medida_texto` tem de trazer `'2'` — o que a planilha diz —, e `Measurement.item_para` tem de continuar devolvendo a ocorrência bruta **intacta** | `D-03`, `R-APU-08` |
| T-10 | Em `test_anchor_por_codigo.py`, entram `14.049.00054.00` em `ZERADOS_DO_PILOTO` (3 → 4) e `14.049.00037.00` em `ZERADOS_DO_PGM` (7 → 8). `BLOCO_FINAL_DO_*` seguem inteiros — são o `Report` | `R-APU-09` |
| T-11 | Teste marcado que abre os **arquivos reais** de `docs/documentos/` e confere pares e conjunto tocado | ESPEC §8.3 |
| T-12 | **[portão]** Rodar contra o `HEAD`: os de zeragem reprovam por medida `2` onde se espera `0`; os de `R-APU-04`, `R-APU-05` e `R-APU-06` **passam já** | **P0** |

**Verificação:** `P0`.

> **`T-12` tem testes que passam antes de qualquer código novo, e isso é resultado.** `R-APU-04`,
> `R-APU-05` e `R-APU-06` descrevem o que **não** muda. Reprovando aqui, a premissa de que a regra
> é estreita estaria errada antes de começar — e a `F2` estaria implementando outra coisa.

**Tamanho:** P — uma hora e meia, quase toda na fixture da `T-6`.

---

### F2 — O domínio, e o instante em que nada mudou `[portão]`

**Objetivo:** o mecanismo inteiro existindo, com teste próprio verde, **sem que nenhum documento se
mova**. É o `P1`, e é o §7.

| # | Tarefa | Ref. |
|---|---|---|
| T-13 | `measurement_item.py` — a marca deixa de ser privada. Só visibilidade; nenhum comportamento muda | ESPEC §7 |
| T-14 | `measurement.py` — `_apuracoes_descontadas()`: título do bloco bruto → códigos da apuração descontada. Normalização remove a marca e o separador que a precede | `R-APU-01`, `D-02` |
| T-15 | `measurement.py` — `omitido_da_apuracao_descontada(codigo)`: devolve a ocorrência **bruta e intacta** quando as três condições da ESPEC §2.5 valem, e `None` em todo o resto | `R-APU-03`, `R-APU-07`, `D-03` |
| T-16 | **[portão]** Testes de `T-7` e `T-9` verdes. Gerar os quatro artefatos e conferir contra os hashes da `T-5`: **byte a byte iguais**. Suíte inteira idêntica à linha de base da `T-2` | **P1** |

**Verificação:** `P1`.

> **`item_para`, `contratada_para` e `codigos_em_ordem` não são tocadas nesta fase nem em nenhuma
> outra.** Está na `D-03` e na `D-04`, e a `T-9` reprova quem tentar. `contratada_para` em especial:
> ela é o que impede a coluna vazia da variante descontada de virar `0` (T-1625), e é o defeito
> simétrico ao que esta espec corrige.

**Tamanho:** PP — trinta minutos.

---

### F3 — A emissão `[portão]`

**Objetivo:** o número muda, e muda exatamente nas duas linhas previstas.

| # | Tarefa | Ref. |
|---|---|---|
| T-17 | `report.py` — `LinhaZerada`, ao lado de `LinhaDerivada` e **fora** do agregado `Report`, pelo mesmo motivo: o `Report` é o documento; isto é auxílio de conferência | `R-APU-08` |
| T-18 | `generate_measurement_report.py` — o ramo guardado em `_montar_linha`, **antes** do ramo de perfil ou pacote, com a guarda de medida numérica da `R-APU-07`; `ReportResult` ganha `zeradas`, por último e com padrão | `R-APU-03`, `R-APU-07`, `R-APU-08` |
| T-19 | `measurement_validations.py` — `v_med_04_apuracao_sem_par`, e o registro no `container.py`. **Escrever sobre o arquivo como ele está**, com a `T-2111` da ESPEC 029 já dentro | `R-APU-05`, colisão conhecida |
| T-20 | **[portão]** Suíte: verdes os testes de zeragem; vermelhas **apenas** as âncoras da tabela da ESPEC §8.4. Conferir `total_linhas == 58` nos dois pares — a linha continua no `Report` | **P2** |

**Verificação:** `P2`.

> **A ordem dos dois ramos em `_montar_linha` é decisão, não estilo.** A `R-APU-07` manda a
> zeragem valer só para medida numérica; pôr o ramo novo antes do de perfil, **com a guarda**, é o
> que faz `PACOTE` continuar saindo `1 / 1`. Sem a guarda, um item de pacote ausente da apuração
> descontada sairia `0` — e nenhum arquivo real acusaria, porque o caso não existe neles.

**Tamanho:** PP — uma hora.

---

### F4 — A reancoragem `[portão]`

**Objetivo:** trocar as constantes de documento **uma vez só**, com o delta provado.

| # | Tarefa | Ref. |
|---|---|---|
| T-21 | Desligar **apenas** a `R-APU-03` — o ramo da `T-18`, e nada mais — e medir os quatro artefatos: têm de voltar aos hashes da `T-5` | **P3** |
| T-22 | Religar e medir de novo. Conferir que **só** `word/document.xml` difere em cada pacote | **P3** |
| T-23 | Conferir a aritmética por caminho independente: `CORPO_DO_PILOTO_CODIGOS` 76 → 75 (uma linha), e `CORPO_DO_PILOTO_TEXTOS` 16.017 → o valor medido. A ESPEC §8.4 **prevê** 16.013 por analogia com a ESPEC 028 — 4 células, unidade vazia — e o número que vale é o medido aqui | **P3** |
| T-24 | Trocar as constantes de `test_capa.py` e `test_identidade_dos_artefatos.py`, com a cadeia dos estados no comentário de cada uma | **P3** |
| T-25 | `fixtures/linhas_do_documento.json` — regravar **derivando do anterior**, removendo as duas entradas previstas. Conferir contra a saída do renderizador nos dois pares, e que o `git diff` saia **só com deleções** | **P3** |
| T-26 | Ajustar `test_api_e2e` (`sem_cobertura` vazio, críticos vazios) e `test_anchor_analise` | **P3** |

**Verificação:** `P3`.

> **A `T-21` é o que separa reancorar de apagar linha vermelha.** O passo final sozinho prova que o
> documento mudou — coisa que já se sabe. O passo de volta prova que ele mudou **por esta razão e
> por nenhuma outra**, e é a única forma de dizer isso numa árvore que carrega trabalho de outras
> três especs.

**Tamanho:** P — uma hora, quase toda de espera de renderização.

---

### F5 — A tela e a API `[portão]`

**Objetivo:** a inferência deixa de ser silenciosa fora do backend.

| # | Tarefa | Ref. |
|---|---|---|
| T-27 | `api/schemas.py` e `routers/reports.py` — campo novo com as `zeradas`, aditivo | `R-APU-08` |
| T-28 | Tabela no frontend, no padrão da tabela de linhas derivadas da ESPEC 021: linha na aba, os dois títulos de bloco, o texto da célula bruta e o que foi emitido | `R-APU-08` |
| T-29 | **[portão]** Suíte de navegador: nenhuma falha **nova** sobre a linha de base que a ESPEC 030 deixou | **P4** |

**Tamanho:** P — uma hora e meia.

---

### F6 — Fechamento `[portão]`

| # | Tarefa | Ref. |
|---|---|---|
| T-30 | Suíte de backend completa, contagem declarada: 1.383 → o número que sair, e ele vira número declarado | **P5** |
| T-31 | `ruff` e `mypy` sobre os arquivos tocados | **P5** |
| T-32 | **Corrigir a ESPEC 028 §1**: o `14.049.00054.00` foi usado ali como *"o contraste que fecha o argumento"*, e aquele `0 / 2` era artefato do sistema. A `R-ZER-01` não muda; o exemplo, sim | ESPEC §11 |
| T-33 | `README.md` — a linha do incremento 031 e o quadro de estado: *"1 crítico, 20 sem medição, 16 parciais, 19 conformes"* passa a ser **0 crítico**, e os dois últimos números já estavam defasados antes desta entrega | ESPEC §8.4 |
| T-34 | `docs/CHANGELOG.md` — a entrada de rumo: a `R-MED-02` sobe de código para bloco, e um exemplo da ESPEC 028 cai | — |

**Tamanho:** PP — trinta minutos.

---

## 4. Sequência

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5 ──► F6
P0     P0     P1     P2     P3     P4     P5
              │
              └─ o documento ainda não se moveu (§7)
```

**Nenhuma fase é publicável sozinha**, e é consequência direta da `D-07`. Entre o fim da `F3` e o
fim da `F4` a suíte tem vermelhos conhecidos e enumerados; entre a `F4` e a `F5` o backend está
correto e a tela ainda não mostra a inferência, o que a `R-APU-08` não admite como estado final.

| Alocação | Duração |
|---|---|
| 1 desenvolvedor | ~6h, mais duas execuções de suíte |

---

## 5. O que pode dar errado, e o que pega

| Risco | O que pega |
|---|---|
| Pôr o zero dentro de `item_para`, adulterando `medida_texto` | `T-9` — o único ponto da suíte que reprova esse atalho, e o que preserva a promessa da `R-PER-02` |
| A zeragem alcançar item de pacote | A guarda de medida numérica da `T-18` e o cenário construído da `T-7`. **Nenhum arquivo real acusaria** |
| Arrastar a contratada junto com a medida | `T-8`: `14.024.00005.00` continua `3500 / 762,55`. É o defeito simétrico, e tem caso real |
| Parear por posição, ou por interseção de códigos | `T-7`: `TOTAIS VCPU e VRAM` está **entre** os dois blocos de `E1.1`, e o pareamento por posição erraria o alvo |
| A regra se desligar em silêncio numa planilha futura | `V-MED-04` (`T-19`) e o teste dos arquivos reais (`T-11`). É o modo de falha da ESPEC 018, e o único que não aparece como vermelho |
| O inventário de âncoras ficar incompleto — pela terceira vez | `F0` inteira, com as seis buscas do §8 nomeadas |
| Confundir *"a suíte estava vermelha"* com *"a minha mudança quebrou"* | `T-2` mede a linha de base **antes**, e o Estado inicial nomeia as quatro especs cujo trabalho está na árvore |
| Reancorar contra implementação em andamento | `F4` depois da `F3`, e a `T-21` provando o delta nos dois sentidos |
| A fixture da `T-6` testar uma forma que a produção não vê | Registrado na própria tarefa: é o defeito da ESPEC 018 §2.8, e a `T-11` o cobre pelo outro lado |

---

## 6. O que este plano não faz

- Não toca `item_para`, `contratada_para` nem `codigos_em_ordem` (`D-03`, `D-04`).
- Não toca `Contract` — nem `posicao_de`, nem `aplicar`, nem a extração do PDF.
- Não toca `docx_renderer.py` nem `xlsx_analise_renderer.py`: a linha chega `0 / 0` e a `R-ZER-01`
  já sabe o que fazer.
- Não altera a `R-ZER-01`, a `R-REL-06`, a `R-REL-08` nem o critério de quais códigos caem no bloco
  final.
- Não trata a marca em descrição de linha (`D-05`), nem responde `I-01` — se desenvolvimento é
  cobrado de algum cliente. A regra não depende dessa resposta.
- **Não corrige os problemas 2 e 3 do mesmo relato** — a descrição cortada na quebra de página do
  PDF e o desdobramento por qualificador do `14.025.00011.00`. São defeitos distintos, com causas
  distintas, e cada um pede a sua espec.

---

## 7. Como uma entrega em uma fase recupera a régua de duas

A `D-07` registrou a escolha e o custo: entregando de uma vez, mecanismo e valor mudam juntos, e
perde-se a régua mais forte que existe — *"qualquer diferença é erro"*.

Ela se recupera **quase inteira**, e de graça, ordenando o trabalho.

O pareamento e o predicado (`F2`) são código que **não tem chamador**. Escritos primeiro, existem,
têm teste próprio, e não podem mover documento nenhum — porque ninguém os invoca. É o `P1`, e ali
a régua volta a valer na sua forma dura: os quatro artefatos têm de sair **byte a byte** iguais aos
da `T-5`. Não há nada a julgar; ou são idênticos, ou algo vazou.

Só a `F3` liga o mecanismo ao fluxo, e ela é uma tarefa: o ramo guardado em `_montar_linha`. A
partir dali a régua muda para a forma fraca — *"só as diferenças da lista"* —, e a lista está
escrita desde a ESPEC §8.4, com dezessete linhas.

O que se perde de verdade, em relação a duas fases, é uma coisa só: **ninguém usa o sistema no
estado intermediário.** Numa entrega em duas fases o `P1` iria para produção e ficaria semanas
sendo exercitado por gente de verdade, com dados de verdade, antes de o número mudar. Aqui ele dura
os trinta minutos entre a `F2` e a `F3`, e é exercitado só pela suíte.

É um custo real, e é o custo que a `D-07` aceitou. O plano não o disfarça — reduz o que dá para
reduzir e nomeia o que sobra.

---

## 8. O inventário de âncoras, e as seis buscas

O PLANO 024 §7 escreveu o critério: **por o que o teste afirma, não por onde ele mora**. O PLANO
028 §8 registrou que ele não foi aplicado até o fim, e que as duas âncoras perdidas eram achaveis
por busca — uma tinha `ANCORA = Path(...)` no topo do módulo, a outra era literalmente um
`assert len(...) == 58`.

A `F0` executa as seis, sobre `backend/tests/` inteiro:

| # | Busca | O que acha |
|---|---|---|
| 1 | `sha256` | Âncoras de pacote e de corpo — `test_capa.py`, `test_identidade_dos_artefatos.py` |
| 2 | `assert len(` | Contagens embutidas em testes cujo nome não fala de contagem — foi assim que a do `test_api_e2e` escapou |
| 3 | `ANCORA\s*=\|Path(.*\.json` | Âncoras guardadas em fixture, como a `linhas_do_documento.json` da `T-1507` |
| 4 | `== 5[0-9]\b\|== 58\b` | Contagens de linha do documento, nas duas formas |
| 5 | `14\.049\.0005[0-9]\|14\.049\.0003[0-9]` | Os dois códigos órfãos e os seus vizinhos de bloco, onde quer que estejam citados por extenso |
| 6 | `CRITICO\|Item crítico` | Contagens e listas de itens críticos — `test_analise.py`, `test_anchor_analise.py`, `test_api_e2e.py`, `test_xlsx_analise.py` |

**O resultado da `F0` manda na tabela da ESPEC §8.4, e não o contrário.** Aparecendo âncora que
ela não previu, a tabela é emendada **antes** da `F2` — nunca depois, e nunca ajustando o valor
esperado ao valor obtido.

Duas coisas já se sabem, e estão aqui para não serem redescobertas na suíte de 14 minutos:

- `test_desconto_desenvolvimento.py` **não** precisa de edição: `CONGELADOS_PILOTO` e
  `CONGELADOS_PGM` não contêm nenhum dos dois órfãos;
- `test_analise.py` **não** precisa de edição: os cenários de item crítico constroem `ReportLine`
  à mão, e a mudança é anterior, em `Measurement`.

---

## 9. Emenda de execução

*Reservado. A preencher ao fim da execução, com o que ela ensinar que este texto não previa.*
